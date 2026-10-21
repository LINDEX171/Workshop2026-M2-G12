# Runbook — Tentatives de compromission (SQLi / XSS / brute force)

Contrairement au DoS (disponibilité), ces attaques visent à **voler ou altérer**. La réponse
est la **prévention** (WAF, moindre privilège) et la **surveillance** (SOC), pas le redémarrage.

## Injection SQL / XSS / path traversal
- **Symptôme** : pics de `403` dans les logs WAF, visibles dans le dashboard SOC.
- **Défense en place** : ModSecurity + OWASP CRS en mode blocage ; requêtes SQL paramétrées ;
  rôle `payuser` sans DELETE/UPDATE sur les transactions.
- **Vérifier** : `./scripts/attack.sh sqli_probe.py` → toutes les charges doivent être `403`.
- **Si une charge passe (2xx)** : traiter comme incident — isoler, corriger la requête/validation,
  ajouter une règle WAF, journaliser.

## Brute force d'authentification
- **Symptôme** : nombreux `login_failed` (vue SOC), alerte Grafana `>10 échecs/min`.
- **Défense en place** : hash bcrypt, limite WAF (`429`, 30/min), journalisation de l'IP.
- **Vérifier** : `./scripts/attack.sh bruteforce_auth.py --attempts 60` → surtout `401` puis `429`.
- **Escalade** : si des `200` apparaissent, compromission possible → forcer le changement du
  mot de passe, revoir les accès, analyser les journaux.

## Rappel
La remédiation automatique (ban + restart) concerne la **disponibilité**. Pour une
compromission, ne pas « redémarrer pour résoudre » : prévenir, détecter, corriger, tracer.
