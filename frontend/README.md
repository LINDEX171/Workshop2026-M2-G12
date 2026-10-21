# frontend

## 1. Rôle
Interface web React (Vite + TypeScript + Tailwind) : paiement, supervision (AVANT/PENDANT/APRÈS)
et assistant. Build statique servi par Nginx, derrière le WAF.

## 2. Pages / routes
| Onglet | Contenu | Appels API (via le WAF) |
|---|---|---|
| Paiement | Login, soldes, virement, transactions | `/api/auth/login`, `/api/pay/*` |
| Supervision | Bandeau d'état, pastilles services, jauge d'anomalie, journal | `/api/status` |
| Assistant (bulle flottante, toutes les pages) | Questions sur la doc, conversation conservée jusqu'à la déconnexion | `/api/assistant/ask` |
| Aucune (technique) | Healthcheck du conteneur | `GET /health` → 200 |

## 3. Variables d'environnement (build)
| Nom | Rôle | Défaut |
|---|---|---|
| `VITE_GRAFANA_URL` | Lien « Grafana » de l'en-tête | http://localhost:3000 |

## 4. Dépendances
Appelle les services **uniquement** via le WAF (réseaux `public` + `app`). Le jeton JWT reste
en mémoire (jamais `localStorage`).

## 5. Lancer seul
```bash
docker compose --profile core up -d frontend waf
# dev à chaud : cd frontend && npm install && npm run dev (proxy /api vers https://localhost)
```

## 6. Tester
```bash
cd frontend && npm install && npm run typecheck && npm run build
```

## 7. Métriques
Aucune (statique). Supervisé par le healthcheck Nginx.

## 8. Vigilance / limites
- Le token en mémoire impose de se reconnecter après un rechargement (choix de sécurité).
- Après modification du routage WAF : `docker compose up -d --force-recreate waf`.
