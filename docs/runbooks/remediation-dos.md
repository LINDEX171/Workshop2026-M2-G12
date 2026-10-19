# Runbook — Remédiation d'un DoS applicatif

Procédure appliquée **automatiquement** par le remediator (Zero-Touch). Sert aussi de
référence pour une intervention manuelle et alimente l'assistant RAG (Phase 8).

## Symptômes
- Dashboard de supervision au rouge, bandeau **PENDANT**.
- Score d'anomalie du detector au-dessus du seuil calibré ; latence p95 et CPU de
  `payment-api` en forte hausse, requêtes/s anormalement élevées.

## Détection
Deux voies indépendantes alertent le remediator (`POST /alert`) :
1. **detector** (Isolation Forest + enveloppe) — `type: availability_dos`.
2. **Alertmanager** — règles `HighErrorRate`, `HighLatencyP95`, `PaymentApiDown`.

## Décision (table type → actions)
| type | actions successives |
|---|---|
| `availability_dos` | `ban_ip.yml` (bannir la signature de l'attaquant) → `restart_service.yml` |
| `service_down` | `restart_service.yml` → `rollback_image.yml` |
| `data_incoherent` | `restore_db.yml` |

## Actions automatiques
1. **Identifier l'attaquant** : plus gros émetteur (User-Agent) dans les logs d'accès du
   WAF, via Loki. Derrière Docker Desktop, l'IP source n'est pas exploitable.
2. **Bannir la signature** au WAF (`infra/waf/banlist-ua/`), puis recharger le WAF
   (SIGHUP via le docker-socket-proxy).
3. **Redémarrer** `payment-api` via le docker-socket-proxy pour purger la file d'attente.
4. **Vérifier la reprise** : connexion + transaction de test (1 €) **via le WAF**, et
   relecture de `payment-api /health`. `recovered` seulement si la transaction aboutit
   ET que le service se déclare sain.
5. Si la reprise n'est pas vérifiée après toutes les actions → `escalated` :
   **intervention humaine requise**.

## Vérification manuelle
```bash
curl -s http://localhost:8081            # Adminer : la transaction de test est en base
docker compose logs remediator --since 5m | grep -E "remediation_(start|recovered|escalated)"
```
Journal des remédiations : `GET /events` (affiché dans le dashboard de supervision).

## Rollback / nettoyage
Lever un bannissement : vider le fichier correspondant dans `infra/waf/banlist-ua/` puis
`docker compose kill -s HUP waf`. La remise à zéro complète se fait par
`ansible-playbook ansible/reset.yml`.
