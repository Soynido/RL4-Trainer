# Tasks RL4-Trainer - Pipeline Dataset GitHub

## Référence

Ce fichier de suivi est aligné avec la convention Reasoning Layer (spec → plan → tasks → ledger).

**Plan associé** : `.cursor/plans/pipeline-dataset-*.plan.md`

---

## Pipeline d'Acquisition Dataset

### [DONE] #1 - Créer tasks.md
**Description** : Fichier de suivi des tâches du pipeline dataset  
**Référence** : Plan section 1  
**Status** : ✅ Terminé

### [DONE] #2 - Créer structure scripts/
**Description** : Créer le dossier `scripts/` à la racine du projet  
**Référence** : Plan section 1  
**Status** : ✅ Terminé

### [DONE] #3 - Implémenter fetch-repos.sh
**Description** : Script bash avec 4 requêtes GitHub CLI (gh search repos)  
**Référence** : Plan section 2  
**Détails** :
- Query 1: AI Agents & Reasoning Systems ✅
- Query 2: AI & LLM Frameworks ✅
- Query 3: Developer Tools (VSCode, CLI) ✅
- Query 4: Backend & Infrastructure (NestJS, FastAPI, Express) ✅
- Nettoyage doublons avec `sort -u` ✅
- Affichage compteur final ✅
**Status** : ✅ Terminé

### [DONE] #4 - Implémenter validate-dataset.sh
**Description** : Script de validation standalone du dataset  
**Référence** : Plan section 3  
**Détails** :
- Compter repos dans `datasets/repo-list.txt` ✅
- Afficher échantillon (head -20) ✅
- Afficher taille disque corpus ✅
- Warning si < 500 repos ✅
**Status** : ✅ Terminé et testé

### [DONE] #5 - Intégrer clonage automatique dans trainBatch.ts
**Description** : Ajouter logique de clonage avec `git clone --depth 50`  
**Référence** : Plan section 4  
**Emplacement** : `trainer/trainBatch.ts` méthode `trainRepo()` ligne ~142  
**Détails** :
- Détecter URL GitHub (http/https) ✅
- Cloner dans `datasets/corpus/<repo-name>/` ✅
- Vérifier si déjà cloné (skip si oui) ✅
- Gestion erreurs : skip repo si échec ✅
- Timeout 5min max par clone ✅
**Status** : ✅ Terminé et testé avec vercel/next.js (272M, 8s)

### [DONE] #6 - Ajouter validation intégrée dans trainAll()
**Description** : Check automatique du nombre de repos au démarrage  
**Référence** : Plan section 4  
**Emplacement** : `trainer/trainBatch.ts` méthode `trainAll()` ligne ~78  
**Détails** :
- Warning si < 500 repos ✅
- Suggérer `bash scripts/fetch-repos.sh` ✅
**Status** : ✅ Terminé et testé

### [DONE] #7 - Documenter Pipeline Dataset dans README.md
**Description** : Ajouter section "Pipeline d'Acquisition Dataset"  
**Référence** : Plan section 5  
**Emplacement** : Après section "Installation" (ligne ~162)  
**Contenu** :
- Étape 1 : Fetch repos (bash scripts/fetch-repos.sh) ✅
- Étape 2 : Validation (bash scripts/validate-dataset.sh) ✅
- Étape 3 : Clonage + entraînement ✅
- Tableau paramètres recommandés ✅
**Status** : ✅ Terminé

### [DONE] #8 - Mettre à jour section Intégration RL V3
**Description** : Ajouter workflow dataset dans section existante  
**Référence** : Plan section 5  
**Emplacement** : README.md ligne ~280  
**Détails** : Workflow complet avec acquisition dataset ✅
**Status** : ✅ Terminé

### [DONE] #9 - Ajouter scripts npm dans package.json
**Description** : Scripts `fetch-repos` et `validate-dataset`  
**Référence** : Plan section 6  
**Status** : ✅ Terminé
- `npm run fetch-repos` → `bash scripts/fetch-repos.sh`
- `npm run validate-dataset` → `bash scripts/validate-dataset.sh`

