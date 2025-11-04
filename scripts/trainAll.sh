#!/bin/bash
set -e

# Configuration
BATCH_SIZE=200
REPOS_LIST="datasets/repo-list.txt"
ARCHIVES_DIR="archives/batches"
SUBSTRATE_DIR="archives/substrate"

# Créer les dossiers d'archivage
mkdir -p "$ARCHIVES_DIR"
mkdir -p "$SUBSTRATE_DIR"

# Compter le nombre total de repos
TOTAL=$(grep -v '^#' "$REPOS_LIST" | grep -v '^$' | wc -l | tr -d ' ')
BATCH_COUNT=$(( (TOTAL + BATCH_SIZE - 1) / BATCH_SIZE ))

echo "🧠 RL4-TRAINER - PROGRESSIVE TRAINING LOOP"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Total repos: $TOTAL"
echo "  Batch size: $BATCH_SIZE"
echo "  Batches: $BATCH_COUNT"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Boucle sur chaque batch
for ((i=0; i<BATCH_COUNT; i++)); do
  BATCH_NUM=$((i+1))
  START=$((i * BATCH_SIZE + 1))
  END=$((START + BATCH_SIZE - 1))
  
  echo ""
  echo "🔄 BATCH $BATCH_NUM/$BATCH_COUNT (repos $START–$END)"
  echo "═══════════════════════════════════════════════════════════"
  
  # Extraire le batch
  echo "📋 Extraction du batch..."
  grep -v '^#' "$REPOS_LIST" | grep -v '^$' | sed -n "${START},${END}p" > batch_tmp.txt
  
  BATCH_ACTUAL=$(wc -l < batch_tmp.txt | tr -d ' ')
  echo "  → $BATCH_ACTUAL repos dans ce batch"
  
  # Lancer l'entraînement
  echo ""
  echo "🚀 Entraînement batch $BATCH_NUM..."
  REPO_LIST_PATH=batch_tmp.txt npm run train -- --max-repos $BATCH_SIZE --concurrency 8
  
  echo ""
  echo "📦 Compactage du ledger..."
  node dist/scripts/compact-ledger.js
  
  echo ""
  echo "🗜️  Archivage batch $BATCH_NUM..."
  tar -czf "$ARCHIVES_DIR/ledger_batch_$BATCH_NUM.tar.gz" .reasoning_rl4/ledger/*.jsonl
  ARCHIVE_SIZE=$(du -sh "$ARCHIVES_DIR/ledger_batch_$BATCH_NUM.tar.gz" | cut -f1)
  echo "  → Archive: $ARCHIVE_SIZE (compressed)"
  
  echo ""
  echo "💾 Sauvegarde substrate..."
  cp .reasoning_rl4/kernel/state.json "$SUBSTRATE_DIR/kernel_state_batch_$BATCH_NUM.json"
  
  echo ""
  echo "🧹 Nettoyage batch $BATCH_NUM..."
  rm -rf .reasoning_rl4/ledger/*.jsonl
  rm -rf datasets/corpus/*
  rm -f batch_tmp.txt
  
  FREED=$(du -sh .reasoning_rl4/ | cut -f1)
  echo "  → Espace libéré. Ledger reset à: $FREED"
  
  echo ""
  echo "✅ Batch $BATCH_NUM/$BATCH_COUNT terminé et nettoyé"
  echo "═══════════════════════════════════════════════════════════"
done

echo ""
echo ""
echo "🎉 ENTRAÎNEMENT COMPLET TERMINÉ !"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📦 Archives: $ARCHIVES_DIR/"
echo "🧠 Substrats kernel: $SUBSTRATE_DIR/"
echo ""
echo "🔧 Prochaine étape:"
echo "  → Fusionner les substrats: node scripts/merge-kernel-states.js"
echo ""

