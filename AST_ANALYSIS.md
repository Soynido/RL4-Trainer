# Analyse AST - Enrichissement des Patterns

## 📋 Objectif

L'**ASTParserWorker** analyse les fichiers TypeScript/JavaScript au niveau syntaxique (AST - Abstract Syntax Tree) pour extraire des **patterns de structure, d'intention et de complexité**.

Au lieu d'enregistrer simplement "ce fichier a changé", on enregistre maintenant :
- "ce module a ajouté une fonction exportée"
- "ce contrôleur a été modifié"
- "une dépendance a été supprimée"

## 🏗️ Architecture

```
trainBatch.ts
 │
 ├─ Phase 1: replayGitHistory()      ← Événements Git (commits)
 │
 ├─ Phase 1.5: ASTParserWorker       ← NOUVEAU MAILLON
 │   ├─ Scanner fichiers .ts/.js
 │   ├─ Parser AST via @typescript-eslint/typescript-estree
 │   ├─ Extraire : { type, name, complexity, context }
 │   ├─ Output : .reasoning_rl4/tmp/ast_*.jsonl
 │
 ├─ Phase 2: Charger événements
 │
 ├─ Phase 3: PatternLearningEngine   ← Utilise features AST
 │   └─ CorrelationEngine → ForecastEngine → ADRGenerator
```

## 📦 Structure des Features AST

Chaque feature extraite contient :

```typescript
interface ASTFeature {
  repo: string;              // Nom du repo
  commit: string;            // ID du commit (ou "HEAD" pour l'état actuel)
  file: string;              // Chemin du fichier
  type: 'function' | 'class' | 'import' | 'export' | 'variable';
  name: string;              // Nom de l'élément
  complexity: number;        // Score de complexité (1-10)
  context: {
    lines: number;           // Nombre de lignes
    dependencies: number;    // Nombre de dépendances
    hasTest: boolean;        // Fichier de test ?
    isExported: boolean;     // Élément exporté ?
  };
}
```

## 🧠 Enrichissements Comportementaux (NOUVEAU)

### 1️⃣ Dépendances Inter-Fichiers

Traçage complet des relations entre fichiers :

```jsonl
{
  "type": "dependency",
  "name": "./main",
  "context": {
    "from": "/path/to/utils.ts",
    "to": "./main"
  }
}
```

**Impact** : Permet de construire un **graphe de dépendances** complet du codebase.

### 2️⃣ Graphe d'Appels de Fonction

Détection de tous les appels de fonction avec contexte async :

```jsonl
{
  "type": "call",
  "name": "fetchData",
  "context": {
    "isAsync": true
  }
}
```

**Impact** : Révèle **qui appelle qui** et détecte les patterns d'utilisation.

### 3️⃣ Cohérence de Tests

Détection automatique des fonctions testées vs non testées :

```jsonl
{
  "type": "function",
  "name": "greet",
  "context": {
    "isTested": false  // ⚠️ Fonction sans test détectée
  }
}
```

**Impact** : Identifie les **zones à risque** (code non testé).

---

## 🔍 Exemples de Features Extraites

### Fonction exportée

```jsonl
{
  "repo": "my-app",
  "commit": "HEAD",
  "file": "/path/to/src/utils.ts",
  "type": "function",
  "name": "calculateTotal",
  "complexity": 5,
  "context": {
    "lines": 12,
    "dependencies": 0,
    "hasTest": false,
    "isExported": true
  }
}
```

### Classe avec méthodes

```jsonl
{
  "repo": "my-app",
  "commit": "HEAD",
  "file": "/path/to/src/UserService.ts",
  "type": "class",
  "name": "UserService",
  "complexity": 8,
  "context": {
    "lines": 45,
    "dependencies": 3,
    "hasTest": false,
    "isExported": true
  }
}
```

### Import de dépendance

```jsonl
{
  "repo": "my-app",
  "commit": "HEAD",
  "file": "/path/to/src/index.ts",
  "type": "import",
  "name": "express",
  "complexity": 0,
  "context": {
    "lines": 1,
    "dependencies": 1,
    "hasTest": false,
    "isExported": false
  }
}
```

## 🧮 Calcul de Complexité

Le score de complexité (1-10) est calculé selon :

1. **Nombre de statements** : +0.2 par statement
2. **Nombre de paramètres** : +0.5 par paramètre
3. **Complexité cyclomatique** : +1 par branche (if, switch, loop, ternary)

Exemples :
- `const x = 5;` → Complexité = 1
- `function add(a, b) { return a + b; }` → Complexité = 2
- `function process(data) { if (data) { ... } else { ... } }` → Complexité = 4

## 🚀 Utilisation

### Test Standalone

```bash
# Tester l'analyse AST sur le repo de test
npm run test:ast

# Ou manuellement
bash tests/test-ast.sh
```

### Intégration dans le Pipeline

