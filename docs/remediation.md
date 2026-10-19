# Remédiation Zero-Touch — dossier technique

Service `remediator` (Phase 7) : décide, agit via Ansible, **vérifie** la reprise.

## Architecture
- `POST /alert` : reçoit le detector **et** Alertmanager, normalise les deux formats,
  lance la remédiation en tâche de fond (verrou : une seule à la fois).
- Table de décision `type → [actions]` (voir `docs/runbooks/remediation-dos.md`).
- Chaque action = un **playbook Ansible** exécuté via `ansible-runner`.
- Après chaque action, **vérification de reprise** par une vraie transaction via le WAF.
- `GET /events` : journal horodaté (`detected → running → recovered | escalated`).
- Métriques : `remediation_total`, `remediation_success_total`, `remediation_duration_seconds`.

## Playbooks (`services/remediator/playbooks/`)
| Playbook | Action |
|---|---|
| `ban_ip.yml` | écrit la signature/IP de l'attaquant dans la banlist WAF, recharge le WAF |
| `restart_service.yml` | redémarre le conteneur cible via le docker-socket-proxy |
| `rollback_image.yml` | recréation depuis l'image de référence (escalade) |
| `restore_db.yml` | restaure le dernier dump sain (squelette documenté) |

Déploiement et remise à zéro de la stack : `ansible/deploy.yml`, `ansible/reset.yml`.

## Durcissement (pièges du sujet)
- **Pas de socket Docker brut** : accès via `docker-socket-proxy` (Tecnativa) limité à
  la lecture des conteneurs et aux POST restart/kill. Pas de création, pas d'exec.
- **Aucun port public** : le remediator n'expose rien vers l'extérieur. Réseaux `ops`
  (détection, proxy Docker, Loki) et `app` (uniquement pour la transaction de preuve
  via le WAF).
- **Pas d'admin ouverte sur le WAF** : le bannissement se fait par fichier dans un volume
  partagé + rechargement, aucune interface d'administration exposée.
- **Secrets** : le mot de passe du compte de preuve vient d'un secret Docker
  (`operator_password`), jamais du dépôt. (SOPS en Phase 10.)
- **Moindre privilège** : l'assistant RAG (Phase 8) n'a, lui, aucun droit Docker — il ne
  doit pas être confondu avec le remediator.

## Limites
- **Compte de preuve = `operator`** : simplification de démo. En production, un compte de
  sonde dédié à moindre privilège serait utilisé.
- **IP source masquée par Docker Desktop** : le bannissement porte sur la **signature**
  (User-Agent), identifiée comme le plus gros émetteur dans les logs WAF. En réseau réel
  (WSL2 mirrored / host networking), le bannissement par IP redevient exploitable.
- **Filet de secours** : si Loki n'a pas encore la donnée, la signature retombe sur une
  valeur connue (`FALLBACK_ATTACK_SIGNATURE`) pour fiabiliser la démo.
- `rollback_image.yml` et `restore_db.yml` sont des squelettes fonctionnels : un vrai
  rollback nécessite des images taguées par version, une vraie restauration un dump sain
  régulier. Hors périmètre du scénario DoS noté.
