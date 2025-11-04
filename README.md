# RL4-Trainer

**Workspace d'entraînement autonome pour le Reasoning Layer 4**

Un système headless capable d'entraîner le RL4 sur des milliers de repositories Git, mesurer ses performances cognitives et générer automatiquement des meta-ADRs de calibration.

---

## 🎯 Objectif

Le **RL4-Trainer** est conçu pour :

- **Rejouer** l'historique Git de milliers de repositories (simulation temporelle)
- **Exécuter** les 4 engines cognitifs du RL4 (Pattern, Correlation, Forecast, ADR)
- **Mesurer** les performances via 6 métriques clés
- **Générer** automatiquement des feedbacks (meta-ADRs) pour améliorer le système
- **Optimiser** le Reasoning Layer 4 de manière itérative et mesurable

---

## 📁 Architecture

```
RL4-Trainer/
├── kernel/                    # Kernel RL4 headless
│   ├── RL4KernelTrainer.ts   # Orchestrateur principal
│   ├── engines/              # 4 engines cognitifs
│   │   ├── PatternLearningEngine.ts
│   │   ├── CorrelationEngine.ts
│   │   ├── ForecastEngine.ts
│   │   └── ADRGeneratorV2.ts
│   └── utils/
│       └── AppendOnlyWriter.ts
│
├── trainer/                   # Orchestration batch
│   ├── trainBatch.ts         # Pipeline complet multi-repos
│   ├── replayGitHistory.ts   # Lecteur Git → événements
│   ├── workers/              # Workers spécialisés
│   │   └── ASTParserWorker.ts # Analyse syntaxique (AST)
│   └── utils/
│       └── logger.ts
│
├── metrics/                   # Calcul et analyse
│   ├── MetricsEngine.ts
│   └── types.ts
│
├── feedback/                  # Génération meta-ADRs
│   ├── FeedbackEngine.ts
│   └── templates/
│       └── metaADR.ts
│
├── datasets/                  # Repos et données
│   ├── repo-list.txt
│   └── corpus/
│
└── .reasoning_rl4/           # Output (ledger, métriques, feedback)
    ├── ledger/
    ├── metrics/
    ├── diagnostics/
    └── feedback/meta_adrs/
```

---

## 🧩 Modules Principaux

### 1. **Kernel Headless** (`kernel/`)

Version sans VS Code du RL4 avec les 4 engines cognitifs :

- **PatternLearningEngine** : Détecte patterns dans les commits (refactor, bugfix, feature, test, etc.)
- **CorrelationEngine** : Trouve corrélations entre patterns (temporelles, spatiales, causales, sémantiques)
- **ForecastEngine** : Génère prédictions basées sur corrélations
- **ADRGeneratorV2** : Crée des ADRs actionnables à partir des forecasts

**Format du ledger** (JSONL) :
```json
{
  "cycleId": 1,
  "timestamp": "2025-11-03T10:00:00.000Z",
  "phases": {
    "patterns": { "detected": [...], "count": 42 },
    "correlations": { "found": [...], "count": 18 },
    "forecasts": { "predictions": [...], "count": 7 },
    "adrs": { "generated": [...], "count": 3 }
  },
  "merkleRoot": "abc123...",
  "prevMerkleRoot": "def456...",
  "metadata": {
    "repo": "repo-name",
    "duration_ms": 1234,
    "events_processed": 156
  }
}
```

### 2. **Trainer Layer** (`trainer/`)

Orchestration batch et replay Git :

- **replayGitHistory.ts** : Parse l'historique Git et génère événements normalisés (JSONL)
- **trainBatch.ts** : Pipeline complet pour traiter N repos en parallèle avec `p-limit`
- **workers/ASTParserWorker.ts** : Analyse syntaxique (AST) des fichiers TypeScript/JavaScript pour extraire patterns de structure et complexité

#### 🧠 Analyse AST (Nouveau)

