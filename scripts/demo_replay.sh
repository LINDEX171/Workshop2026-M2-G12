#!/usr/bin/env bash
# Rejoue la démo N fois (reset + demo), journalise le RTO et le taux de réussite.
# Objectif du sujet : 10 exécutions, 100 % de reprise autonome.
# Usage : ./scripts/demo_replay.sh [N]   (défaut 10)
set -u
cd "$(dirname "$0")/.."

N=${1:-10}
CSV=demo_rto.csv
echo "run,rto_s,resultat" > "$CSV"
ok=0
sum=0

for i in $(seq 1 "$N"); do
  echo "---------- Démo $i/$N ----------"
  bash scripts/reset_demo.sh >/dev/null 2>&1
  sleep 5
  if bash scripts/demo.sh >"/tmp/demo_run_$i.log" 2>&1 && [ -f /tmp/demo_rto.txt ]; then
    rto=$(cut -d= -f2 /tmp/demo_rto.txt)
    ok=$((ok + 1)); sum=$((sum + rto))
    echo "$i,$rto,OK" >> "$CSV"
    echo "  OK — RTO ${rto}s"
  else
    echo "$i,,ECHEC" >> "$CSV"
    echo "  ECHEC (voir /tmp/demo_run_$i.log)"
  fi
done

echo
echo "===== Bilan : $ok/$N réussites ====="
[ "$ok" -gt 0 ] && echo "RTO moyen ≈ $((sum / ok)) s"
echo "Détail : $CSV"
