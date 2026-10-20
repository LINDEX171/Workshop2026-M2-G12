# PCA / PRA — RESILIENCE-ALPHA

Plan de Continuité (PCA) et de Reprise (PRA) de la solution livrée.

## Périmètre
Service de paiement fictif conteneurisé (payment-api + db) et sa chaîne de détection/remédiation.

## Scénarios couverts
| Scénario | Continuité / Reprise | Mécanisme | RTO | RPO |
|---|---|---|---|---|
| DoS applicatif | Reprise auto | detector → remediator (ban signature + restart) → vérification | ~13–20 s (mesuré) | ~0 |
| payment-api planté | Reprise auto | alerte `service_down` → `restart_service.yml` → (escalade `rollback_image.yml`) | < 1 min | ~0 |
| Incohérence de données | Reprise assistée | `restore_db.yml` (restauration du dernier dump sain) | selon volume | dernier dump |
| Attaque bloquée (SQLi/brute force) | Continuité | WAF (403), rate limit, SOC — pas d'interruption | n/a | n/a |

## Responsabilités
- **Automatique (Zero-Touch)** : détection, décision, action, vérification, journalisation.
- **Humain (escalade)** : si le remediator journalise `escalated` (« intervention humaine requise »),
  consulter le [runbook DoS](runbooks/remediation-dos.md) et le dashboard SOC.

## Choix de restauration
- Disponibilité d'abord : bannir la source + redémarrer, puis **prouver** par une transaction.
- Les transactions validées sont durables (écriture atomique) : pas de rejeu, RPO ~0.
- La restauration de base (`restore_db.yml`) suppose des sauvegardes régulières (à industrialiser
  hors maquette).

## Risques résiduels après reprise
- Attaque persistante changeant de signature : nécessiterait une identification plus fine
  (corrélation SOC) ; IP source masquée par Docker Desktop.
- Rétention des journaux courte en démo ; sauvegardes DB non planifiées.
- Modèle ML à réentraîner après évolution applicative (dérive).

## Procédure de reprise manuelle (secours)
```bash
./scripts/reset_demo.sh                 # lever bannissements, réarmer
docker compose --profile full up -d     # relancer les services
./scripts/healthcheck_all.sh            # vérifier la santé
# cas lourd : ansible-playbook ansible/reset.yml  (remise à zéro complète)
```