Le **ASTParserWorker** enrichit les données d'entraînement en analysant la structure syntaxique du code :

- **Extraction** : Fonctions, classes, imports, exports, variables
- **Complexité** : Calcul automatique basé sur lignes, paramètres et branches
- **Contexte** : Détection tests, dépendances, exports
- **Output** : `.reasoning_rl4/tmp/ast_*.jsonl`

**Test** : `npm run test:ast`  
**Documentation complète** : Voir [AST_ANALYSIS.md](./AST_ANALYSIS.md)

**Format événement Git** :
```typescript
{
  type: "commit",
  timestamp: "2025-11-03T10:15:32Z",
  author: "John Doe <john@example.com>",
  hash: "abc123...",
  message: "fix: resolve authentication bug",
  files: [
    { path: "src/auth.ts", status: "modified", additions: 10, deletions: 5 }
  ],
  metadata: { repo: "my-repo", branch: "main" }
}
```

### 3. **Metrics Engine** (`metrics/`)

Calcule 6 métriques essentielles :

1. **pattern_density** : `patterns détectés / événements totaux`
2. **correlation_rate** : `corrélations valides / patterns`
3. **forecast_accuracy** : `forecasts confirmés / total forecasts`
4. **adr_usefulness** : `ADRs appliqués / ADRs générés`
5. **cycle_time_ms** : Durée moyenne par cycle
6. **entropy** : Diversité des patterns (Shannon)

**Output** : `.reasoning_rl4/metrics/stats.json`

### 4. **Feedback Engine** (`feedback/`)

Analyse les métriques et génère **meta-ADRs** :

- Détecte anomalies (seuils configurables)
- Génère recommandations automatiques
- Priorise par impact (critical > high > medium > low)

**Output** : `.reasoning_rl4/feedback/meta_adrs/*.json`

---

## 🚀 Installation

```bash
# Cloner le projet
cd RL4-Trainer

# Installer les dépendances
npm install

# Compiler TypeScript
npm run build
```

**Dépendances** :
- `simple-git` : Lecture historique Git
- `pino` + `pino-pretty` : Logging structuré
- `chalk` : Couleurs console
- `p-limit` : Contrôle concurrence

---

## 🗄️ Pipeline d'Acquisition Dataset

### Étape 1 : Récupérer les Repositories GitHub

Utiliser le script automatisé pour fetcher 1000-5000 repos :

```bash
bash scripts/fetch-repos.sh
```

**Requêtes exécutées** :
- AI Agents & Reasoning Systems (TypeScript, 50+ stars)
- AI & LLM Frameworks (Python, 100+ stars)
- Developer Tools & VSCode Extensions (TypeScript, 50+ stars)
- Backend & Infrastructure (NestJS, FastAPI, Express, 50+ stars)

**Output** : `datasets/repo-list.txt` (~1000-5000 URLs uniques)

**Durée estimée** : 2-5 minutes

### Étape 2 : Valider le Dataset

```bash
bash scripts/validate-dataset.sh
```

Affiche :
- Nombre total de repos
- Échantillon des 20 premiers
- Taille disque du corpus
- Warnings si < 500 repos

### Étape 3 : Entraînement Progressive (Recommandé)

**⚠️ Important** : Pour éviter de saturer la mémoire, utiliser le **Progressive Training Loop** par batches de 200 repos.

#### Option A : Automatique (Recommandé)

```bash
# Entraînement progressif automatique avec rotation
npm run train-all
```

Ce script :
1. Découpe le dataset en batches de 200 repos
2. Entraîne chaque batch (4-5 min/batch)
3. Compacte le ledger → kernel state
4. Archive et purge automatiquement
5. Workspace maintenu **≤ 10 GB constant**

**Durée estimée** : 20-25 min pour 1000 repos

#### Option B : Manuel (Contrôle Total)

