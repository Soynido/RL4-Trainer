#!/bin/bash

# Script de test pour l'ASTParserWorker
# Usage: bash tests/test-ast.sh

set -e

echo "🧪 Testing AST Parser Worker..."
echo ""

# Nettoyer les anciens résultats
rm -rf .reasoning_rl4/tmp/test

# Compiler TypeScript
echo "📦 Building TypeScript..."
npm run build --silent

# Exécuter le test avec tsx
echo ""
echo "🚀 Running AST Parser test..."
npx tsx tests/test-ast-parser.ts

echo ""
echo "✅ AST Parser test completed successfully!"

