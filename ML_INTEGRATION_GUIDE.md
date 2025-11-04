# Guide d'Intégration ML - Phase 3

**RL4-Trainer : Tuteurs Cognitifs ML**

> Le but de cette phase n'est pas d'ajouter du calcul, mais de renforcer la mémoire structurante du RL4.
> Les modèles ML servent de **tuteurs cognitifs** pour extraire, pondérer et stabiliser les régularités que le moteur interne détecte déjà.

---

## 🎯 Objectifs Phase 3

| Métrique | État Initial | Phase 2 Target | Phase 3 Target | Phase 4 Target |
|----------|--------------|----------------|----------------|----------------|
| `coherence_score` | 0.21 | 0.5 | 0.8 | >0.9 |
| `patterns_detected` | ~500 | 2000 | 3000+ | 5000+ |
| `forecast_precision` | 0.0 | 0.4 | 0.6 | 0.75 |
| `universals` | 0 | 20 | 50 | >100 |

---

## 🚀 Installation Rapide

### 1. Installer les Modules ML

```bash
# Installation automatique des 5 dépôts ML
npm run bootstrap-ml

# Ou manuellement
bash scripts/bootstrap-ml-modules.sh
```

**Ce script va** :
- ✅ Vérifier Python 3.9+ et Java 11+
- ✅ Cloner les 5 dépôts ML dans `ml-modules/`
- ✅ Créer un environnement virtuel Python
- ✅ Installer les dépendances (PAMI, Merlion, HyperTS, etc.)
- ✅ Mettre à jour `bridges_versions.json`

**Durée** : ~5-10 minutes (selon connexion)

### 2. Tester les Bridges

```bash
# Test automatique des 5 bridges
npm run test:bridges
```

**Résultat attendu** :
```
========================================
ML Bridges Test Suite - Phase 3
========================================

Testing bridges_versions.json...
  ✓ bridges_versions.json structure valid

Testing external_repos.json...
  ✓ external_repos.json valid (5 repos)

Testing PAMI Bridge...
  ✓ Bridge responded successfully (234ms)
    Patterns found: 3

Testing Merlion Bridge...
  ✓ Bridge responded successfully (156ms)
    Refined correlations: 2
    Anomalies detected: 0

Testing HyperTS Bridge...
  ✓ Bridge responded successfully (189ms)
    Enriched forecasts: 2

Testing FP-Growth Bridge...
  ✓ Bridge responded successfully (198ms)
    Patterns found: 2

========================================
Test Summary
========================================
Metadata files: ✓
Bridges passed: 4
Bridges failed: 0

Total: 6/6 tests passed
```

### 3. Entraîner avec ML

```bash
# Entraînement test sur 10 repos avec ML activé
npm run train:ml

# Ou entraînement complet
npm run train -- --max-repos 100
```

---

## 🌐 Architecture des 5 Bridges ML

### 1. PAMI Bridge (Analytical Layer)

**Rôle** : Pattern Mining fréquentiel avancé  
**Fichier** : `bridges/pami_bridge.py`  
**Intégration** : `PatternLearningEngineV2.ts`  

**Input** :
```json
{
  "repo": "repo-name",
  "timeline": [
    {"t": 0, "patterns": ["feature"], "commit": "abc123"},
    {"t": 1, "patterns": ["refactor"], "commit": "def456"}
  ],
  "config": {"min_support": 0.3, "min_confidence": 0.5}
}
```

**Output** :
```json
{
  "success": true,
  "data": [
    {
      "sequence": ["feature", "refactor", "test"],
      "support": 0.42,
      "confidence": 0.77,
      "frequency": 15
    }
  ],
  "metadata": {"duration_ms": 1234, "patterns_found": 42}
}
```

**Métriques** : +150% patterns détectés, coherence 0.2 → 0.5

---

### 2. Merlion Bridge (Reflective Layer)

**Rôle** : Raffinement causalité + détection anomalies  
**Fichier** : `bridges/merlion_bridge.py`  
**Intégration** : `CorrelationEngineV2.ts`  

**Fonctionnalités** :
- Calcul de `causal_score` (force de la causalité)
- Analyse de régularité temporelle
- Détection d'anomalies (patterns rares)

**Métriques** : Coherence 0.5 → 0.8

---

### 3. HyperTS Bridge (Forecast Layer)

**Rôle** : Enrichissement probabiliste des forecasts  
**Fichier** : `bridges/hyperts_bridge.py`  
**Intégration** : `ForecastEngineV3.ts`  

**Fonctionnalités** :
- Calcul de `ml_probability` (probabilité ML)
- Calcul de `vraisemblance` (fusion native + ML)
- Fréquences historiques

**Métriques** : forecast_precision 0 → 0.4-0.6

---

### 4. FP-Growth Bridge (Optimisation)

**Rôle** : Pattern mining haute performance  
**Fichier** : `bridges/fpgrowth_bridge.py`  
**Intégration** : Automatique si >10k séquences  