```bash
# Batch 1 (repos 1-200)
npm run train -- --max-repos 200 --concurrency 8
npm run compact
npm run auto-dump

# Batch 2 (repos 201-400)
npm run train -- --max-repos 200 --concurrency 8
npm run compact
npm run auto-dump

# ... répéter selon besoin

# Fusion finale
npm run merge-kernels
```

**Pipeline automatique** :
1. Lecture de `datasets/repo-list.txt`
2. Clonage avec `git clone --depth 50` (optimisé)
3. Replay Git : extraction des commits
4. Entraînement RL4 : Pattern → Correlation → Forecast → ADR
5. **Compactage** : Ledger → Kernel State (compression ×3000)
6. **Rotation** : Archive + purge (workspace ≤ 10 GB)
7. Métriques et feedback

**Avantages** :
- ✅ Workspace constant ≤ 10 GB
- ✅ RAM stable 2-4 GB
- ✅ Capacité illimitée (batches rotatifs)
- ✅ Kernel state exploitable (5 KB vs 1 GB)

### Paramètres Recommandés

| Cas d'usage | Méthode | Durée | Stockage Max |
|-------------|---------|-------|--------------|
| Test rapide | `npm run train -- --max-repos 10` | ~30s | 100 MB |
| Validation | `npm run train -- --max-repos 200` | ~4 min | 2 GB |
| Production (1000 repos) | `npm run train-all` (5 batches) | ~20 min | ≤ 10 GB |
| Dataset massif (5000 repos) | `npm run train-all` (25 batches) | ~100 min | ≤ 10 GB |

**Notes** :
- Le clonage avec `--depth 50` réduit la taille des repos (facteur 5-10x)
- Le **Progressive Training Loop** maintient le workspace ≤ 10 GB constant
- Compression automatique du ledger : ratio ×3000
- Kernel state final : 200-500 MB (exploitable pour RL V3)

---

## 📋 Workflow d'Entraînement

### **Phase 1 : Préparation**

Ajouter les repos à traiter dans `datasets/repo-list.txt` :

```txt
# Repos à analyser
https://github.com/user/repo1
https://github.com/user/repo2
/path/to/local/repo3
```

### **Phase 2 : Replay Git (optionnel)**

```bash
# Rejouer un repo spécifique
npm run replay -- --repo /path/to/repo --limit 1000

# Génère: datasets/corpus/<repo-name>/commits.jsonl
```

### **Phase 3 : Entraînement Batch**

```bash
# Entraîner tous les repos (concurrence: 4)
npm run train

# Avec limite
npm run train -- --max-repos 10 --concurrency 2

# Skip replay si déjà fait
npm run train -- --skip-replay
```

**Pipeline automatique** :
```
repo-list.txt → replayGitHistory → events.jsonl
                                      ↓
                                 RL4KernelTrainer
                                      ↓
                                 ledger.jsonl
                                      ↓
                                 MetricsEngine
                                      ↓
                                  stats.json
                                      ↓
                                FeedbackEngine
                                      ↓
                              meta_adrs/*.json
```

### **Phase 4 : Analyse**

```bash
# Calculer métriques + analyse
npm run analyze

# Affiche :
# - Métriques globales et par repo
# - Anomalies détectées
# - Recommandations
```

### **Phase 5 : Feedback**

Les meta-ADRs générés dans `.reasoning_rl4/feedback/meta_adrs/` contiennent :

- **Contexte** : métriques observées vs seuils
- **Recommandation** : actions concrètes à implémenter
- **Impact estimé** : amélioration attendue

**Exemples de meta-ADRs** :
- "Améliorer la détection de patterns" (density faible)
- "Élargir critères de corrélation" (correlation_rate faible)
- "Calibrer ForecastEngine" (forecast_accuracy faible)
- "Optimiser performances" (cycle_time_ms élevé)

---

## ⚙️ Configuration

Éditer `train.config.json` :

