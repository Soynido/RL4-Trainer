<!-- 4ed3cd8a-db31-468d-8bfc-ff0615dba3a7 ccc47071-cfaf-4570-abb1-a14b6f851db2 -->
# Plan RL4-Trainer

## Architecture Globale

Le projet sera structuré en 6 modules principaux :

1. **Kernel Headless** : version sans VSCode du RL4 avec les 4 engines cognitifs
2. **Trainer** : orchestration batch, replay Git, et gestion des datasets
3. **Metrics** : calcul et enregistrement des métriques de performance
4. **Feedback** : génération de meta-ADRs basés sur les métriques
5. **Datasets** : structure pour stocker les repos et leurs commits
6. **Ledger** : stockage append-only des cycles cognitifs

## Structure des Fichiers

```
RL4-Trainer/
├── package.json
├── tsconfig.json
├── train.config.json
├── README.md
│
├── kernel/
│   ├── RL4KernelTrainer.ts       # Wrapper headless du kernel
│   ├── engines/
│   │   ├── PatternLearningEngine.ts
│   │   ├── CorrelationEngine.ts
│   │   ├── ForecastEngine.ts
│   │   └── ADRGeneratorV2.ts
│   └── utils/
│       └── AppendOnlyWriter.ts
│
├── trainer/
│   ├── trainBatch.ts             # Orchestrateur principal
│   ├── replayGitHistory.ts       # Lecteur commits Git
│   ├── utils/
│   │   └── logger.ts
│   └── logs/
│       └── training.log
│
├── metrics/
│   ├── MetricsEngine.ts          # Calcul des métriques
│   └── types.ts
│
├── feedback/
│   ├── FeedbackEngine.ts         # Génération meta-ADRs
│   └── templates/
│       └── metaADR.ts
│
├── datasets/
│   ├── repo-list.txt
│   └── corpus/
│       └── .gitkeep
│
└── .reasoning_rl4/
    ├── ledger/
    │   └── cycles.jsonl
    ├── metrics/
    │   └── stats.json
    ├── diagnostics/
    └── feedback/
        └── meta_adrs/
```

## Implémentation Détaillée

### 1. Configuration Initiale

**package.json** :

- Dependencies : `pino`, `pino-pretty`, `p-limit`, `chalk`, `simple-git`
- Scripts : `train`, `replay`, `analyze`
- Type : module, Node 20+

**tsconfig.json** :

- Target : ES2022
- Module : NodeNext
- Strict mode activé
- Output dans `dist/`

**train.config.json** :

- `max_repos` : limite de repos à traiter
- `concurrency` : nombre de repos en parallèle
- `output_dir` : chemin du ledger
- `cycle_interval_ms` : délai entre cycles
- `metrics_enabled` : activation métriques
- `feedback_enabled` : activation feedback

### 2. Kernel Headless (`kernel/RL4KernelTrainer.ts`)

**Responsabilités** :

- Importer les 4 engines cognitifs (Pattern, Correlation, Forecast, ADR)
- Lire les événements depuis `replayGitHistory`
- Exécuter un cycle complet : Pattern → Correlation → Forecast → ADR
- Écrire dans le ledger au format JSONL spécifié
- Calculer merkleRoot et prevMerkleRoot
- CLI : `node dist/kernel/RL4KernelTrainer.js --repo <path>`

**Fonctions clés** :

- `initKernel()` : initialisation des engines
- `runCycle(events)` : exécution séquentielle des phases
- `writeLedger(cycle)` : écriture append-only
- `calculateMerkleRoot(cycle)` : hash du cycle

### 3. Replay Git History (`trainer/replayGitHistory.ts`)

**Responsabilités** :

- Utiliser `simple-git` pour lire l'historique d'un repo
- Parser : hash, author, date, message, files modifiés
- Convertir en événements normalisés JSON
- Exporter dans `datasets/corpus/<repo-name>/commits.jsonl`

**Format événement** :

```typescript
{
  type: "commit",
  timestamp: ISO8601,
  author: string,
  hash: string,
  message: string,
  files: [{ path, status, additions, deletions }],
  metadata: { repo, branch }
}
```

**Fonctions clés** :

- `cloneOrOpen(repoUrl, localPath)` : prépare le repo
- `extractCommits(limit?)` : récupère commits avec `git log --numstat`
- `normalizeEvent(commit)` : conversion au format standard
- `writeToDataset(events)` : écriture JSONL

### 4. Batch Trainer (`trainer/trainBatch.ts`)

**Responsabilités** :

- Lire `datasets/repo-list.txt`
- Pour chaque repo :

  1. Appeler `replayGitHistory`
  2. Lancer `RL4KernelTrainer` sur les événements
  3. Déclencher `MetricsEngine`
  4. Déclencher `FeedbackEngine`

- Gérer la concurrence avec `p-limit`
- Logger progression dans `trainer/logs/training.log`

**Fonctions clés** :

- `loadRepoList()` : parse repo-list.txt
- `trainRepo(repoPath)` : pipeline complet pour 1 repo
- `trainAll()` : orchestration parallèle avec Promise.allSettled
- `handleError(repo, error)` : gestion erreurs par repo

### 5. Metrics Engine (`metrics/MetricsEngine.ts`)

**Responsabilités** :

