# Architecture — RESILIENCE-ALPHA

## Vue d'ensemble
Plateforme de paiement fictive en microservices conteneurisés, conçue pour **détecter** une
attaque et **se réparer seule**. Le schéma, les réseaux et le flux incident→reprise sont dans
le [README racine](../README.md#1-architecture).

## Choix structurants et justifications
| Choix | Raison |
|---|---|
| **5 réseaux cloisonnés** (public/app/data/auth-data/ops) | Réduire la surface : auth isolé de la base paiements, bases sans port publié, remédiation séparée |
| **WAF unique point d'entrée** | Un seul endroit durci (TLS, ModSecurity/CRS, rate limit, bannissement) |
| **2 bases Postgres** (db, auth-db) | Séparer identités et données métier ; rôles SQL à moindre privilège |
| **Détection ML** (Isolation Forest + enveloppe) | Pas de seuils en dur ; apprise sur le trafic normal ; double voie avec Alertmanager |
| **Remédiation via Ansible + socket-proxy** | Actions reproductibles, droits Docker restreints, aucune admin ouverte |
| **Vérification de reprise par transaction réelle** | Preuve de disponibilité de bout en bout, pas seulement un /health |
| **Secrets SOPS + age** | Aucun secret en clair dans le dépôt |
| **Assistant RAG en lecture seule** | Aide à l'exploitation sans privilège, distinct du remediator |

## Observabilité
Prometheus (métriques), Loki + Promtail (logs JSON par service), Grafana (dashboards technique
et SOC), cAdvisor (CPU/RAM), postgres-exporter, Alertmanager (2e voie vers le remediator).

## Cycle de résilience (mesuré)
Détection < ~20–40 s après le début de l'attaque (fenêtre 1 min) → bannissement + restart →
vérification → **RTO mesuré ~13–20 s** côté remédiation, 10/10 reprises autonomes
(`scripts/demo_replay.sh`).

## Limites d'architecture
- Docker Desktop masque l'IP source → bannissement par signature (voir [remediation](remediation.md)).
- Démo mono-poste : RAM limitée, LLM réduit possible. Ollama déportable sur un PC IA.
