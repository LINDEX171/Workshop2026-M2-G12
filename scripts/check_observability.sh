#!/usr/bin/env bash
# Vérifie la chaîne d'observabilité (Phase 4) :
#   - Prometheus : chaque cible est UP, règles d'alerte chargées, Alertmanager connecté
#   - Loki : des logs arrivent pour chaque service
#   - Grafana : les dashboards technique et SOC sont provisionnés
set -u
cd "$(dirname "$0")/.."
fail=0
ok()  { echo "✅ $1"; }
ko()  { echo "❌ $1"; fail=1; }

prom() { docker compose exec -T prometheus wget -qO- "http://localhost:9090$1" 2>/dev/null; }

echo "== Prometheus : cibles =="
for job in prometheus auth payment-api detector remediator assistant cadvisor postgres-exporter alertmanager; do
  if prom "/api/v1/query?query=up%7Bjob%3D%22$job%22%7D" | grep -q '"1"\]'; then ok "$job UP"
  else ko "$job DOWN"; fi
done

echo
echo "== Prometheus : alertes =="
rules=$(prom "/api/v1/rules")
for alert in PaymentApiDown HighErrorRate HighLatencyP95; do
  if echo "$rules" | grep -q "\"$alert\""; then ok "règle $alert chargée"; else ko "règle $alert absente"; fi
done
if prom "/api/v1/alertmanagers" | grep -q 'alertmanager:9093'; then ok "Alertmanager connecté"
else ko "Alertmanager non connecté"; fi

echo
echo "== Loki : logs reçus par service =="
labels=$(docker compose exec -T loki wget -qO- "http://localhost:3100/loki/api/v1/label/service/values" 2>/dev/null)
for svc in auth payment-api detector remediator waf frontend db; do
  if echo "$labels" | grep -q "\"$svc\""; then ok "logs de $svc"; else ko "aucun log de $svc"; fi
done

echo
echo "== Grafana : dashboards provisionnés =="
search=$(docker compose exec -T grafana sh -c \
  'wget -qO- "http://admin:$(cat /run/secrets/grafana_admin_password)@localhost:3000/api/search?type=dash-db"' 2>/dev/null)
for uid in resilience-tech resilience-soc; do
  if echo "$search" | grep -q "\"$uid\""; then ok "dashboard $uid"; else ko "dashboard $uid absent"; fi
done

exit $fail