### [DONE] #10 - Validation finale - Tests
**Description** : Exécuter les 4 tests de validation du pipeline  
**Référence** : Plan section 7  
**Tests** :
1. ✅ Test fetch-repos.sh (syntaxe validée)
2. ✅ Test validate-dataset.sh (affichage stats fonctionnel)
3. ✅ Test clonage 1 repo (vercel/next.js, 272M, depth 50)
4. ✅ Test détection repo déjà cloné ("Already cloned, skipping")
5. ✅ Test validation intégrée (warning affiché)
6. ✅ Test compilation TypeScript (sans erreur)
**Status** : ✅ Terminé - Voir VALIDATION_REPORT.md

---

## Analyse AST (Enrichissement Patterns)

### [DONE] #11 - Créer ASTParserWorker
**Description** : Worker d'analyse syntaxique (AST) des commits pour extraire patterns de structure, intention et complexité  
**Référence** : Amélioration du pipeline d'entraînement  
**Détails** :
- Parser TypeScript/JavaScript via @typescript-eslint/typescript-estree ✅
- Extraire fonctions, classes, imports, exports ✅
- Calculer complexité (lignes, params, branches) ✅
- Générer features enrichies : { type, name, complexity, context } ✅
- Output : .reasoning_rl4/tmp/ast_*.jsonl ✅
**Fichier** : `trainer/workers/ASTParserWorker.ts`  
**Status** : ✅ Terminé

### [DONE] #12 - Intégrer ASTParserWorker dans trainBatch.ts
**Description** : Appeler l'analyse AST après replayGitHistory()  
**Référence** : Pipeline d'entraînement  
**Détails** :
- Ajouter import ASTParserWorker ✅
- Appeler analyzeCommit() en Phase 1.5 (après Replay) ✅
- Analyser état actuel du repo (HEAD) ✅
- Scanner automatique fichiers .ts/.js/.tsx/.jsx ✅
- Limite à 100 fichiers max par repo ✅
**Fichier** : `trainer/trainBatch.ts` (lignes 11, 227-239)  
**Status** : ✅ Terminé

### [DONE] #13 - Tester ASTParserWorker
**Description** : Validation standalone du worker AST  
**Référence** : Tests unitaires  
**Détails** :
- Test avec un repo sample (tests/mocks/sample-repo) ✅
- Vérifier extraction de fonctions/classes ✅
- Valider calcul de complexité ✅
- Vérifier format JSONL de sortie ✅
- Script de test : `bash tests/test-ast.sh` ✅
**Résultat** : 4 features extraites (2 fonctions, 1 import, 1 export)  
**Status** : ✅ Terminé

