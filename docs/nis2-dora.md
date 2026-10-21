# NIS2 / DORA — analyse conseil

Lecture des exigences NIS2 et DORA pertinentes pour une plateforme de paiement, et
positionnement **honnête** de ce prototype de 4 jours : ce qui est démontré vs ce qui
relève d'une démarche organisationnelle non démontrable par une maquette.

## Démarche
Posture de conseil à une direction : pour chaque exigence, on distingue l'**élément vérifiable**
dans le projet et la **recommandation** pour une mise en conformité réelle.

## NIS2 (directive UE 2022/2555)
| Exigence (art. 21) | Démontré dans le projet | Recommandation |
|---|---|---|
| Analyse de risque & sécurité SI | [EBIOS RM](ebios/ebios-rm.md) relié à l'archi | Revue périodique, étendre aux dépendances |
| Gestion des incidents | Détection ML + remédiation + journal `/events` + SOC | Procédures de notification, astreinte |
| Continuité / sauvegarde | [PCA/PRA](pca-pra.md), reprise auto mesurée | Sauvegardes DB planifiées + tests de restauration |
| Sécurité de l'acquisition/dev | Cloisonnement, moindre privilège, conteneurs non-root | SAST/DAST en CI, gestion des vulnérabilités |
| Chiffrement / cryptographie | TLS au WAF, secrets SOPS+age, JWT | PKI interne, rotation régulière des secrets |
| Contrôle d'accès | Rôles SQL limités, JWT, pas d'admin ouverte | MFA, revue des accès |
| Notification sous 24/72 h | Journaux horodatés exploitables (Loki) | Processus et registre d'incidents |

## DORA (règlement UE 2022/2554 — secteur financier)
| Pilier | Démontré | Recommandation |
|---|---|---|
| Gestion du risque TIC | Architecture cloisonnée, EBIOS | Gouvernance TIC formalisée, cartographie |
| Gestion des incidents TIC | Remédiation Zero-Touch + classification (`type`) | Classification réglementaire, reporting |
| **Tests de résilience** | `demo_replay.sh` (10/10), scénarios d'attaque | Tests d'intrusion menés par des tiers, TLPT |
| Risque lié aux tiers TIC | Images épinglées par version | Registre des fournisseurs, clauses contractuelles |
| Partage d'informations | Dashboard SOC | Participation aux dispositifs sectoriels |

## Arbitrages et limites (prototype 4 jours)
- **Démontrable** : résilience technique (détection, reprise, RTO), cloisonnement, blocage WAF,
  secrets chiffrés, journalisation.
- **Non démontrable ici** (organisationnel/temporel) : notification réglementaire, audits tiers,
  TLPT, sauvegardes planifiées, MFA, PKI, gouvernance et registres.
- **Recommandation prioritaire** à une direction : industrialiser sauvegardes + tests de
  restauration, ajouter MFA et une CI de sécurité, formaliser le processus d'incident.
