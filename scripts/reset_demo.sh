#!/usr/bin/env bash
# Remet l'environnement à l'état AVANT entre deux démos, en < 60 s (reset léger) :
#   - supprime les bannissements dynamiques + recharge le WAF
#   - vide le journal de remédiation (redémarrage du remediator)
# Pour une remise à zéro COMPLÈTE (volumes, base), utiliser ansible/reset.yml.
# Usage : ./scripts/reset_demo.sh
set -u
cd "$(dirname "$0")/.."

echo "== Reset démo (retour à l'état AVANT) =="
find infra/waf/banlist infra/waf/banlist-ua -name 'ban-*.conf' -delete 2>/dev/null
docker compose kill -s HUP waf >/dev/null 2>&1 && echo "+ bannissements levés, WAF rechargé"
# Redémarre remediator (vide le journal) ET detector (réarme la détection : efface le
# délai anti-rafale de 60 s pour un RTO constant entre deux démos).
docker compose restart remediator detector >/dev/null 2>&1 && echo "+ journal vidé, détection réarmée"

# Attendre que le remediator réponde de nouveau
for _ in $(seq 1 15); do
  if docker compose exec -T remediator python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health',timeout=2)" >/dev/null 2>&1; then
    echo "+ remediator prêt"; break
  fi
  sleep 1
done

# Attendre que le detector ait rechargé son modèle (sinon pas de score)
for _ in $(seq 1 20); do
  if docker compose exec -T detector python -c "import urllib.request,json,sys; sys.exit(0 if json.load(urllib.request.urlopen('http://localhost:8000/score',timeout=2))['model_loaded'] else 1)" >/dev/null 2>&1; then
    echo "+ detector prêt (modèle chargé)"; break
  fi
  sleep 1
done
echo "Environnement prêt pour une nouvelle démo."
