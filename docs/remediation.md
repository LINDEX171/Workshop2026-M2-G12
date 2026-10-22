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

## Perspectives — attaquant à signature rotative (non traité, piste identifiée)

Le scénario noté (`attack/dos_attack.py`) utilise une signature **unique**
(`ResilienceDoS/1.0`) : un seul ban suffit à l'arrêter. Pour explorer la limite du
mécanisme, un script de test (`attack/dos_attack_rotating_ua.py`, non intégré à la
démo notée) fait tourner le flood sur un pool de 20 User-Agent distincts.

**Constat empirique** (journal de remédiation sur un run réel, voir ci-dessous) :
le système reste fonctionnel — il détecte et rétablit le service à chaque fois —
mais **boucle** : deux cycles complets `detected → ban → recovered` séparés
d'environ 50 à 60 secondes sont déclenchés pendant un run de 45 s, là où l'attaque
à signature unique n'en déclenche qu'un seul et stabilise le service durablement.

| Détecté | Score | Rétabli | Délai depuis la reprise précédente |
|---|---|---|---|
| 11:26:53 | 1.0 | 11:27:04 | — |
| 11:27:53 | 0.9982 | 11:27:56 | 49 s |
| 11:44:37 | — | 11:44:39 | 55 s (run suivant) |
| 12:25:13 | 1.0 | 12:25:16 | 56 s (run suivant) |

**Analyse** : le ban (`topk(1, ...)` dans `app/signature.py`) ne neutralise que la
signature la plus émettrice à l'instant du relevé Loki ; les autres continuent de
flooder. La vérification de reprise (une transaction unique réussie) est un signal
trop faible face à ce profil : elle passe dès qu'une brève fenêtre de capacité
s'ouvre, sans refléter un retour durable sous le seuil — d'où la ré-détection quasi
immédiate.

**Pistes de correction, non implémentées par manque de temps** :
1. Bannir les *N* signatures les plus actives (pas seulement la première).
2. Conditionner `recovered` à un score resté sous le seuil pendant une fenêtre
   (ex. 15–30 s), pas à une transaction isolée.
3. Ajouter un rate-limit volumétrique sur `/api/pay/` au niveau WAF (sur le modèle
   de `limit_req_zone` déjà en place pour `/api/auth/login`), indépendant de toute
   signature applicative — seul mécanisme qui tiendrait face à un attaquant qui
   changerait de signature à chaque requête.

Scénario de test associé : `attack/dos_attack_rotating_ua.py` +
`scripts/attack_burst_rotating_ua.sh` (lancement en conteneur jetable sur le réseau
Docker `public`, même principe que `scripts/attack_burst.sh`).
