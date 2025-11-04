#!/bin/bash
set -e

echo "🧹 Nettoyage des anciens ledgers..."
echo "═══════════════════════════════════════════════════════════"

# Sauvegarder le dernier fichier (le plus récent)
LATEST_LEDGER=$(ls -t .reasoning_rl4/ledger/cycles*.jsonl 2>/dev/null | head -1)

if [ -z "$LATEST_LEDGER" ]; then
    echo "❌ Aucun ledger trouvé"
    exit 1
fi

echo "📋 Dernier ledger: $(basename $LATEST_LEDGER)"
echo ""

# Compter les fichiers avant
BEFORE_COUNT=$(ls .reasoning_rl4/ledger/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
BEFORE_SIZE=$(du -sh .reasoning_rl4/ledger/ | cut -f1)

echo "📊 Avant nettoyage:"
echo "  Fichiers: $BEFORE_COUNT"
echo "  Taille: $BEFORE_SIZE"
echo ""

# Supprimer tous les anciens fichiers sauf le dernier
echo "🗑️  Suppression des anciens fichiers..."
ls -t .reasoning_rl4/ledger/cycles*.jsonl | tail -n +2 | xargs rm -f

# Compter après
AFTER_COUNT=$(ls .reasoning_rl4/ledger/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
AFTER_SIZE=$(du -sh .reasoning_rl4/ledger/ | cut -f1)

echo ""
echo "📊 Après nettoyage:"
echo "  Fichiers: $AFTER_COUNT"
echo "  Taille: $AFTER_SIZE"
echo ""

SAVED=$((BEFORE_COUNT - AFTER_COUNT))
echo "✅ $SAVED fichiers supprimés"
echo "💾 Espace libéré: Passage de $BEFORE_SIZE à $AFTER_SIZE"
echo ""
echo "═══════════════════════════════════════════════════════════"