```json
{
  "max_repos": 100,
  "concurrency": 4,
  "cycle_interval_ms": 2000,
  "metrics_enabled": true,
  "feedback_enabled": true,
  "output_dir": ".reasoning_rl4",
  "metrics_thresholds": {
    "pattern_density_min": 0.3,
    "correlation_rate_min": 0.5,
    "forecast_accuracy_min": 0.4,
    "cycle_time_max_ms": 3000,
    "entropy_min": 1.5
  }
}
```

---

## 📊 Métriques et Seuils

| Métrique | Description | Seuil | Interprétation |
|----------|-------------|-------|----------------|
| **pattern_density** | Ratio patterns/événements | ≥ 0.3 | Détection suffisante |
| **correlation_rate** | Ratio corrélations/patterns | ≥ 0.5 | Liens trouvés |
| **forecast_accuracy** | Précision prédictions | ≥ 0.4 | Modèle calibré |
| **adr_usefulness** | Utilité ADRs générés | ≥ 0.3 | ADRs pertinents |
| **cycle_time_ms** | Temps par cycle | ≤ 3000 | Performances OK |
| **entropy** | Diversité patterns | ≥ 1.5 | Bonne couverture |

---

## 🧠 ML Integration (Phase 3) - Tuteurs Cognitifs

### **Vision**

> Le but de cette phase n'est pas d'ajouter du calcul, mais de renforcer la mémoire structurante du RL4.
> Les modèles ML servent de **tuteurs cognitifs** pour extraire, pondérer et stabiliser les régularités que le moteur interne détecte déjà.

### **Architecture Hybride**

Le RL4-Trainer intègre maintenant 5 bridges ML qui enrichissent les moteurs natifs :

| Bridge | Layer | Rôle | Impact |
|--------|-------|------|--------|
| **PAMI** | Analytical | Pattern mining fréquentiel | +150% patterns, coherence 0.2→0.5 |
| **Merlion** | Reflective | Raffinement causalité | Coherence 0.5→0.8 |
| **HyperTS** | Forecast | Probabilités ML | Forecast precision 0→0.6 |
| **FP-Growth** | Analytical | Optimisation >10k séquences | Réduction temps ×5-10 |
| **SPMF** | Structural | Patterns universels | Universals >100 |

### **Installation Rapide**

```bash
# 1. Installer les modules ML (5-10 min)
npm run bootstrap-ml

# 2. Tester les bridges
npm run test:bridges

# 3. Entraîner avec ML activé
npm run train:ml
```

**Guide complet** : Voir [ML_INTEGRATION_GUIDE.md](./ML_INTEGRATION_GUIDE.md)

### **Fallback Automatique**

En cas d'erreur ou timeout > 300s :
- ✅ Retour automatique sur méthodes natives
- ✅ Logging dans `.reasoning_rl4/logs/bridges/`
- ✅ Training continue sans interruption
- ✅ Stabilité garantie sur runs nocturnes

### **Métriques Cibles**

| Phase | Coherence | Forecast Precision | Universals |
|-------|-----------|-------------------|------------|
| Phase 2 | 0.5 | 0.4 | 20 |
| Phase 3 | 0.8 | 0.6 | 50 |
| Phase 4 | >0.9 | >0.75 | >100 |

---

## 🔄 Intégration avec Reasoning Layer V3

### **Workflow Complet**

1. **Dataset** : Acquérir repos avec `bash scripts/fetch-repos.sh`
   ```bash
   # Récupérer 1000-5000 repos GitHub
   bash scripts/fetch-repos.sh
   
   # Valider le dataset
   bash scripts/validate-dataset.sh
   ```

2. **Baseline** : Entraîner RL4 version N sur dataset A
   ```bash
   npm run train -- --max-repos 1000
   npm run analyze
   ```

3. **Identifier** : Lire meta-ADRs dans `.reasoning_rl4/feedback/meta_adrs/`
   ```bash
   cat .reasoning_rl4/feedback/meta_adrs/index.json
   ```

