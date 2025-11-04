# État du Pipeline Cognitif RL4

**Date** : 2025-11-04  
**Version** : 1.1.0 (Enrichissements comportementaux)

---

## 🎯 Vision Globale

Le RL4-Trainer construit un système d'**intelligence structurelle** en 7 étapes :

```
AST Features → Patterns → Correlations → Forecasts → ADRs → Kernel → Itération
   (✅)          (⏳)         (⏳)          (⏳)       (✅)      (⏳)      (⏳)
```

**Objectif final** : Une IA capable de comprendre, anticiper et recommander des décisions techniques basées sur des milliers de repos analysés.

---

## ✅ Étape 1 : AST Features (TERMINÉ)

### Ce qui fonctionne

**Parsing syntaxique** :
- ✅ Extraction fonctions, classes, imports, exports, variables
- ✅ Calcul de complexité (lignes, paramètres, branches cyclomatiques)
- ✅ Détection fichiers de test

**Enrichissements comportementaux** :
- ✅ **Dépendances inter-fichiers** : Traçage `A.ts → B.ts`
- ✅ **Graphe d'appels** : Qui appelle qui, appels async détectés
- ✅ **Cohérence de tests** : Fonctions testées vs non testées

### Résultats de test

**Test simple** (`npm run test:ast`) :
```
✅ 4 features extraites
   - 2 fonctions (hello: complexity 3)
   - 1 import (./main)
   - 1 export
```

**Test enrichi** (`npx tsx tests/test-ast-enriched.ts`) :
```
✅ 47 features extraites
   - 3 dépendances inter-fichiers détectées
   - 24 appels de fonction (hello: 3×, fetch: 2×, test: 3×)
   - Graphe de dépendances fonctionnel
```

### Output

**Format JSONL** : `.reasoning_rl4/tmp/ast_*.jsonl`

Exemple :
```json
{
  "repo": "sample-repo",
  "commit": "HEAD",
  "file": "/path/to/utils.ts",
  "type": "dependency",
  "name": "./main",
  "complexity": 0,
  "context": {
    "from": "/path/to/utils.ts",
    "to": "./main",
    "dependencies": 1,
    "hasTest": false
  }
}
```

### Fichiers créés

| Fichier | Description | Lignes |
|---------|-------------|--------|
| `trainer/workers/ASTParserWorker.ts` | Worker d'analyse AST enrichi | 501 |
| `tests/test-ast-parser.ts` | Test simple | 102 |
| `tests/test-ast-enriched.ts` | Test enrichissements | 140 |
| `tests/test-ast.sh` | Script bash de test | 15 |
| `tests/mocks/sample-repo/src/utils.ts` | Fichier test avec dépendances | 20 |
| `tests/mocks/sample-repo/src/utils.test.ts` | Fichier test de couverture | 14 |

---

## ⏳ Étape 2 : Pattern Learning Engine V2 (À VENIR)

### Objectif

Convertir des milliers de features AST en **patterns comportementaux récurrents**.

### Ce qui sera implémenté

**a. Extraction de séquences temporelles**

Parcourir les commits et observer les transitions :
```javascript
{
  sequence: ['import', 'refactor', 'test'],
  frequency: 12,
  repos: ['repo-A', 'repo-B']
}
```

**b. Groupement de patterns similaires**

Algorithme simple :
```javascript
const patternKey = sequence.join('>');
patterns[patternKey] = (patterns[patternKey] || 0) + 1;
```

**c. Calcul de pattern confidence score**

Basé sur :
- Récurrence : `frequency / total_sequences`
- Proximité temporelle : `Δ commits`
- Cohérence fonctionnelle : `test` suit toujours `refactor`

Score : `0.0` à `1.0`

### Output attendu

**Format** : `.reasoning_rl4/patterns.jsonl`

```json
{
  "pattern": "import>refactor>test",
  "confidence": 0.87,
  "frequency": 134,
  "repos": 45,
  "avgLag": 2.3
}
```

### Tâche

**#16** - Pattern Learning Engine V2 (⏳ TODO)

---

## ⏳ Étape 3 : Correlation Engine V2 (À VENIR)

### Objectif

Relier les patterns entre eux de manière **causale**.

### Ce qui sera implémenté

Détecter :
> Quand `feature_without_test` apparaît,  
> `bugfix` suit dans 60% des cas à 3 commits d'écart.

### Output attendu

**Format** : `.reasoning_rl4/correlations.jsonl`

```json
{
  "cause": "feature_without_test",
  "effect": "bugfix",
  "strength": 0.6,
  "lag": 3,
  "samples": 234
}
```

### Impact

Ce fichier devient le **cerveau causal** du RL4. C'est à partir de lui que le moteur peut commencer à **prédire**.

### Tâche

**#17** - Correlation Engine V2 (⏳ TODO, dépend de #16)

---

## ⏳ Étape 4 : Forecast Engine V3 (À VENIR)

### Objectif

Anticiper ce qu'un pattern va générer.

### Ce qui sera implémenté

Utiliser les corrélations pour estimer :
> Ce repo vient de générer `feature_without_test`  
> → 60% de chances qu'un `bugfix` arrive dans ≤ 3 commits.

### Output attendu

**Format** : `.reasoning_rl4/forecasts.jsonl`

