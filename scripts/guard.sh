#!/bin/bash

# 🛡️ Guard - Watchdog mémoire du RL4-Trainer
# Surveille la taille du workspace et déclenche compactage si nécessaire

set -e

MAX_SIZE_GB=9.5
WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$WORKSPACE_DIR"

# Calculer taille actuelle (en Go)
CURRENT_SIZE=$(du -sh . 2>/dev/null | cut -f1)

# Extraire la valeur numérique (gère M, G, T)
if [[ $CURRENT_SIZE == *"G"* ]]; then
  CURRENT=$(echo "$CURRENT_SIZE" | sed 's/G.*//')
elif [[ $CURRENT_SIZE == *"M"* ]]; then
  CURRENT_MB=$(echo "$CURRENT_SIZE" | sed 's/M.*//')
  CURRENT=$(echo "scale=2; $CURRENT_MB / 1024" | bc)
else
  CURRENT=0
fi

echo "📊 Workspace: $CURRENT_SIZE (limit: ${MAX_SIZE_GB}G)"

# Vérifier si dépassement
if (( $(echo "$CURRENT > $MAX_SIZE_GB" | bc -l) )); then
  echo "⚠️  Workspace ${CURRENT}G > ${MAX_SIZE_GB}G → COMPACTAGE FORCÉ"
  
  # Sauvegarder état avant compactage
  timestamp=$(date +%Y%m%d_%H%M%S)
  echo "💾 Sauvegarde état pré-compactage..."
  mkdir -p .reasoning_rl4/backups
  cp .reasoning_rl4/kernel/*.json .reasoning_rl4/backups/ 2>/dev/null || true
  
  # Compactage
  echo "🗜️  Compactage en cours..."
  npm run compact --silent
  
  # Auto-dump si nécessaire
  echo "📦 Auto-dump..."
  npm run auto-dump --silent
  
  # Nettoyer anciens ledgers
  echo "🧹 Nettoyage anciens ledgers..."
  bash scripts/clean-old-ledgers.sh
  
  # Vérifier nouvelle taille
  NEW_SIZE=$(du -sh . 2>/dev/null | cut -f1)
  echo "✅ Compactage terminé: $CURRENT_SIZE → $NEW_SIZE"
else
  echo "✅ Taille OK (${CURRENT}G / ${MAX_SIZE_GB}G)"
fi

# Afficher état
echo ""
echo "📈 État du workspace:"
echo "   Patterns:     $(wc -l < .reasoning_rl4/patterns.jsonl 2>/dev/null || echo 0) lignes"
echo "   Correlations: $(wc -l < .reasoning_rl4/correlations.jsonl 2>/dev/null || echo 0) lignes"
echo "   Forecasts:    $(wc -l < .reasoning_rl4/forecasts.jsonl 2>/dev/null || echo 0) lignes"
echo "   Ledger:       $(wc -l < .reasoning_rl4/ledger/cycles.jsonl 2>/dev/null || echo 0) cycles"