- Lire le ledger `.reasoning_rl4/ledger/cycles.jsonl`
- Calculer les métriques :
  - `pattern_density` : nb patterns / nb événements
  - `correlation_rate` : corrélations valides / patterns
  - `forecast_accuracy` : forecasts confirmés / total forecasts
  - `adr_usefulness` : ADRs appliqués / total ADRs
  - `cycle_time_ms` : durée moyenne par cycle
  - `entropy` : diversité des patterns (Shannon)
- Écrire dans `.reasoning_rl4/metrics/stats.json`

**Fonctions clés** :

- `computeMetrics(ledger)` : calcul complet
- `aggregateByRepo()` : stats par repo
- `exportMetrics(format)` : JSON ou CSV
- `compareWithBaseline()` : évolution vs version précédente

### 6. Feedback Engine (`feedback/FeedbackEngine.ts`)

**Responsabilités** :

- Analyser les métriques du `MetricsEngine`
- Identifier les anomalies et opportunités d'amélioration
- Générer des meta-ADRs structurés :
  - Titre
  - Contexte (métriques observées)
  - Recommandation (calibration à faire)
  - Impact estimé
- Écrire dans `.reasoning_rl4/feedback/meta_adrs/<timestamp>.json`

**Exemples de meta-ADRs** :

- "Patterns sur refactor sous-détectés → augmenter poids"
- "Corrélations cross-repo faibles → améliorer contextualisation"
- "ADRs trop génériques → affiner templates"

**Fonctions clés** :

- `analyzeMetrics(stats)` : détection patterns
- `generateMetaADR(insight)` : formatage ADR
- `exportFeedback()` : écriture fichiers

### 7. Utils & Logger (`trainer/utils/logger.ts`)

**Responsabilités** :

- Wrapper autour de `pino` avec pretty print
- Méthodes : `info()`, `success()`, `warn()`, `error()`, `debug()`
- Timestamps automatiques
- Niveaux de log configurables via env var

### 8. AppendOnlyWriter (`kernel/utils/AppendOnlyWriter.ts`)

**Responsabilités** :

- Écriture asynchrone thread-safe en JSONL
- Buffer interne avec auto-flush (toutes les 10 lignes ou 5s)
- Support file locking pour concurrence
- Rotation si fichier > 100MB

**Fonctions clés** :

- `append(data)` : ajoute au buffer
- `flush()` : écrit buffer sur disque
- `rotate()` : crée nouveau fichier si besoin

## Workflow d'Entraînement

```
1. datasets/repo-list.txt
   ↓
2. trainBatch.ts (orchestrator)
   ↓
3. replayGitHistory.ts (pour chaque repo)
   ↓ events.jsonl
4. RL4KernelTrainer.ts (cycle cognitif)
   ↓ ledger.jsonl
5. MetricsEngine.ts (stats)
   ↓ metrics.json
6. FeedbackEngine.ts (meta-ADRs)
   ↓ feedback/meta_adrs/*.json
```

## Commandes Finales

```bash
# Rejouer l'historique d'un repo
npm run replay -- --repo /path/to/repo

# Entraîner sur tous les repos
npm run train

# Analyser les métriques
npm run analyze

# Entraînement avec limite
npm run train -- --max-repos 10 --concurrency 3
```

## Intégration avec Reasoning Layer V3

Les meta-ADRs générés dans `.reasoning_rl4/feedback/meta_adrs/` devront être :

1. Analysés manuellement ou via script
2. Traduits en ajustements de code dans les engines (Pattern, Correlation, etc.)
3. Versionnés dans le repo principal
4. Re-testés via un nouveau cycle d'entraînement

## Mesure de Convergence

Pour évaluer l'amélioration du RL4 :

1. Établir baseline : entraîner sur dataset A, noter métriques
2. Appliquer meta-ADRs : modifier engines
3. Re-entraîner sur dataset A : comparer métriques
4. Valider sur dataset B : confirmer généralisation
5. Itérer jusqu'à convergence (métriques plateau)

## Format JSONL du Ledger

Respecte le format exact du RL4 existant :

```json
{
  "cycleId": 123,
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
    "duration_ms": 1234
  }
}
```

### To-dos

- [ ] Initialiser le projet Node.js avec package.json, tsconfig.json, train.config.json et structure de dossiers complète
- [ ] Créer RL4KernelTrainer.ts avec imports des 4 engines, exécution cycle complet et écriture ledger JSONL
- [ ] Implémenter les 4 engines cognitifs (PatternLearning, Correlation, Forecast, ADR) avec structure de base fonctionnelle
- [ ] Créer AppendOnlyWriter.ts avec buffer, auto-flush, file locking et rotation
- [ ] Implémenter replayGitHistory.ts avec simple-git pour parser commits et générer événements normalisés
- [ ] Créer trainBatch.ts orchestrateur avec p-limit pour traitement parallèle des repos
- [ ] Implémenter MetricsEngine.ts avec calcul des 6 métriques (density, rate, accuracy, usefulness, time, entropy)
- [ ] Créer FeedbackEngine.ts pour analyser métriques et générer meta-ADRs de calibration
- [ ] Implémenter logger.ts avec pino et méthodes stylisées (info, success, warn, error)
- [ ] Rédiger README.md avec architecture, workflow, commandes et guide d'intégration Reasoning Layer V3