4. **Implémenter** : Appliquer recommandations dans le repo `Reasoning Layer V3`
   - Modifier `PatternLearningEngine.ts`
   - Ajuster seuils dans `CorrelationEngine.ts`
   - Calibrer modèles dans `ForecastEngine.ts`

5. **Valider** : Re-entraîner et comparer métriques
   ```bash
   npm run train -- --max-repos 1000
   npm run analyze
   # Comparer stats.json avec baseline
   ```

6. **Généraliser** : Tester sur dataset B (non vu)
   ```bash
   # Ajouter nouveaux repos dans repo-list.txt
   npm run train
   ```

7. **Itérer** : Répéter jusqu'à convergence (métriques stables < 2% variation)

### **Tracking des améliorations**

Sauvegarder les rapports de métriques par version :

```bash
cp .reasoning_rl4/metrics/stats.json metrics-history/v1.0.0.json
# Après modifications
npm run train && npm run analyze
cp .reasoning_rl4/metrics/stats.json metrics-history/v1.1.0.json
# Comparer
diff metrics-history/v1.0.0.json metrics-history/v1.1.0.json
```

---

## 🛠️ Commandes CLI

### **Replay Git**
```bash
node dist/trainer/replayGitHistory.js --repo <path> [--limit <n>] [--branch <name>]
```

### **Kernel RL4**
```bash
node dist/kernel/RL4KernelTrainer.js --repo <repo-name> [--events <path>]
```

### **Batch Training**
```bash
node dist/trainer/trainBatch.js [--max-repos <n>] [--concurrency <n>] [--skip-replay]
```

### **Metrics**
```bash
node dist/metrics/MetricsEngine.js [--analyze]
```

### **Feedback**
```bash
node dist/feedback/FeedbackEngine.js [--high-only] [--export-md]
```

### **Dashboard**
```bash
npm run dashboard
```

Affiche les tendances d'évolution entre runs successifs :
- Comparaison patterns/correlations/forecasts/ADRs
- Tendances avec pourcentages d'évolution
- Densité cognitive et taux de corrélation
- Export JSON dans `.reasoning_rl4/metrics/dashboard-latest.json`

---

## 📈 Exemple de Sortie

### **Training Summary**
```
============================================================
BATCH TRAINING SUMMARY
============================================================
Total Repos:     5
Successful:      4 ✓
Failed:          1 ✗
Total Duration:  127.45s
Start Time:      2025-11-03T10:00:00.000Z
End Time:        2025-11-03T10:02:07.450Z

--- Successful Repos ---
  ✓ repo-A: 45 patterns, 12 ADRs (23456ms)
  ✓ repo-B: 78 patterns, 18 ADRs (34567ms)
  ✓ repo-C: 34 patterns, 8 ADRs (18234ms)
  ✓ repo-D: 56 patterns, 14 ADRs (28901ms)

--- Failed Repos ---
  ✗ repo-E: Invalid Git repository
============================================================
```

### **Metrics Report**
```
============================================================
METRICS REPORT
============================================================

--- Global Metrics ---
Pattern Density:      0.423
Correlation Rate:     0.687
Forecast Accuracy:    0.541
ADR Usefulness:       0.312
Cycle Time:           2634ms
Entropy:              2.731
---
Total Events:         1250
Total Patterns:       529
Total Correlations:   364
Total Forecasts:      187
Total ADRs:           52
Total Cycles:         4
============================================================
```

