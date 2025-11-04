# 🚀 Ready to Launch - RL4 Night Train

**Date** : 2025-11-04  
**Statut** : ✅ **SYSTÈME OPÉRATIONNEL**

---

## ✅ Pré-vol Checklist

### 1. Vérification du Build

```bash
npm run build
```

**Attendu** : ✅ Compilation sans erreur

### 2. Vérification des Garde-fous

```bash
# Test guard mémoire
npm run guard
```

**Attendu** :
```
📊 Workspace: 8.0G (limit: 9.5G)
✅ Taille OK
```

### 3. Vérification du Kernel

```bash
# Consolidation test
npm run consolidate

# Vérifier cognitive_state.json
cat .reasoning_rl4/kernel/cognitive_state.json | jq '{coherence_score, forecast_precision, universals}'
```

**Attendu** :
```json
{
  "coherence_score": 0,
  "forecast_precision": 0,
  "universals": 0
}
```

**C'est normal !** Les métriques sont à 0 car aucun entraînement complet n'a encore eu lieu.

### 4. Vérification du Dataset

```bash
# Nombre de repos disponibles
wc -l < datasets/repo-list.txt
```

**Recommandé** : ≥ 500 repos  
**Si < 500** : `npm run fetch-repos`

---

## 🚀 Lancement du Night Train

### Option 1 : Lancement Simple

```bash
cd /Users/valentingaludec/RL4-Trainer

# Créer dossier logs
mkdir -p logs

# Lancer (bloque le terminal)
npm run night-train
```

### Option 2 : Lancement en Background (RECOMMANDÉ)

```bash
cd /Users/valentingaludec/RL4-Trainer

# Créer dossier logs
mkdir -p logs

# Lancer en background
nohup npm run night-train > logs/night-train.out 2>&1 &

# Détacher du terminal
disown

# Noter le PID pour arrêt futur
echo $! > logs/night-train.pid
```

### Option 3 : Avec Surveillance Continue

Terminal 1 (Night Train) :
```bash
nohup npm run night-train > logs/night-train.out 2>&1 &
disown
```

Terminal 2 (Surveillance) :
```bash
tail -f logs/night-train.log
```

Terminal 3 (Guard Mémoire - optionnel) :
```bash
npm run watch-guard
```

---

## 📊 Logs Attendus

### Démarrage

```
🚀 [START] RL4 Night Run — 2025-11-04 22:00:00
🧩 [22:00:05] Starting training batch...
```

### Pendant l'Entraînement

```
[22:05:30] 🧩 Starting training for: repo-name
[22:06:15] ⚙️  Extracted 2,341 AST features
[22:07:20] 🧠 Patterns learned: +89
[22:08:10] 🔗 Correlations found: +23
[22:08:45] 📈 Forecast precision: 0.42
[22:09:00] 💾 Disk usage: 3.2G
```

### Consolidation (toutes les 2-3h)

```
🧠 [22:15:42] Consolidating kernel...
📊 [22:15:45] Kernel: coherence=0.52 | forecast=0.48 | universals=12
⏳ [22:15:45] Pause 10min avant relance...
```

### Progression

```
[00:30:15] 🧠 Kernel coherence: 0.52 → 0.67
[00:30:16] 🪶 Forecast precision: 0.48 → 0.58
[00:30:17] 💾 Disk usage: 5.8G
```

### Compactage Automatique (à 9.5 Go)

```
⚠️  [02:45:30] Workspace 9.6G > 9.5G — compactage...
💾 [02:45:31] Sauvegarde état pré-compactage...
🗜️  [02:46:10] Compactage en cours...
📦 [02:47:20] Auto-dump...
✅ [02:48:00] Compactage terminé: 9.6G → 7.2G
```

### Succès Final

```
✅ [SUCCESS] Objectifs atteints. Export du kernel...
📊 Kernel: coherence=0.92 | forecast=0.78 | universals=143
📦 Exporting kernel...
✅ Kernel exported to: .reasoning_rl4/exports/kernel_export_20251104.tar.gz.manifest.json
🏁 RL4 training terminé avec succès.
```

---

## 📈 Évolution des Métriques

