#!/bin/bash
set -e

OUTPUT_FILE="datasets/repo-list.txt"
TEMP_FILE="datasets/repo-list.tmp"

echo "🔍 Fetching repositories from GitHub..."

# Vider le fichier temporaire
> "$TEMP_FILE"

# Query 1: AI Agents & Reasoning
echo "  → AI Agents & Reasoning Systems..."
gh search repos "ai agent" --language TypeScript --stars '>50' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true
gh search repos "reasoning system" --language TypeScript --stars '>50' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true
gh search repos "cognitive" --language TypeScript --stars '>50' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true

# Query 2: AI & LLM Frameworks
echo "  → AI & LLM Frameworks..."
gh search repos "llm" --language Python --stars '>100' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true
gh search repos "gpt" --language Python --stars '>100' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true
gh search repos "openai" --language Python --stars '>100' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true

# Query 3: Developer Tools
echo "  → Developer Tools (VSCode, CLI)..."
gh search repos "vscode extension" --language TypeScript --stars '>50' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true
gh search repos "cli tool" --language TypeScript --stars '>50' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true

# Query 4: Backend & Infrastructure
echo "  → Backend & Infrastructure..."
gh search repos "nestjs" --stars '>50' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true
gh search repos "fastapi" --language Python --stars '>50' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true
gh search repos "express" --language JavaScript --stars '>50' --limit 300 --json url --jq '.[].url' >> "$TEMP_FILE" 2>/dev/null || true

# Nettoyer et dédupliquer
echo "🧹 Cleaning and deduplicating..."
sort -u "$TEMP_FILE" > "$OUTPUT_FILE"
rm "$TEMP_FILE"

# Afficher le résultat
REPO_COUNT=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
echo "✅ $REPO_COUNT unique repositories saved to $OUTPUT_FILE"

if [ "$REPO_COUNT" -lt 500 ]; then
  echo "⚠️  Warning: Only $REPO_COUNT repos found (recommended: 500+)"
fi

