# Analyse de risque — EBIOS Risk Manager

Analyse reliée à l'architecture réelle de RESILIENCE-ALPHA. Les objectifs RTO/RPO sont
cohérents avec le RTO mesuré en Phase 11 (~13–20 s).

## Atelier 1 — Cadrage et valeurs métier
| Valeur métier | Bien support | Événement redouté | Gravité |
|---|---|---|---|
| Service de paiement disponible | payment-api, db, waf | Indisponibilité (DoS) | **Critique** |
| Intégrité des transactions | db (schéma payments) | Altération/incohérence des soldes | Critique |
| Confidentialité des comptes | auth, auth-db, db | Vol d'identifiants / de données | Majeure |
| Confiance / traçabilité | Loki, Grafana SOC | Perte de journaux, action non tracée | Modérée |

## Atelier 2 — Sources de risque
Attaquant opportuniste (script kiddie), attaquant ciblé (déni de service concurrentiel),
erreur interne. Objectif principal retenu : **nuire à la disponibilité** du service de paiement.

## Atelier 3 — Scénarios stratégiques
1. Depuis Internet/LAN → WAF → payment-api : saturation (DoS applicatif).
2. Tentative de compromission : injection SQL / XSS via le WAF.
3. Vol de compte : brute force sur l'authentification.

## Atelier 4 — Scénarios opérationnels
| # | Chemin d'attaque | Mesures en place |
|---|---|---|
| 1 DoS | flood `/api/pay/transactions` → latence/CPU | Détection ML → remédiation (ban signature + restart) → preuve de reprise |
| 2 SQLi/XSS | charges malveillantes via le WAF | ModSecurity + OWASP CRS (403), requêtes paramétrées, moindre privilège SQL |
| 3 Brute force | rafale de logins | Hash bcrypt, rate limit WAF (429), alerte SOC Grafana, journalisation IP |
| Latéral | rebond auth → base paiements | **Cloisonnement** : auth hors réseau `data` |
| Exfiltration socket Docker | abus du remediator | docker-socket-proxy restreint, pas de port public, pas d'admin ouverte |

## Atelier 5 — Traitement du risque
| Événement redouté | Mesure | Risque résiduel |
|---|---|---|
| DoS | Détection ML + remédiation Zero-Touch | Attaque « basse et lente » sous le seuil ; IP source masquée (ban par signature) |
| Altération données | Rôles SQL limités, journal append-only, `restore_db.yml` | Restauration = squelette (sauvegardes à industrialiser) |
| Vol de compte | bcrypt + rate limit + SOC | Pas de MFA (hors périmètre maquette) |
| Perte de preuve | Logs JSON centralisés Loki | Rétention courte (démo) |

## Objectifs de sécurité
- **RTO** (disponibilité du paiement) : cible < 60 s ; **mesuré ~13–20 s**.
- **RPO** : ~0 pour les transactions validées (écrites en base de façon atomique, non rejouées).
- Disponibilité visée en démo : 100 % de reprise autonome (10/10 mesuré).