```json
{
  "predictedPattern": "bugfix",
  "basedOn": ["feature_without_test"],
  "confidence": 0.6,
  "horizon": 3,
  "timestamp": "2025-11-04T01:00:00Z"
}
```

### Impact

Le RL4 ne lit plus, il **anticipe**.  
Il raisonne dans le temps.

### Tâche

**#18** - Forecast Engine V3 (⏳ TODO, dépend de #17)

---

## ✅ Étape 5 : ADR Generator V2 (EXISTANT, À ENRICHIR)

### État actuel

✅ Le module existe déjà dans `feedback/FeedbackEngine.ts`  
✅ Génère des meta-ADRs basés sur templates

### Ce qui sera amélioré

**Enrichissement avec forecasts réels** :

Actuellement :
```
Template générique → ADR générique
```

Futur :
```
Forecast réel → ADR actionnable spécifique
```

Exemples :
- `"Refactor probable → Planifier tests unitaires"`
- `"Bugfix imminent → Audit sécurité conseillé"`
- `"Import non testé → Risque de régression élevé"`

### Tâche

**#19** - ADR Generator V2 (⏳ TODO, dépend de #18)

---

## ⏳ Étape 6 : RL4 Kernel Consolidation (À VENIR)

### Objectif

Consolider et **persister l'état cognitif global** du système.

### Ce qui sera implémenté

**Fichier** : `.reasoning_rl4/kernel/state.json`

```json
{
  "repos": 200,
  "patterns": 8123,
  "correlations": 166421,
  "forecasts": 924,
  "adrs": 103,
  "meta": {
    "avgConfidence": 0.72,
    "lastTraining": "2025-11-04T01:00:00Z",
    "totalCommitsAnalyzed": 45823
  }
}
```

### Impact

Le RL4 devient **portable** :
- Charger le kernel dans un autre workspace
- Pas besoin de tout réentraîner
- Poids cognitif persistant

### Tâche

**#20** - RL4 Kernel Consolidation (⏳ TODO, dépend de #19)

---

## ⏳ Étape 7 : Entraînement Itératif (À VENIR)

### Objectif

Automatiser le cycle : **Entraîner → Consolider → Compacter**

### Workflow

```bash
# 1. Entraîner sur un batch
npm run train -- --batch 200

# 2. Consolider patterns/correlations dans kernel
npm run consolidate

# 3. Compacter (dump anciens cycles)
npm run compact

# Résultat : workspace < 10 Go
```

### Impact

Système d'**entraînement cognitif incrémental** :
- Apprentissage continu
- Pas de réentraînement complet
- Gestion mémoire optimisée

### Tâche

**#21** - Entraînement Itératif (⏳ TODO, dépend de #20)

---

## 📊 Métriques Actuelles

| Métrique | Valeur |
|----------|--------|
| **Features AST extraites** | 47 (test enrichi) |
| **Dépendances détectées** | 3 |
| **Appels de fonction** | 24 |
| **Fichiers de test créés** | 4 |
| **Code TypeScript** | ~1200 lignes |
| **Tests validés** | ✅ 2/2 |
| **Pipeline complet** | 14% (1/7 étapes) |

---

## 🚀 Prochaines Actions

### Court terme (1-2 jours)

1. **#16** : Implémenter Pattern Learning Engine V2
   - Extraire séquences temporelles
   - Grouper patterns similaires
   - Calculer confidence scores

2. **#17** : Implémenter Correlation Engine V2
   - Détecter corrélations causales
   - Calculer strength et lag

### Moyen terme (3-5 jours)

3. **#18** : Implémenter Forecast Engine V3
4. **#19** : Enrichir ADR Generator avec forecasts réels
5. **#20** : Créer Kernel Consolidation

### Long terme (1 semaine)

6. **#21** : Automatiser entraînement itératif
7. **Production** : Entraîner sur 1000+ repos
8. **Analyse** : Valider qualité des forecasts

---

## 🧠 Vision Finale

Une fois toutes les étapes en place, le RL4 pourra :

✅ **Comprendre** la structure d'un repo inconnu  
✅ **Reconnaître** des comportements récurrents  
✅ **Anticiper** des actions probables  
✅ **Recommander** des décisions techniques via ADRs

Ce n'est pas de la "génération de texte" :  
**C'est une IA d'analyse et d'intuition structurée.**

---

## 📁 Fichiers Clés

| Fichier | Rôle | État |
|---------|------|------|
| `trainer/workers/ASTParserWorker.ts` | Parsing AST enrichi | ✅ Opérationnel |
| `kernel/engines/PatternLearningEngine.ts` | Patterns (V1 existant) | ⚠️ À enrichir (V2) |
| `kernel/engines/CorrelationEngine.ts` | Corrélations (V1 existant) | ⚠️ À enrichir (V2) |
| `kernel/engines/ForecastEngine.ts` | Forecasts (V1 existant) | ⚠️ À enrichir (V3) |
| `feedback/FeedbackEngine.ts` | ADRs (V1 existant) | ⚠️ À enrichir (V2) |
| `.reasoning_rl4/kernel/state.json` | État cognitif | ❌ À créer |

---

**Prochaine étape** : Pattern Learning Engine V2 (#16)  
**Référence** : `tasks.md` lignes 174-184

