#!/bin/bash
set -e

echo "🔍 Validation Post-Batch RL4-Trainer"
echo "═══════════════════════════════════════════════════════════"

# 1. Vérifier que le ledger existe et n'est pas vide
echo "📊 1. Vérification du ledger..."
if [ ! -d ".reasoning_rl4/ledger" ]; then
  echo "❌ Ledger directory not found!"
  exit 1
fi

LEDGER_SIZE=$(du -sh .reasoning_rl4/ledger | cut -f1)
echo "   ✓ Ledger size: $LEDGER_SIZE"

# 2. Compter les cycles
CYCLE_COUNT=$(cat .reasoning_rl4/ledger/cycles*.jsonl 2>/dev/null | wc -l | tr -d ' ')
echo "📈 2. Cycles enregistrés: $CYCLE_COUNT"

if [ "$CYCLE_COUNT" -lt 50 ]; then
  echo "   ⚠️  Warning: Only $CYCLE_COUNT cycles found (expected 50+)"
fi

# 3. Vérifier le dernier summary
echo "📋 3. Vérification du training summary..."
LATEST_SUMMARY=$(ls -t .reasoning_rl4/diagnostics/training-summary-*.json 2>/dev/null | head -1)

if [ -z "$LATEST_SUMMARY" ]; then
  echo "   ❌ No training summary found!"
  exit 1
fi

echo "   ✓ Latest summary: $(basename $LATEST_SUMMARY)"

# 4. Extraire les métriques clés
SUCCESS_COUNT=$(cat "$LATEST_SUMMARY" | jq -r '.successful')
FAILED_COUNT=$(cat "$LATEST_SUMMARY" | jq -r '.failed')
TOTAL_REPOS=$(cat "$LATEST_SUMMARY" | jq -r '.totalRepos')

echo "📊 4. Métriques d'entraînement:"
echo "   • Total repos: $TOTAL_REPOS"
echo "   • Successful: $SUCCESS_COUNT ✓"
echo "   • Failed: $FAILED_COUNT"

# 5. Vérifier le taux de succès
SUCCESS_RATE=$(echo "scale=1; $SUCCESS_COUNT * 100 / $TOTAL_REPOS" | bc)
echo "   • Success rate: ${SUCCESS_RATE}%"

if (( $(echo "$SUCCESS_RATE < 95" | bc -l) )); then
  echo "   ⚠️  Warning: Success rate below 95%"
  exit 1
fi

# 6. Vérifier les patterns générés
TOTAL_PATTERNS=$(cat "$LATEST_SUMMARY" | jq '[.results[].stats.patterns] | add')
TOTAL_FORECASTS=$(cat "$LATEST_SUMMARY" | jq '[.results[].stats.forecasts] | add')

echo "🧠 5. Qualité cognitive:"
echo "   • Patterns: $TOTAL_PATTERNS"
echo "   • Forecasts: $TOTAL_FORECASTS"

if [ "$TOTAL_PATTERNS" -lt 1000 ]; then
  echo "   ⚠️  Warning: Low pattern count"
fi

if [ "$TOTAL_FORECASTS" -lt 10 ]; then
  echo "   ⚠️  Warning: Low forecast count"
  exit 1
fi

# 7. Vérifier l'espace disque disponible
DISK_AVAIL=$(df -h .reasoning_rl4 | tail -1 | awk '{print $4}')
echo "💾 6. Espace disque disponible: $DISK_AVAIL"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ VALIDATION RÉUSSIE - Entraînement valide"
echo "═══════════════════════════════════════════════════════════"