**Switch automatique** :
```typescript
if (timelineCount > 10000) {
  useFPGrowth = true;
}
```

**Métriques** : Réduction temps calcul ×5-10

---

### 5. SPMF Bridge (Structural - Phase 4)

**Rôle** : Patterns structurels universels  
**Fichier** : `bridges/spmf_bridge.sh`  
**Activation** : Seulement sur >200 repos  

**Métriques** : Universals >100, coherence >0.9

---

## 🔧 Comportement de Fallback

**En cas d'erreur de bridge ou timeout > 300s** :

1. ✅ Le système revient automatiquement sur la méthode native
2. ✅ L'erreur est loguée dans `.reasoning_rl4/logs/bridges/*.log`
3. ✅ Le training continue sans interruption
4. ✅ Les métriques de fallback sont tracées

**Exemple de log** :
```
[2025-11-04T10:15:23Z] [ERROR] Bridge fallback triggered: Timeout exceeded
```

**Garantit** : Stabilité sur runs nocturnes et datasets massifs

---

## 📊 Monitoring des Bridges

### Vérifier les Versions

```bash
cat .reasoning_rl4/meta/bridges_versions.json
```

**Exemple de sortie** :
```json
{
  "meta": {
    "last_updated": "2025-11-04T10:00:00Z"
  },
  "bridges": {
    "pami": {
      "repo_commit": "abc123...",
      "bridge_version": "1.0.0",
      "avg_duration_ms": 234,
      "result_hash": "def456...",
      "last_used": "2025-11-04T10:15:00Z",
      "status": "active"
    }
  }
}
```

### Vérifier les Logs

```bash
# Logs PAMI
tail -f .reasoning_rl4/logs/bridges/pami.log

# Logs Merlion
tail -f .reasoning_rl4/logs/bridges/merlion.log

# Logs HyperTS
tail -f .reasoning_rl4/logs/bridges/hyperts.log
```

---

## 🧪 Validation des Résultats

### Mesurer l'Impact ML

```bash
# Avant ML (baseline)
npm run train -- --max-repos 10
cat .reasoning_rl4/kernel/cognitive_state.json

# Avec ML
npm run bootstrap-ml
npm run train -- --max-repos 10
cat .reasoning_rl4/kernel/cognitive_state.json
```

**Comparer** :
- `coherence_score` : doit augmenter de +0.3
- `patterns` (dans patterns.jsonl) : doit augmenter de +150%
- `forecast_precision` : doit passer de 0 à >0.4

### Dashboard de Suivi

```bash
npm run dashboard
```

Affiche l'évolution des métriques entre runs successifs.

---

## 🐛 Troubleshooting

### "Python3 not found"

```bash
# macOS
brew install python@3.9

# Ubuntu/Debian
sudo apt install python3.9 python3-pip

# Vérifier
python3 --version  # doit être >= 3.9
```

### "Bridge timeout"

Augmenter le timeout dans les engines :
```typescript
timeout: 600000  // 10min au lieu de 5min
```

### "Module not found"

```bash
# Réinstaller les dépendances
source bridges/venv/bin/activate
pip install -r bridges/requirements.txt
```

### "Java not found" (SPMF uniquement)

```bash
# macOS
brew install openjdk@11

# Ubuntu/Debian
sudo apt install openjdk-11-jdk

# Vérifier
java -version  # doit être >= 11
```

---

## 📚 Références

### Documentation des Dépôts Externes

| Dépôt | Documentation | Licence |
|-------|---------------|---------|
| [PAMI](https://github.com/UdayLab/PAMI) | [Docs](https://udayrage.github.io/PAMI/) | MIT |
| [Merlion](https://github.com/salesforce/Merlion) | [Docs](https://opensource.salesforce.com/Merlion/) | Apache-2.0 |
| [HyperTS](https://github.com/DataCanvasIO/HyperTS) | [Docs](https://hyperts.readthedocs.io/) | Apache-2.0 |
| [FP-Growth](https://github.com/MK-ek11/Frequent-Pattern-Mining-FP-Tree) | GitHub | MIT |
| [SPMF](https://github.com/philippe-fournier-viger/spmf) | [Website](https://www.philippe-fournier-viger.com/spmf/) | GPL-3.0 |

### Fichiers Clés

- `bridges/README.md` - Documentation des bridges
- `.reasoning_rl4/meta/external_repos.json` - Métadonnées repos
- `.reasoning_rl4/meta/bridges_versions.json` - Versioning
- `tasks.md` - Tâches Phase 3 (#22-#32)

---

## 🎓 Prochaines Étapes

1. ✅ **Installation** : `npm run bootstrap-ml`
2. ✅ **Tests** : `npm run test:bridges`
3. ✅ **Entraînement** : `npm run train:ml`
4. 📊 **Validation** : Vérifier montée de coherence
5. 🚀 **Production** : Entraîner sur 100+ repos

**Objectif Final** : Coherence >0.9, forecast_precision >0.75, universals >100

