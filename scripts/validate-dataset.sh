#!/bin/bash
set -e

echo "📊 Validating RL4-Trainer dataset..."
echo ""

# Vérifier que repo-list.txt existe
if [ ! -f "datasets/repo-list.txt" ]; then
  echo "❌ datasets/repo-list.txt not found!"
  exit 1
fi

# Compter les repos
REPO_COUNT=$(grep -v '^#' datasets/repo-list.txt | grep -v '^$' | wc -l | tr -d ' ')
echo "📦 Total repositories: $REPO_COUNT"

if [ "$REPO_COUNT" -lt 500 ]; then
  echo "⚠️  Warning: Only $REPO_COUNT repos found (recommended: 500+)"
else
  echo "✅ Dataset size is adequate"
fi

echo ""
echo "📂 Sample repositories (first 20):"
head -20 datasets/repo-list.txt

echo ""
echo "💾 Corpus disk usage:"
if [ -d "datasets/corpus" ] && [ "$(ls -A datasets/corpus 2>/dev/null)" ]; then
  du -sh datasets/corpus/* 2>/dev/null | head -20 || echo "  (no repos cloned yet)"
else
  echo "  (no repos cloned yet)"
fi

echo ""
echo "✅ Validation complete"

