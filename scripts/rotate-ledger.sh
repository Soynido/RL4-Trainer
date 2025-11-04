#!/bin/bash
set -e

THRESHOLD_GB=10
LEDGER_DIR=".reasoning_rl4/ledger"
ARCHIVE_DIR=".reasoning_rl4/archives"
CORPUS_DIR="datasets/corpus"

# Créer le dossier archives si nécessaire
mkdir -p "$ARCHIVE_DIR"

# Mesure la taille actuelle (en Go)
CURRENT_GB=$(du -sk . | awk '{print $1/1024/1024}')

echo "💾 Workspace actuel : ${CURRENT_GB} Go"

if (( $(echo "$CURRENT_GB > $THRESHOLD_GB" | bc -l) )); then
  echo "⚠️  Taille > ${THRESHOLD_GB} Go — rotation en cours..."
  
  TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
  
  # 1️⃣ Compacte le ledger courant
  echo "🧩 Compactage du ledger..."
  find "$LEDGER_DIR" -type f -name "*.jsonl" -print0 | sort -z | xargs -0 cat > "$ARCHIVE_DIR/ledger-$TIMESTAMP.jsonl"
  
  # 2️⃣ Compression et archivage
  echo "📦 Compression..."
  gzip -9 "$ARCHIVE_DIR/ledger-$TIMESTAMP.jsonl"
  ARCHIVE_SIZE=$(du -sh "$ARCHIVE_DIR/ledger-$TIMESTAMP.jsonl.gz" | awk '{print $1}')
  echo "  → Archive créée: $ARCHIVE_SIZE"
  
  # 3️⃣ Purge des cycles anciens
  echo "🧹 Suppression des cycles et corpus temporaires..."
  rm -rf "$LEDGER_DIR"/*
  rm -rf "$CORPUS_DIR"/*
  
  # 4️⃣ Conservation du kernel
  KERNEL_SIZE=$(du -sh .reasoning_rl4/kernel 2>/dev/null | awk '{print $1}' || echo "0B")
  echo "✅ Kernel conservé : $KERNEL_SIZE"
  
  NEW_SIZE=$(du -sk . | awk '{print $1/1024/1024}')
  echo "✅ Nouveau workspace allégé : ${NEW_SIZE} Go"
  echo "💾 Espace libéré : $(echo "$CURRENT_GB - $NEW_SIZE" | bc) Go"
else
  echo "✅ Espace OK ($CURRENT_GB Go / $THRESHOLD_GB Go max), aucune rotation nécessaire."
fi