L'analyse AST est **automatiquement exécutée** lors de l'entraînement :

```bash
# Entraîner un repo (inclut l'analyse AST)
npm run train -- --max-repos 1

# L'analyse AST se déclenche en Phase 1.5
# Les features sont sauvegardées dans .reasoning_rl4/tmp/
```

### Consultation des Résultats

Les features AST sont stockées dans `.reasoning_rl4/tmp/ast_<repo>_<commit>.jsonl` :

```bash
# Voir les features extraites d'un repo
cat .reasoning_rl4/tmp/ast_my-repo_HEAD.jsonl | jq

# Compter les fonctions
cat .reasoning_rl4/tmp/ast_my-repo_HEAD.jsonl | grep '"type":"function"' | wc -l

# Voir les éléments les plus complexes
cat .reasoning_rl4/tmp/ast_my-repo_HEAD.jsonl | jq 'select(.complexity > 7)'
```

## ⚙️ Configuration

### Fichiers Analysés

Par défaut, le worker analyse :
- Extensions : `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- Limite : **100 fichiers max** par repo (pour éviter les analyses trop longues)
- Dossiers ignorés : `node_modules`, `dist`, `build`, `.git`, `coverage`, `vendor`

### Personnalisation

Modifier `trainer/trainBatch.ts` ligne 324 pour ajuster :

```typescript
// Changer la limite de fichiers
return files.slice(0, 200); // 200 fichiers max

// Ajouter des extensions
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];

// Ignorer d'autres dossiers
const ignoreDirs = ['node_modules', 'dist', 'build', '.git', 'test'];
```

## 📊 Impact sur l'Apprentissage

Les features AST enrichissent le **PatternLearningEngine** :

1. **Patterns structurels** : "Ajout d'une classe exportée dans un service"
2. **Patterns de complexité** : "Fonctions complexes (>7) souvent modifiées ensemble"
3. **Patterns de dépendances** : "Import de `express` corrélé avec fichiers serveur"
4. **Prédictions** : "Si ajout d'import `database`, probable création d'une classe DAO"

## 🧪 Validation

### Test 1 : Parsing Simple

Test sur `tests/mocks/sample-repo` :

```bash
npm run test:ast
```

```
✅ AST Parser test PASSED
   - Extracted 4 features
   - Found 2 functions
   - Output saved to .reasoning_rl4/tmp/test
```

Features extraites :
- `function hello` (complexity: 3, lines: 3)
- `import ./main` (complexity: 0)
- `function anonymous` (test function, complexity: 1)

### Test 2 : Enrichissements Comportementaux (NOUVEAU)

Test sur repo avec dépendances :

```bash
npx tsx tests/test-ast-enriched.ts
```

```
✅ ENRICHED AST Parser test PASSED
   📊 47 features extraites
   
   🔗 Dépendances: 3
      - utils.ts → ./main
      - utils.test.ts → ./utils
      - main.test.ts → ./main
   
   📞 Appels de fonction: 24
      - hello: 3× appels
      - fetch: 2× appels (async)
      - test: 3× appels
      - expect: 3× appels
   
   🧪 Couverture:
      ✅ fetchData (testée)
      ✅ processData (testée)
      ❌ greet (NON testée) ⚠️
```

**Impact** : Le système détecte automatiquement que `greet()` n'est pas testée, un signal d'alerte pour le RL4.

## 🔧 Fichiers Modifiés

| Fichier | Description |
|---------|-------------|
| `trainer/workers/ASTParserWorker.ts` | Worker d'analyse AST (nouveau) |
| `trainer/trainBatch.ts` | Intégration Phase 1.5 (lignes 11, 227-239, 324-357) |
| `tests/test-ast-parser.ts` | Script de test standalone (nouveau) |
| `tests/test-ast.sh` | Script bash de validation (nouveau) |
| `package.json` | Ajout dépendance + script `test:ast` |

## 📈 Prochaines Étapes

### Améliorations Possibles

1. **Analyse historique** : Parser chaque commit (checkout) au lieu de HEAD uniquement
2. **Support multi-langages** : Python, Go, Rust via parsers dédiés
3. **Métriques avancées** : Halstead, Maintainability Index
4. **Détection de patterns** : Design patterns (Singleton, Factory, etc.)
5. **Graphe de dépendances** : Relations entre modules

### Utilisation Avancée

Les features AST peuvent être exploitées pour :
- **Prédire les bugs** : Forte complexité + peu de tests = risque élevé
- **Recommander des refactorings** : "Cette fonction est trop complexe, envisager split"
- **Analyser l'évolution** : "Complexité moyenne en augmentation depuis 3 mois"
- **Générer des ADRs** : "Adoption progressive de TypeScript (40% des fichiers)"

---

**Date de mise à jour** : 2025-11-04  
**Version** : 1.0.0  
**Statut** : ✅ Opérationnel

