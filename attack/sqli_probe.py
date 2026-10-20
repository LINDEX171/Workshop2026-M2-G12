#!/usr/bin/env python3
"""Sonde d'injection SQL / XSS contre le WAF (démonstration de DÉFENSE, pas de disponibilité).

Envoie des charges malveillantes classiques via le WAF et vérifie qu'elles sont
BLOQUÉES (403 par ModSecurity + OWASP CRS). Un payload qui passerait (2xx) serait une
faille : le script le signale.

Périmètre : UNIQUEMENT le SI fictif du groupe. Jamais une cible tierce.
Stdlib seulement : tourne dans python:3.12-slim sans dépendance.
    python sqli_probe.py --target https://waf:8443
"""
import argparse
import ssl
import urllib.error
import urllib.parse
import urllib.request

PAYLOADS = [
    ("SQLi OR 1=1", "/api/pay/transactions?id=1' OR '1'='1"),
    ("SQLi UNION", "/api/pay/accounts?q=1 UNION SELECT username,password_hash FROM users"),
    ("SQLi boolean", "/api/pay/accounts?id=1' AND SLEEP(5)-- -"),
    ("XSS script", "/api/pay/accounts?q=<script>alert(1)</script>"),
    ("XSS img onerror", "/api/pay/accounts?q=<img src=x onerror=alert(1)>"),
    ("Path traversal", "/api/pay/accounts?file=../../../../etc/passwd"),
]


def run(target: str) -> int:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    blocked = rejected = vulnerable = 0
    print(f"[sqli] cible {target} (403 = bloqué par le WAF ; 2xx = FAILLE)\n")
    for label, path in PAYLOADS:
        url = target + urllib.parse.quote(path, safe="/?=&")
        req = urllib.request.Request(url, headers={"User-Agent": "ResilienceSQLi/1.0"})
        try:
            code = urllib.request.urlopen(req, timeout=8, context=ctx).status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:  # connexion refusée, etc.
            print(f"  ?? {label:20s} erreur réseau: {e}")
            continue
        if code == 403:
            blocked += 1
            print(f"  OK {label:20s} -> {code} (bloqué par le WAF)")
        elif 200 <= code < 300:
            vulnerable += 1
            print(f"  !! {label:20s} -> {code} (FAILLE : charge acceptée)")
        else:
            rejected += 1
            print(f"  ~  {label:20s} -> {code} (rejeté : pas d'accès, mais non filtré par le WAF)")

    print(f"\n[sqli] bloqués par le WAF : {blocked} | rejetés : {rejected} | FAILLES : {vulnerable}")
    if vulnerable:
        print("[sqli] ÉCHEC : au moins une charge a été acceptée.")
    else:
        print("[sqli] OK : aucune charge malveillante n'a abouti.")
    return 1 if vulnerable else 0


def main() -> None:
    p = argparse.ArgumentParser(description="Sonde SQLi/XSS contre le WAF (SI fictif uniquement)")
    p.add_argument("--target", default="https://waf:8443")
    raise SystemExit(run(p.parse_args().target))


if __name__ == "__main__":
    main()
