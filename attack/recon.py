#!/usr/bin/env python3
"""Reconnaissance réseau depuis le PC Attaquant (phase 0, avant toute attaque).

Déroulé réaliste d'une intrusion : on ne connaît pas encore la cible, on la découvre.
  1. Balayage du sous-réseau du point d'accès (RESILIENCE-G12) → quels hôtes répondent.
  2. Scan des ports usuels sur chaque hôte vivant → quels services sont exposés.
  3. Empreinte HTTP(S) → bannière/serveur, pour repérer le WAF (seule porte d'entrée).

Le résultat attendu, si le durcissement est correct : un seul hôte (le PC Hôte) expose
un seul port public (443/8443, le WAF). Base de données, secrets et services internes ne
doivent PAS apparaître. C'est ce constat qui justifie d'attaquer « à travers » le WAF.

Périmètre : UNIQUEMENT le SI fictif du groupe (point d'accès RESILIENCE-G12). Jamais le
réseau du campus, un autre consortium ni une cible tierce. Scan TCP connect (pas d'ARP
ni d'ICMP brut) : volontairement bruyant et simple, pour que la supervision le voie.

Stdlib seulement : tourne dans python:3.12-slim sans dépendance.
    python recon.py --subnet 192.168.137.0/24
    python recon.py --subnet 192.168.137.0/24 --ports 22,80,443,8443,5432,9090,3000
"""
import argparse
import ipaddress
import socket
import ssl
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# Ports usuels + ceux du projet : ce qui NE devrait PAS être joignable depuis l'extérieur
# (5432 db, 9090 prometheus, 3000 grafana, 11434 ollama, 8000 API internes) est signalé.
DEFAULT_PORTS = [22, 80, 443, 3000, 5432, 8000, 8443, 9090, 11434]
SERVICES = {
    22: "ssh", 80: "http", 443: "https/WAF", 3000: "grafana", 5432: "postgres",
    8000: "api-interne", 8443: "https/WAF", 9090: "prometheus", 11434: "ollama",
}
# Ports qui, exposés sur le réseau pédagogique, trahissent un défaut de cloisonnement.
SENSIBLES = {3000, 5432, 8000, 9090, 11434}


def port_open(ip: str, port: int, timeout: float) -> bool:
    """TCP connect : le port accepte-t-il une connexion ?"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex((str(ip), port)) == 0


def scan_host(ip: str, ports: list[int], timeout: float) -> list[int]:
    return [p for p in ports if port_open(ip, p, timeout)]


def http_banner(ip: str, port: int, timeout: float) -> str:
    """Récupère l'en-tête Server (indice fort pour identifier un WAF / reverse-proxy)."""
    scheme = "https" if port in (443, 8443) else "http"
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(f"{scheme}://{ip}:{port}/", method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.headers.get("Server", "?")
    except urllib.error.HTTPError as e:  # 403/401 = le service répond quand même
        return e.headers.get("Server", "?") if e.headers else "?"
    except Exception:
        return "?"


def main() -> None:
    p = argparse.ArgumentParser(description="Reconnaissance réseau (SI fictif uniquement)")
    p.add_argument("--subnet", default="192.168.137.0/24", help="sous-réseau à balayer")
    p.add_argument("--ports", default=",".join(map(str, DEFAULT_PORTS)),
                   help="liste de ports séparés par des virgules")
    p.add_argument("--timeout", type=float, default=0.5, help="timeout par connexion (s)")
    p.add_argument("--workers", type=int, default=256, help="connexions en parallèle")
    args = p.parse_args()

    ports = [int(x) for x in args.ports.split(",") if x.strip()]
    hosts = list(ipaddress.ip_network(args.subnet, strict=False).hosts())
    print(f"[recon] balayage {args.subnet} ({len(hosts)} hôtes) sur {len(ports)} ports\n")

    # 1-2. Découverte des hôtes et de leurs ports ouverts (un futur par hôte).
    found: dict[str, list[int]] = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = pool.map(lambda ip: (str(ip), scan_host(ip, ports, args.timeout)), hosts)
        for ip, open_ports in results:
            if open_ports:
                found[ip] = open_ports

    if not found:
        print("[recon] aucun hôte joignable — vérifier la connexion au point d'accès RESILIENCE-G12")
        return

    # 3. Détail par hôte + empreinte HTTP, et repérage de la porte d'entrée.
    entry_points: list[str] = []
    for ip in sorted(found, key=lambda a: tuple(int(o) for o in a.split("."))):
        print(f"[hôte] {ip}")
        for port in found[ip]:
            name = SERVICES.get(port, "?")
            flag = "  ⚠ exposition sensible" if port in SENSIBLES else ""
            banner = ""
            if port in (80, 443, 8443):
                banner = f"  Server: {http_banner(ip, port, args.timeout)}"
            if port in (443, 8443):
                entry_points.append(f"{ip}:{port}")
            print(f"   {port:<6} {name}{banner}{flag}")
        print()

    # Synthèse : ce que l'attaquant retient avant de choisir son angle d'attaque.
    print("[recon] synthèse")
    if entry_points:
        print(f"   porte(s) d'entrée publique(s) : {', '.join(entry_points)}")
        print(f"   → cible des attaques : https://{entry_points[0]}")
    else:
        print("   aucune entrée HTTPS trouvée (le WAF est-il démarré ?)")
    sensibles = {f"{ip}:{p}" for ip, ps in found.items() for p in ps if p in SENSIBLES}
    if sensibles:
        print(f"   ⚠ services internes joignables (défaut de cloisonnement) : {', '.join(sorted(sensibles))}")
    else:
        print("   cloisonnement OK : aucun service interne exposé, seul le WAF répond")


if __name__ == "__main__":
    main()
