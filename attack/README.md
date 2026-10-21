# Attaques — PC Attaquant

Scénarios d'attaque contre le SI **fictif** RESILIENCE-ALPHA, pour démontrer la détection
et la remédiation. Scripts en Python **stdlib uniquement** (aucune dépendance).

> ⚠️ **Périmètre strict.** Ces attaques ne visent **QUE** votre propre SI fictif et vos
> machines (point d'accès `RESILIENCE-G12`). Jamais le réseau du campus ni une cible tierce.
> C'est une obligation du sujet et de la loi.

## Prérequis
- **En démo** : le PC Attaquant (Kali ou autre) est connecté au point d'accès
  `RESILIENCE-G12`. La cible est le WAF : `https://192.168.137.1`.
- **En local (tests)** : un conteneur jetable sur le réseau `public` via les scripts
  `scripts/attack_*.sh` (la cible est alors `https://waf:8443`).

## Chaîne d'attaque (ordre de la démo)
La démo suit un déroulé réaliste : **on découvre la cible avant de la frapper.**
1. **Reconnaissance** (`recon.py`) — lister les appareils du réseau, voir ce qui est exposé.
2. **Choix de l'angle** — la seule porte publique est le WAF → on attaque « à travers » lui.
3. **Attaque** (`dos_attack.py`, etc.) → détection ML → remédiation → reprise vérifiée.

## Scénarios

### 0. Reconnaissance réseau — `recon.py` (phase préalable)
Balaye le sous-réseau du point d'accès, liste les hôtes vivants et leurs ports ouverts,
et empreinte les services HTTP(S). But : **découvrir** le PC Hôte et constater que, grâce
au durcissement, **seul le WAF (443) répond** — base de données, Prometheus, Grafana et
services internes ne sont pas joignables. C'est ce constat qui désigne la cible.
```bash
# depuis le PC Attaquant (point d'accès RESILIENCE-G12)
python recon.py --subnet 192.168.137.0/24
# en local (tests), sur le réseau public de compose
python recon.py --subnet 172.0.0.0/8   # ou l'IP du WAF directement
```
> Scan **TCP connect** volontairement visible : la supervision (SIEM/SOC) doit le voir
> passer. Il ne touche qu'à votre SI fictif, jamais au réseau du campus.

### 1. DoS applicatif — `dos_attack.py` (scénario principal, disponibilité)
Rafale de requêtes authentifiées (jeton bidon) sur `/api/pay/transactions`. payment-api
doit interroger auth à chaque requête → latence p95 et CPU explosent.
- **Effet** : le detector (ML) franchit le seuil → alerte → le remediator **bannit la
  signature de l'attaquant** et redémarre payment-api → **reprise vérifiée**.
- **Signature** : User-Agent `ResilienceDoS/1.0` (ce qui permet au WAF de l'isoler).
```bash
# local
./scripts/attack_burst.sh 45 60
# depuis le PC Attaquant
python dos_attack.py --target https://192.168.137.1 --duration 45 --concurrency 60
```

### 2. Sonde SQLi / XSS — `sqli_probe.py` (compromission, défense)
Envoie des charges SQLi/XSS/path traversal. **Montre la défense** : le WAF (ModSecurity +
OWASP CRS) les **bloque (403)**. N'affecte pas la disponibilité.
```bash
./scripts/attack.sh sqli_probe.py
python sqli_probe.py --target https://192.168.137.1
```

### 3. Brute force d'authentification — `bruteforce_auth.py` (compromission)
Rafale de connexions à mauvais mot de passe. **Effet** : 401 journalisés (vue SOC),
limite anti brute force du WAF (429), alerte SOC Grafana (>10 échecs/min).
```bash
./scripts/attack.sh bruteforce_auth.py --attempts 60
python bruteforce_auth.py --target https://192.168.137.1 --attempts 60
```

## Disponibilité vs compromission (insistance du sujet)
- **Disponibilité** (DoS) : le service tombe/ralentit. Réponse = détection ML + remédiation
  (ban + restart), reprise prouvée par une transaction.
- **Compromission** (SQLi, brute force) : tentative de voler/altérer des données ou un
  compte. Réponse = **prévention** (WAF qui bloque, cloisonnement, moindre privilège) et
  **surveillance** (SOC). Ce ne sont **pas** les mêmes réponses : on ne « redémarre » pas
  pour contrer une injection.
```
