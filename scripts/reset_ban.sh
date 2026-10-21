#!/usr/bin/env bash
# Réinitialise les bans du WAF pour repartir d'une démo propre.
#
# Supprime les bans DYNAMIQUES écrits par la remédiation (ban-*.conf, UA et IP), garde les
# 00-base.conf versionnés, puis recharge nginx (SIGHUP) pour qu'il relise les listes.
# À lancer sur le PC HÔTE (là où tourne Docker), PAS sur le PC Attaquant.
#
# Astuce démo : lance ceci JUSTE avant la séquence « 1re attaque → ban → 2e attaque ».
# Si le détecteur est encore en alerte, la remédiation peut re-bannir presque aussitôt :
# attends que le score d'anomalie soit redescendu avant de relancer l'attaque.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[reset] suppression des bans dynamiques (UA + IP)…"
rm -f infra/waf/banlist-ua/ban-*.conf infra/waf/banlist/ban-*.conf

echo "[reset] rechargement du WAF (SIGHUP)…"
docker compose kill -s HUP waf

echo "[reset] vérification (attendu : 401, plus 403) :"
curl -sk -o /dev/null -w "  ResilienceDoS/1.0 -> HTTP %{http_code}\n" \
  -X POST https://localhost/api/pay/transactions \
  -H "Content-Type: application/json" -H "Authorization: Bearer x" \
  -A "ResilienceDoS/1.0" -d '{"dst":2,"amount":1}' --max-time 5 || true
echo "[reset] terminé."
