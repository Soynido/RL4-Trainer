# QuickStart RL4-Trainer v1.0.0

**Guide de démarrage rapide pour la Phase 3 - ML Integration**

---

## ⚡ Démarrage en 3 Étapes

### 1. Installer les Modules ML (5 min)

```bash
npm run bootstrap-ml
```

**Ce qui se passe** :
- ✅ Vérification Python 3.9+ et Java 11+
- ✅ Clone des 5 dépôts ML (PAMI, Merlion, HyperTS, FP-Growth, SPMF)
- ✅ Création environnement virtuel Python
- ✅ Installation des dépendances
- ✅ Mise à jour `bridges_versions.json`

### 2. Tester les Bridges (30 sec)

```bash
npm run test:bridges
```

**Résultat attendu** :
```
✓ 6/6 tests passed
✓ PAMI : 6 patterns
✓ Merlion : 2 corrélations
✓ HyperTS : 1 forecast
✓ FP-Growth : 37 patterns
```

### 3. Entraîner avec ML (2 min)

```bash
# Test sur 10 repos
npm run train:ml

# Production sur 100 repos (Phase 2)
npm run train -- --max-repos 100
```

**Résultat attendu** :
- coherence_score : 0.21 → 0.5+
- patterns_detected : +150%
- avg_correlation_strength : +40%

---

## 📊 Vérifier les Résultats

### Métriques Cognitives

```bash
# État cognitif consolidé
cat .reasoning_rl4/kernel/cognitive_state.json

# Patterns générés
wc -l .reasoning_rl4/patterns.jsonl

# Dashboard interactif
npm run dashboard
```

### Logs des Bridges

```bash
# Logs PAMI
tail -f .reasoning_rl4/logs/bridges/pami.log

# Logs Merlion
tail -f .reasoning_rl4/logs/bridges/merlion.log

# Tous les logs
ls -lh .reasoning_rl4/logs/bridges/
```

### Versioning

```bash
# Vérifier les versions des bridges
cat .reasoning_rl4/meta/bridges_versions.json

# Vérifier les dépôts ML
cat .reasoning_rl4/meta/external_repos.json
```

---

## 🎯 Roadmap d'Entraînement

### Phase 1 : Absorption (0-3 Go, coherence <0.5)

```bash
# 10 repos test
npm run train:ml

# 50 repos validation
npm run train -- --max-repos 50
```

**Objectif** : Familiarisation avec le pipeline ML

### Phase 2 : Patterns (4-6 Go, coherence 0.5-0.7)

```bash
# 100 repos
npm run train -- --max-repos 100

# 200 repos
npm run train -- --max-repos 200
```

**Objectif** : Atteindre coherence >0.5, patterns_detected >2000

### Phase 3 : Corrélations (7-9 Go, coherence >0.8)

```bash
# 500 repos
npm run train -- --max-repos 500

# 1000 repos
npm run train-all
```

**Objectif** : Coherence >0.8, forecast_precision >0.6

### Phase 4 : Cognition (>9 Go, coherence >0.9)

```bash
# Vérifier conditions
npm run check-phase4

# Activer Phase 4 (SPMF)
npm run activate-phase4

# Continuer entraînement
npm run train -- --max-repos 1000
```

**Objectif** : Universals >100, coherence >0.9, export kernel

---

## 🔧 Commandes Utiles

### Maintenance

```bash
# Nettoyer les ledgers
npm run clean-ledgers

# Compacter le ledger
npm run compact

# Consolider le kernel
npm run consolidate

# Exporter le kernel
npm run export-kernel
```

### Monitoring

```bash
# Vérifier progression
bash scripts/check-progress.sh

# Surveiller workspace
npm run guard

# Dashboard métriques
npm run dashboard
```

### Debug

```bash
# Compiler
npm run build

# Voir les logs
ls -lh .reasoning_rl4/logs/

# Voir les métriques
cat .reasoning_rl4/metrics/stats.json
```

---

## ⚠️ Troubleshooting

### "Python3 not found"

```bash
# macOS
brew install python@3.9

# Vérifier
python3 --version  # >= 3.9
```

### "Bridge timeout"

Augmenter le timeout dans les engines TypeScript :
```typescript
timeout: 600000  // 10min
```

### "Merlion failed"

Le fallback automatique s'active. Vérifier les logs :
```bash
cat .reasoning_rl4/logs/bridges/merlion.log
```

### "Java not found" (SPMF uniquement)

```bash
# macOS
brew install openjdk@11

# Vérifier
java -version  # >= 11
```

---

## 📈 Métriques Cibles

| Phase | Coherence | Forecast Precision | Universals | Volume |
|-------|-----------|-------------------|------------|--------|
| Phase 1 | <0.5 | 0-0.3 | 0-10 | 0-3 Go |
| Phase 2 | 0.5-0.7 | 0.4-0.5 | 20-50 | 4-6 Go |
| Phase 3 | 0.8-0.9 | 0.6-0.7 | 50-100 | 7-9 Go |
| Phase 4 | >0.9 | >0.75 | >100 | >9 Go |

---

## 🎓 Prochaines Étapes

1. ✅ **Installation** : `npm run bootstrap-ml` (fait)
2. ✅ **Tests** : `npm run test:bridges` (validé)
3. ✅ **Entraînement test** : `npm run train:ml` (validé)
4. ⏳ **Phase 2** : Entraîner sur 100+ repos
5. ⏳ **Phase 3** : Entraîner sur 500+ repos
6. ⏳ **Phase 4** : Activer SPMF (universals >100)

---

## 📚 Documentation Complète

| Document | Rôle |
|----------|------|
| **READY_FOR_TAG_v1.0.0.md** | Checklist tag v1.0.0 |
| **VALIDATION_ML_REPORT.md** | Résultats validation terrain |
| **ML_INTEGRATION_GUIDE.md** | Guide complet ML |
| **PHASE_3_COMPLETION_REPORT.md** | Rapport technique |
| **CHANGELOG.md** | Journal de version |
| **QUICKSTART_v1.0.0.md** | Ce guide |

---

**Version** : v1.0.0  
**Statut** : Production Ready 🚀  
**Date** : 2025-11-04