### Phase 1 : Absorption (0-3 Go)
```
coherence_score: 0.00 → 0.45
forecast_precision: 0.00 → 0.30
universals: 0 → 15
```

**Interprétation** : Matière brute, bruit normal

### Phase 2 : Patterns (4-6 Go)
```
coherence_score: 0.45 → 0.70
forecast_precision: 0.30 → 0.55
universals: 15 → 45
```

**Interprétation** : Structures récurrentes émergent

### Phase 3 : Corrélations (7-9 Go)
```
coherence_score: 0.70 → 0.88
forecast_precision: 0.55 → 0.73
universals: 45 → 95
```

**Interprétation** : Régularités cross-repo

### Phase 4 : Cognition (>9 Go)
```
coherence_score: 0.88 → 0.92 ✅
forecast_precision: 0.73 → 0.78 ✅
universals: 95 → 143 ✅
```

**Interprétation** : Objectifs atteints → Export

---

## 🛑 Arrêt du Système

### Arrêt Propre

```bash
# Trouver le PID
cat logs/night-train.pid

# Arrêter proprement
kill -TERM $(cat logs/night-train.pid)
```

### Arrêt d'Urgence

```bash
# Tuer tous les processus node
pkill -f "night-train"
pkill -f "trainBatch"
```

### Sauvegarde Avant Arrêt

```bash
# Consolider une dernière fois
npm run consolidate

# Exporter kernel
cat .reasoning_rl4/kernel/cognitive_state.json | jq
```

---

## 🔍 Diagnostics

### Problème : Le kernel ne progresse pas

```bash
# Vérifier que les fichiers sont créés
ls -lh .reasoning_rl4/*.jsonl
ls -lh .reasoning_rl4/kernel/

# Vérifier les logs
tail -100 logs/night-train.log

# Forcer consolidation
npm run consolidate
```

### Problème : Workspace sature

```bash
# Check immédiat
npm run guard

# Compactage manuel
npm run compact
npm run auto-dump

# Vérifier nouvelle taille
du -sh .
```

### Problème : Pas de forecasts générés

```bash
# Vérifier patterns
wc -l .reasoning_rl4/patterns.jsonl

# Vérifier corrélations
wc -l .reasoning_rl4/correlations.jsonl

# Si vides → problème dans le pipeline
# Relancer avec 1 repo pour debug :
npm run train -- --max-repos 1
```

---

## 📞 Commandes Utiles

### Monitoring

```bash
# État actuel du kernel
watch -n 60 'cat .reasoning_rl4/kernel/cognitive_state.json | jq "{coherence_score, forecast_precision, universals}"'

# Taille workspace
watch -n 300 'du -sh .'

# Progression logs
tail -f logs/night-train.log | grep -E "(coherence|precision|universals)"
```

### Maintenance

```bash
# Nettoyer tout et recommencer
npm run clean
npm run build
npm run consolidate

# Sauvegarder état actuel
cp -r .reasoning_rl4/kernel .reasoning_rl4/kernel.backup.$(date +%Y%m%d)
```

---

## 🎯 Objectif Final Rappel

```json
{
  "coherence_score": 0.9,           ← > 0.9 requis
  "forecast_precision": 0.75,       ← > 0.75 requis
  "universals": 100,                ← > 100 requis
  "reasoning_depth": 4,             ← ✅
  "avg_correlation_strength": 0.6   ← > 0.6 recommandé
}
```

Quand ces objectifs sont atteints :
```
✅ Kernel exporté automatiquement
✅ Night-train s'arrête proprement
✅ Fichier: .reasoning_rl4/exports/kernel_export_YYYYMMDD.tar.gz
```

---

## ✨ Lancement Recommandé

```bash
# 1. Vérifications pré-vol
npm run build
npm run guard
npm run consolidate

# 2. Lancer night-train
nohup npm run night-train > logs/night-train.out 2>&1 &
disown

# 3. Surveiller
tail -f logs/night-train.log

# 4. Le matin, vérifier
cat .reasoning_rl4/kernel/cognitive_state.json | jq
```

---

**🚀 Le système est prêt. Bon entraînement ! 🧠**

