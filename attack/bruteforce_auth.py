#!/usr/bin/env python3
"""Brute force d'authentification (démonstration de COMPROMISSION tentée, pas de disponibilité).

Rafale de tentatives de connexion avec de mauvais mots de passe sur /api/auth/login.
Effets attendus et observables :
  - 401 (identifiants invalides) journalisés par auth avec l'IP -> vue SOC Grafana
  - 429 (trop de requêtes) : la limite anti brute force du WAF entre en jeu
  - l'alerte SOC Grafana (>10 échecs/min) se déclenche

Périmètre : UNIQUEMENT le SI fictif du groupe. Jamais une cible tierce.
Stdlib seulement.
    python bruteforce_auth.py --target https://waf:8443 --attempts 60
"""
import argparse
import json
import ssl
import urllib.error
import urllib.request

PASSWORDS = ["123456", "admin", "password", "operator", "root", "qwerty", "letmein"]


def run(target: str, user: str, attempts: int) -> None:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    url = f"{target}/api/auth/login"

    counts: dict[int, int] = {}
    print(f"[brute] {attempts} tentatives sur {url} (utilisateur '{user}')\n")
    for i in range(attempts):
        pwd = PASSWORDS[i % len(PASSWORDS)] + str(i)
        body = json.dumps({"username": user, "password": pwd}).encode()
        req = urllib.request.Request(
            url, data=body, method="POST",
            headers={"Content-Type": "application/json", "User-Agent": "ResilienceBrute/1.0"},
        )
        try:
            code = urllib.request.urlopen(req, timeout=5, context=ctx).status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception:
            code = 0
        counts[code] = counts.get(code, 0) + 1

    print("[brute] répartition des réponses :")
    labels = {401: "identifiants invalides", 429: "bloqué (rate limit WAF)", 200: "SUCCÈS (anormal !)", 0: "erreur réseau"}
    for code, n in sorted(counts.items()):
        print(f"  {code} {labels.get(code, ''):28s} : {n}")
    if counts.get(200):
        print("  !! Au moins une connexion a réussi : à investiguer")


def main() -> None:
    p = argparse.ArgumentParser(description="Brute force auth (SI fictif uniquement)")
    p.add_argument("--target", default="https://waf:8443")
    p.add_argument("--user", default="operator")
    p.add_argument("--attempts", type=int, default=60)
    a = p.parse_args()
    run(a.target, a.user, a.attempts)


if __name__ == "__main__":
    main()