### [DONE] #14 - Enrichir ASTParserWorker (Niveau Comportement)
**Description** : Passer du syntaxe-level au behaviour-level avec 3 enrichissements  
**Référence** : Intelligence structurelle du code  
**Détails** :
- Détection dépendances inter-fichiers (A.ts → B.ts) ✅
- Détection appels de fonction (graphe d'appels) ✅
- Calcul cohérence de tests (fonctions couvertes/non-couvertes) ✅
- Nouveaux types : 'dependency', 'call', 'test_coverage' ✅
**Résultat** : 47 features extraites (3 dépendances, 24 appels)  
**Objectif** : Permettre au RL4 de détecter clusters de comportements et corrélations causales  
**Status** : ✅ Terminé

### [DONE] #15 - Tester enrichissements comportementaux
**Description** : Validation des nouveaux enrichissements  
**Référence** : Tests unitaires avancés  
**Détails** :
- Créer fichiers de test avec dépendances inter-fichiers ✅
- Vérifier détection des appels de fonction ✅
- Valider calcul de couverture de tests ✅
- Tester graphe de dépendances ✅
- Script : `npx tsx tests/test-ast-enriched.ts` ✅
**Résultats** :
  - 3 dépendances inter-fichiers (utils.ts → main, etc.)
  - 24 appels détectés (hello: 3×, fetch: 2×, etc.)
  - Graphe de dépendances fonctionnel
**Status** : ✅ Terminé

---

## Pipeline Cognitif RL4 - Architecture des 4 Couches

**Vision** : Moteur de cognition systémique (voir `RL4_COGNITIVE_ARCHITECTURE.md`)

### [DONE] #16 - Perceptual & Analytical Layer (Pattern Learning V2)
**Description** : Convertir features AST en patterns comportementaux + timeline causale  
**Référence** : Couche 1-2 du cycle cognitif  
**Détails** :
- **Perceptual** : Extraire séquences temporelles des commits ✅
- **Analytical** : Grouper patterns similaires avec fréquence ✅
- **Timeline** : Construire carte temporelle (t0, t3, t5...) ✅
- Calculer pattern confidence score (0-1) ✅
- Output : `.reasoning_rl4/patterns.jsonl` + `timeline_*.json` ✅
- Format : `{ sequence: ['feature', 'refactor', 'test'], confidence: 0.53, avgLag: 1.0 }` ✅
- Intégration Kernel : Phase 1.5 (enableV2: true) ✅
- Script test : `npm run test:pattern-v2` ✅
**Fichier** : `kernel/engines/PatternLearningEngineV2.ts` (420 lignes)  
**Résultat** : 1 séquence détectée sur test repo, timeline de 5 events  
**Objectif** : Transformer matière première en comportements temporels récurrents  
**Status** : ✅ Terminé

### [DONE] #17 - Reflective Layer (Correlation Engine V2)
**Description** : Construire chaînes causales + raisonnement contextuel  
**Référence** : Couche 3 - Déduction des causes et effets  
**Détails** :
- Détecter corrélations causales entre patterns ✅
- Calculer strength (0-1) et lag (commits d'écart) ✅
- **Context Recognition** : Apprendre règles contextuelles (repo A vs repo B) ✅
- **Causal Chains** : Construire graphe de causalité temporelle ✅
- Exemple : `refactor → test` (61%, lag: 2, context: "library") ✅
- Output : `.reasoning_rl4/correlations.jsonl` + `causal_chains.json` + `contextual_rules.json` ✅
- Format : `{ cause: 'refactor', effect: 'test', strength: 0.61, lag: 2, context: {...} }` ✅
- Intégration Kernel : Phase 2.5 (enableV2: true) ✅
- Script test : `npm run test:correlation-v2` ✅
**Fichier** : `kernel/engines/CorrelationEngineV2.ts` (370 lignes)  
**Résultat** : 4 corrélations causales, 2 chaînes, 1 règle contextuelle  
**Objectif** : Créer le cerveau causal du RL4 avec raisonnement situé  
**Status** : ✅ Terminé

### [DONE] #18 - Forecast Layer (Forecast Engine V3)
**Description** : Simuler trajectoires possibles + mémoire réflexive  
**Référence** : Couche 4 - Simulation de trajectoires possibles  
**Détails** :
- Utiliser causal chains pour prédire patterns probables ✅
- Calculer confidence et horizon (commits) ✅
- **Hypothèse** : Imaginer la suite logique du repo ✅
- **Confrontation** : Comparer prédiction vs réalité ✅
- **Reflective Memory** : Enregistrer chaque raisonnement ✅
- Output : `.reasoning_rl4/forecasts.jsonl` + `.reasoning_rl4/kernel/reasoning_history.jsonl` ✅
- Format : `{ predicted: 'bugfix', basedOn: [...], confidence: 0.6, reasoning: {...} }` ✅
**Fichier** : `kernel/engines/ForecastEngineV3.ts` (320 lignes)  
**Objectif** : Le RL4 raisonne dans le temps et apprend de ses hypothèses  
**Status** : ✅ Terminé (intégration kernel pending)

### [SKIP] #19 - ADR Generator V2 (Enrichissement)
**Description** : Enrichir ADRs avec forecasts réels du moteur  
**Référence** : Raisonnement structurel - Étape 5  
**Détails** :
- ADR Generator V1 existant suffit pour MVP
- Enrichissement sera fait après validation coherence > 0.9
- Focus actuel : atteindre objectifs cognitifs
**Objectif** : ADRs basés sur patterns réels, pas templates  
**Status** : ⏭️ Reporté après validation du kernel

### [DONE] #20 - Cognitive Kernel Consolidation
**Description** : Consolider l'état cognitif + métriques de cohérence  
**Référence** : Noyau cognitif du RL4  
**Détails** :
- Créer `.reasoning_rl4/kernel/cognitive_state.json` ✅
- **Coherence Score** : Mesure globale de cohérence (0-1) ✅
- **Forecast Precision** : Précision prédictions (0-1) ✅
- **Universal Rules** : Invariants validés (strength ≥ 0.7) ✅
- **Reasoning History** : Mémoire réflexive complète ✅
- Méthode `isGoalReached()` : Vérifie si objectifs atteints ✅
- Méthode `export()` : Export kernel pour usage externe ✅
- Format :
```json
{
  "coherence_score": 0.00,
  "forecast_precision": 0.00,
  "universals": 0,
  "reasoning_depth": 4,
  "avg_correlation_strength": 0.00,
  "metrics": { "total_repos": 0, ... }
}
```
**Fichier** : `kernel/CognitiveKernel.ts` (345 lignes)  
**Test** : ✅ cognitive_state.json créé et vérifié  
**Objectif** : Noyau cognitif auto-évalué et persistant  
**Status** : ✅ Terminé

### [DONE] #21 - Entraînement Itératif et Compaction
**Description** : Automatiser le cycle entraînement → consolidation → compaction  
**Référence** : Raisonnement structurel - Étape 7  
**Détails** :
- Créer `npm run consolidate` (merge patterns/correlations) ✅
- Script `scripts/consolidate.ts` avec CognitiveKernel ✅
- Améliorer `npm run compact` (dump anciens cycles) ✅
- Workflow intégré dans `trainBatch.ts` (auto après batch) ✅
- Maintenir taille workspace < 10 Go (guard.sh) ✅
- Script night-train : `npm run night-train` ✅
**Fichiers** :
  - `kernel/CognitiveKernel.ts` (345 lignes)
  - `scripts/consolidate.ts` (95 lignes)
  - `scripts/guard.sh` (60 lignes)
  - `scripts/watch-guard.sh` (15 lignes)
  - `scripts/night-train.sh` (65 lignes)
**Objectif** : Système d'entraînement cognitif incrémental  
**Status** : ✅ Terminé

---

## Statuts

- **[TODO]** : Tâche non commencée
- **[DOING]** : Tâche en cours
- **[DONE]** : Tâche terminée
- **[BLOCKED]** : Tâche bloquée (dépendance)

---

## 🎯 Résultats Phase 1 - Pipeline Dataset (2025-11-03)

**Statut** : ✅ **TERMINÉ**

### Livrables

✅ **Scripts créés** :
- `scripts/fetch-repos.sh` - Acquisition GitHub (4 requêtes, 1000-5000 repos)
- `scripts/validate-dataset.sh` - Validation standalone du dataset

✅ **Intégrations** :
- Clonage automatique dans `trainBatch.ts` avec `git clone --depth 50`
- Validation intégrée (warning si < 500 repos)

✅ **Tests validés** :
- Clonage automatique optimisé (272M pour next.js)
- Compilation sans erreur

---

## 🎯 Résultats Phase 2 - Analyse AST Comportementale (2025-11-04)

**Statut** : ✅ **TERMINÉ**

### Livrables

✅ **Worker AST créé** :
- `trainer/workers/ASTParserWorker.ts` (501 lignes)
- Parsing TypeScript/JavaScript complet
- 3 enrichissements comportementaux

✅ **Enrichissements** :
- 🔗 Dépendances inter-fichiers (graphe de relations)
- 📞 Appels de fonction (graphe d'utilisation + async)
- 🧪 Cohérence de tests (fonctions testées/non testées)

✅ **Intégration** :
- Phase 1.5 ajoutée dans `trainBatch.ts`
- Analyse automatique à chaque entraînement
- Output : `.reasoning_rl4/tmp/ast_*.jsonl`

✅ **Tests validés** :
- Test simple : 4 features extraites ✅
- Test enrichi : 47 features (3 dépendances, 24 appels) ✅
- Compilation sans erreur ✅

✅ **Documentation** :
- `AST_ANALYSIS.md` - Guide complet (320 lignes)
- `COGNITIVE_PIPELINE_STATUS.md` - Roadmap pipeline cognitif
- `IMPLEMENTATION_SUMMARY.md` - Résumé implémentation
- README.md mis à jour

### Résultats Mesurés

- **47 features** extraites (test enrichi)
- **3 dépendances** inter-fichiers détectées
- **24 appels** de fonction détectés
- **Async détecté** : 2 appels asynchrones
- **Code qualité** : ~1200 lignes TypeScript maintenables

---

## 🚀 Prochaines Étapes - Pipeline Cognitif

### Court terme (1-2 jours)

1. **#16** : Pattern Learning Engine V2
   - Transformer features AST en patterns récurrents
   - Output : `.reasoning_rl4/patterns.jsonl`

2. **#17** : Correlation Engine V2
   - Relier patterns causalement
   - Output : `.reasoning_rl4/correlations.jsonl`

### Moyen terme (3-5 jours)

3. **#18** : Forecast Engine V3 (prédictions)
4. **#19** : ADR Generator V2 (conseils actionnables)
5. **#20** : Kernel Consolidation (état persistant)

### Long terme (1 semaine)

6. **#21** : Entraînement itératif automatisé
7. **Production** : Entraîner sur 1000+ repos
8. **Validation** : Mesurer qualité des forecasts

---

## Phase 3 - ML Integration (Tuteurs Cognitifs)

**Vision** : Renforcer la mémoire structurante du RL4 en intégrant des tuteurs cognitifs ML

> Le but de cette phase n'est pas d'ajouter du calcul, mais de renforcer la mémoire structurante du RL4.
> Les modèles ML servent de **tuteurs cognitifs** pour extraire, pondérer et stabiliser les régularités que le moteur interne détecte déjà.

### 🌐 External ML Repositories

| Module | Repository | License | Integration | Layer |
|---------|-------------|----------|--------------|--------|
| **PAMI** | https://github.com/UdayLab/PAMI | MIT | PatternLearningEngineV2 | Analytical |
| **FP-Growth** | https://github.com/MK-ek11/Frequent-Pattern-Mining-FP-Tree | MIT | PatternLearningEngineV2 (opt.) | Analytical |
| **Merlion** | https://github.com/salesforce/Merlion | Apache-2.0 | CorrelationEngineV2 | Reflective |
| **HyperTS** | https://github.com/DataCanvasIO/HyperTS | Apache-2.0 | ForecastEngineV3 | Forecast |
| **SPMF** | https://github.com/philippe-fournier-viger/spmf | GPL-3.0 | spmf_bridge.sh | Structural |

### [DONE] #22 - Créer structure bridges/
**Description** : Infrastructure de base pour les bridges ML  
**Référence** : Plan Phase 3 - Infrastructure  
**Détails** :
- Dossier `bridges/` avec `requirements.txt` ✅
- Dossier `.reasoning_rl4/meta/` pour traçabilité ✅
- Dossier `.reasoning_rl4/logs/bridges/` pour logs ✅
- Fichier `external_repos.json` ✅
- Fichier `bridges_versions.json` ✅
- README.md bridges ✅
**Status** : ✅ Terminé

### [DONE] #23 - Implémenter bootstrap-ml-modules.sh
**Description** : Script d'installation automatique des modules ML  
**Référence** : Plan Phase 3 - Bootstrap  
**Détails** :
- Vérification Python 3.9+ ✅
- Vérification Java 11+ (optionnel) ✅
- Clone automatique des 5 dépôts ✅
- Installation des requirements Python ✅
- Création environnement virtuel ✅
- Mise à jour `bridges_versions.json` ✅
**Fichier** : `scripts/bootstrap-ml-modules.sh`  
**Status** : ✅ Terminé

### [DONE] #24 - Créer pami_bridge.py
**Description** : Bridge Python pour PAMI pattern mining  
**Référence** : Plan Phase 3 - Priorité 1  
**Détails** :
- Interface stdin/stdout JSON ✅
- Mining de séquences fréquentes ✅
- Support et confidence ✅
- Timeout 300s ✅
- Logging dans `.reasoning_rl4/logs/bridges/pami.log` ✅
**Fichier** : `bridges/pami_bridge.py`  
**Objectif** : Coherence 0.2 → 0.5, +150% patterns  
**Status** : ✅ Terminé

### [DONE] #25 - Intégrer PAMI dans PatternLearningEngineV2
**Description** : Appel automatique du bridge PAMI depuis le moteur  
**Référence** : Plan Phase 3 - Analytical Layer  
**Détails** :
- Méthode `callMLBridge()` avec spawnSync ✅
- Switch automatique vers FP-Growth si >10k séquences ✅
- Fallback sur méthode native en cas d'erreur ✅
- Logging des erreurs ✅
- Fusion des patterns natifs et ML ✅
**Fichier** : `kernel/engines/PatternLearningEngineV2.ts` (lignes 198-336)  
**Status** : ✅ Terminé

### [DONE] #26 - Créer merlion_bridge.py
**Description** : Bridge Python pour Merlion causalité ML  
**Référence** : Plan Phase 3 - Priorité 2  
**Détails** :
- Raffinement des corrélations causales ✅
- Calcul de causal_score ✅
- Détection d'anomalies temporelles ✅
- Analyse de régularité ✅
**Fichier** : `bridges/merlion_bridge.py`  
**Objectif** : Coherence 0.5 → 0.8  
**Status** : ✅ Terminé

### [DONE] #27 - Intégrer Merlion dans CorrelationEngineV2
**Description** : Appel automatique du bridge Merlion  
**Référence** : Plan Phase 3 - Reflective Layer  
**Détails** :
- Méthode `callMerlionBridge()` ✅
- Raffinement des corrélations ✅
- Fallback sur corrélations natives ✅
**Fichier** : `kernel/engines/CorrelationEngineV2.ts` (lignes 137-218)  
**Status** : ✅ Terminé

### [DONE] #28 - Créer hyperts_bridge.py
**Description** : Bridge Python pour HyperTS forecasting ML  
**Référence** : Plan Phase 3 - Priorité 3  
**Détails** :
- Enrichissement des forecasts ✅
- Calcul de ml_probability ✅
- Calcul de vraisemblance ✅
- Fréquences historiques ✅
**Fichier** : `bridges/hyperts_bridge.py`  
**Objectif** : forecast_precision 0 → 0.4-0.6  
**Status** : ✅ Terminé

### [DONE] #29 - Intégrer HyperTS dans ForecastEngineV3
**Description** : Appel automatique du bridge HyperTS  
**Référence** : Plan Phase 3 - Forecast Layer  
**Détails** :
- Méthode `callHyperTSBridge()` ✅
- Enrichissement des forecasts natifs ✅
- Fallback sur forecasts natifs ✅
**Fichier** : `kernel/engines/ForecastEngineV3.ts` (lignes 129-221)  
**Status** : ✅ Terminé

### [DONE] #30 - Créer fpgrowth_bridge.py
**Description** : Bridge Python pour FP-Growth (optimisation volume)  
**Référence** : Plan Phase 3 - Priorité 4  
**Détails** :
- Identique à PAMI mais optimisé ✅
- Activé automatiquement si >10k séquences ✅
**Fichier** : `bridges/fpgrowth_bridge.py`  
**Objectif** : Réduction temps ×5-10  
**Status** : ✅ Terminé

### [DONE] #31 - Créer spmf_bridge.sh
**Description** : Bridge Shell pour SPMF (patterns structurels)  
**Référence** : Plan Phase 3 - Phase 4 optionnel  
**Détails** :
- Wrapper pour SPMF jar ✅
- PrefixSpan algorithm ✅
- Activé seulement sur >200 repos ✅
**Fichier** : `bridges/spmf_bridge.sh`  
**Objectif** : Universals >100, Coherence >0.9  
**Status** : ✅ Terminé

### [TODO] #32 - Tester intégration ML sur 10 repos
**Description** : Valider le fonctionnement complet des bridges  
**Référence** : Plan Phase 3 - Validation  
**Détails** :
- Tester PAMI sur 10 repos
- Vérifier montée de coherence (0.2 → 0.5)
- Vérifier Merlion (causalité)
- Vérifier HyperTS (forecasts)
- Mesurer métriques phase_2_target
**Script** : `npm run test:bridges`  
**Métriques cibles** :
```json
{
  "phase_2_target": { "coherence_score": 0.5, "patterns_detected": 2000 },
  "phase_3_target": { "coherence_score": 0.8, "forecast_precision": 0.6 }
}
```
**Status** : ⏳ À faire

### Comportement de Repli (Fallback)

**En cas d'erreur de bridge ou de timeout > 300s** :

- Le système revient automatiquement sur la méthode native (PatternLearningEngine ou ForecastEngine)
- Les erreurs sont loguées dans `.reasoning_rl4/logs/bridges/*.log`
- Le training continue sans interruption
- Les métriques de fallback sont tracées dans `cognitive_state.json`

→ Indispensable pour garantir la stabilité sur run nocturne.

---

---

## 🧭 OBJECTIF FINAL DU RL4-TRAINER

### 🎯 Mission Cognitive

**Devenir un moteur cognitif universel** capable d'apprendre les structures, comportements et causalités du code à partir de n'importe quel dépôt GitHub, et d'en extraire une **mémoire consolidée exportable** vers le Reasoning Layer principal.

### ⚙️ Définition Opérationnelle

À la fin du cycle d'entraînement, le RL4-Trainer doit avoir produit :

1. **Fichiers d'apprentissage** :
   - `.reasoning_rl4/patterns.jsonl` → Comportements récurrents détectés
   - `.reasoning_rl4/correlations.jsonl` → Chaînes causales validées
   - `.reasoning_rl4/forecasts.jsonl` → Prévisions temporelles
   - `.reasoning_rl4/kernel/cognitive_state.json` → État cognitif consolidé
   - `.reasoning_rl4/universal_rules.json` → Invariants généralisables

2. **Métriques de cohérence** (export JSON) :
```json
{
  "coherence_score": 0.9,           ← OBJECTIF > 0.9
  "universals": 100,                ← OBJECTIF > 100
  "reasoning_depth": 4,
  "avg_correlation_strength": 0.6,
  "forecast_precision": 0.75        ← OBJECTIF > 0.75
}
```

### 🧠 Vision du Système

> **"Apprends à identifier, corréler et prévoir les comportements des développeurs dans le code source.**
> 
> **À la fin de ton entraînement, tu dois produire un kernel cognitif exportable capable de raisonner dans n'importe quel contexte logiciel,**
> 
> **en atteignant un score de cohérence supérieur à 0.9 et une précision prédictive supérieure à 0.75 sur les patterns temporels observés."**

### 📦 Structure de Sortie Finale

```
.reasoning_rl4/
├── kernel/
│   ├── cognitive_state.json        ← État global (coherence > 0.9)
│   ├── universals.json             ← Règles générales du RL4
│   └── reasoning_history.jsonl     ← Mémoire réflexive
├── patterns.jsonl                  ← Séquences comportementales
├── correlations.jsonl              ← Chaînes causales
├── forecasts.jsonl                 ← Projections temporelles
└── exports/
    └── kernel_export_YYYYMMDD.tar.gz  ← Kernel exportable
```

### ✅ Critères de Réussite

| Métrique | Objectif | Signification |
|----------|----------|---------------|
| **coherence_score** | > 0.9 | Le RL4 comprend 90% de la logique interne |
| **forecast_precision** | > 0.75 | 75% des prédictions se réalisent |
| **universals** | > 100 | Au moins 100 règles universelles apprises |
| **avg_correlation_strength** | > 0.6 | Corrélations causales solides |
| **reasoning_depth** | ≥ 4 | Raisonne sur 4 niveaux (AST→Pattern→Corr→Forecast) |

### 🚀 Cycle d'Auto-Amélioration

```
1. Entraîner sur batch de repos
2. Consolidation automatique (npm run consolidate)
3. Compaction ledger (npm run compact)
4. Auto-dump si nécessaire
5. Mesurer coherence_score
6. Si < 0.9 → recommencer
7. Si ≥ 0.9 → exporter kernel
```

**Le système doit s'auto-améliorer jusqu'à atteindre les objectifs.**

### 📊 Phases d'Apprentissage (Volume → Intelligence)

| Phase | Volume | Coherence | État | Interprétation |
|-------|--------|-----------|------|----------------|
| **Phase 1** | 0-3 Go | < 0.5 | Absorption | Matière brute, bruit |
| **Phase 2** | 4-6 Go | 0.5-0.7 | Patterns | Structures récurrentes |
| **Phase 3** | 7-9 Go | > 0.8 | Corrélations | Régularités cross-repo |
| **Phase 4** | >9 Go | >0.9 | Cognition | Forecast precision >0.75 → Export |

**Indicateurs de santé** :
- ✅ **+5000 features/heure** = Digestion efficace
- ✅ **+0.03 coherence/batch** = Progression réelle
- ✅ **Fichiers .jsonl croissants** = Apprentissage actif

**Guard automatique** :
- À 9.5 Go → Compactage forcé (kernel_dump_*.tar.gz)
- Workspace ne dépasse JAMAIS 10 Go

---

## Notes

- Chaque commit doit correspondre à une seule tâche
- Marquer la tâche comme [DONE] après commit
- Référence explicite au plan dans chaque commit message
- **Le RL4-Trainer n'exécute pas des tâches, il construit une intelligence**