### **Meta-ADRs**
```
============================================================
FEEDBACK ENGINE - META-ADRs GENERATED
============================================================
Total Meta-ADRs: 3
  - High/Critical: 1
  - Medium:        2
  - Low:           0

--- Meta-ADRs (by priority) ---

🟠 [HIGH] Améliorer la détection de patterns
  ID: 550e8400-e29b-41d4-a716-446655440000
  Metric: pattern_density
  Observed: 0.280 (threshold: 0.300)
  Repos: repo-A, repo-C
  Recommendation: Étendre les heuristiques du PatternLearningEngine...
  Improvement: Augmentation attendue de 7% de la densité

🟡 [MEDIUM] Améliorer la corrélation entre patterns
  ID: 660e8400-e29b-41d4-a716-446655440001
  Metric: correlation_rate
  Observed: 0.450 (threshold: 0.500)
  Repos: global
  Recommendation: Élargir la fenêtre temporelle de recherche...
  Improvement: Amélioration estimée de 11% du taux de corrélation
============================================================
```

---

## 🧪 Validation

### **Critères de succès**

✅ Structure complète générée et compilable (`npm run build`)  
✅ 1 repo analysé et ledger créé avec format correct  
✅ Fichier `stats.json` produit avec 6 métriques  
✅ Au moins 1 meta-ADR généré  
✅ Batch > 10 repos sans crash  

### **Tests manuels**

```bash
# Test 1: Replay seul
npm run replay -- --repo /path/to/test-repo
ls datasets/corpus/test-repo/commits.jsonl

# Test 2: Kernel seul
npm run kernel -- --repo test-repo
cat .reasoning_rl4/ledger/cycles.jsonl

# Test 3: Pipeline complet
echo "/path/to/test-repo" > datasets/repo-list.txt
npm run train
npm run analyze
ls .reasoning_rl4/feedback/meta_adrs/
```

---

## 🔬 Mesure de Convergence

Pour évaluer l'amélioration du RL4 :

1. **Baseline** : Entraîner version N sur dataset A, sauver métriques
2. **Amélioration** : Appliquer meta-ADRs, modifier engines
3. **Re-entraînement** : Version N+1 sur dataset A, comparer
4. **Validation** : Version N+1 sur dataset B (non vu)
5. **Convergence** : Répéter jusqu'à plateau (< 2% variation)

**Métriques cibles** :
- Pattern density : +5% minimum
- Correlation rate : +10% minimum
- Forecast accuracy : +8% minimum
- Cycle time : stabilité (variation < 15%)

---

## 📝 Notes Techniques

### **Format JSONL**
Tous les fichiers de données utilisent le format JSONL (JSON Lines) :
- 1 objet JSON par ligne
- Append-only (thread-safe)
- Facilite streaming et traitement incrémental

### **Merkle Root**
Chaque cycle calcule un hash SHA-256 pour garantir :
- Intégrité des données
- Chaînage des cycles (blockchain-like)
- Détection de corruption

### **AppendOnlyWriter**
Writer optimisé pour JSONL :
- Buffer interne (10 lignes ou 5s)
- File locking pour concurrence
- Rotation automatique > 100MB

---

## 🐛 Troubleshooting

### **"Events file not found"**
```bash
# Relancer le replay
npm run replay -- --repo /path/to/repo
```

### **"Not a valid Git repository"**
```bash
# Vérifier le chemin
git -C /path/to/repo status
```

### **Performances lentes**
```bash
# Réduire concurrence
npm run train -- --concurrency 2

# Limiter nombre de repos
npm run train -- --max-repos 5
```

### **Métriques à 0**
```bash
# Vérifier que le ledger existe
cat .reasoning_rl4/ledger/cycles.jsonl

# Relancer le kernel
npm run kernel -- --repo <repo-name>
```

---

## 📚 Références

- **Reasoning Layer V3** : Repo principal du RL4
- **Pattern Learning** : Détection heuristique de patterns Git
- **Correlation Analysis** : Analyse temporelle et causale
- **Forecast Models** : Prédiction basée sur historique
- **ADR (Architecture Decision Records)** : RFC-002

---

## 📄 Licence

MIT

---

## 👥 Contributeurs

Projet développé dans le cadre de l'entraînement et l'amélioration continue du Reasoning Layer 4.

---

**Version** : 1.0.0  
**Date** : 2025-11-03

