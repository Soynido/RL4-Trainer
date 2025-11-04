# Progressive Training Loop - RL4-Trainer

**Entraînement par batch avec rotation automatique et gestion mémoire optimisée**

---

## 🎯 Objectif

Maintenir le workspace **≤ 10 Go** permanent tout en entraînant sur des milliers de repos.

### Principe

- **Batch de 200 repos** : taille optimale pour saturer le pattern space sans exploser la RAM
- **Rotation automatique** : dès que workspace > 9.5 Go → compactage + archive + purge
- **Kernel persistant** : seul le substrat cognitif (~1 Go) est conservé entre batches

---

## 📦 Structure des Dossiers

| Dossier | Rôle | Taille max |
|---------|------|------------|
| `.reasoning_rl4/ledger/` | Cycles actifs (temp) | ≤ 2 Go |
| `.reasoning_rl4/kernel/` | Mémoire consolidée | ≤ 1 Go |
| `.reasoning_rl4/archives/` | Ledgers compactés (.gz) | ≤ 1 Go |
| `datasets/corpus/` | Repos clonés (temp) | ≤ 5 Go |
| `archives/substrate/` | Substrats par batch | ≤ 1 Go |
| **Total** | | **≤ 10 Go** |

---

## 🔄 Workflow Progressive Training

### 1. Entraînement par Batch (200 repos)

```bash
# Batch automatique avec rotation
npm run train-all
```

Ce script exécute :

```
Pour chaque batch de 200 repos:
  1. Train sur 200 repos → génère ledger (~2-4 Go)
  2. Compact → extrait kernel state (~200 MB)
  3. Archive → ledger-dump-YYYYMMDD.jsonl.gz (~500 MB)
  4. Purge → supprime ledger + corpus
  5. Continue → batch suivant
```

### 2. Rotation Automatique

Le système vérifie **automatiquement** après chaque batch si workspace > 9.5 Go.

**Intégré dans `trainBatch.ts`** :
```typescript
await autoDumpIfNeeded(); // Auto-rotation si > 9.5 GB
```

**Commande manuelle** :
```bash
npm run auto-dump
```

### 3. Compactage du Ledger

Extrait seulement les meta-patterns et substrat cognitif :

```bash
npm run compact
```

**Génère** :
- `.reasoning_rl4/kernel/state.json` (~200 MB)
- Contient : meta-patterns, ADRs, statistiques

**Supprime** :
- Cycles bruts complets (patterns, correlations, forecasts détaillés)

### 4. Fusion Multi-Batches

Après plusieurs batches, fusionner les substrats :

```bash
npm run merge-kernels
```

**Génère** :
- `.reasoning_rl4/kernel/global_state.json`
- État cognitif consolidé de tous les batches

---

## ⚡ Économie d'Espace

| Étape | Taille ledger | Taille kernel | Workspace total |
|-------|---------------|---------------|-----------------|
| Après batch 1 (200 repos) | 8 Go | 200 Mo | ~8.5 Go |
| **Après compact + purge** | **0 Go** | **200 Mo** | **~0.5 Go** |
| Après batch 2 (200 repos) | 8 Go | 230 Mo | ~8.5 Go |
| **Après compact + purge** | **0 Go** | **230 Mo** | **~0.5 Go** |
| Après 5 batches (1000 repos) | - | 300 Mo | **~0.8 Go** |

**Gain** : 40 Go → 0.8 Go = **compression ×50**

---

## 🚀 Commandes Disponibles

### Entraînement

```bash
# Batch unique de 200 repos
npm run train -- --max-repos 200 --concurrency 8

# Progressive training loop (tous les repos par batches)
npm run train-all

# Avec rotation manuelle
npm run train -- --max-repos 200 && npm run compact
```

### Gestion Mémoire

```bash
# Auto-dump (rotation si nécessaire)
npm run auto-dump

# Compacter ledger actuel
npm run compact

# Fusionner tous les kernel states
npm run merge-kernels

# Nettoyer anciens ledgers
npm run clean-ledgers
```

### Monitoring

```bash
# Vérifier la taille workspace
du -sh .

# Détail par composant
du -sh .reasoning_rl4/{ledger,kernel,archives} datasets/corpus

# Check progression batch en cours
bash scripts/check-progress.sh
```

---

## 📊 Exemple de Session Complète

### Session 1 : Premier Batch (repos 1-200)

```bash
# 1. Entraîner
npm run train -- --max-repos 200 --concurrency 8
# → Génère ~8 Go de ledger

# 2. Compacter
npm run compact
# → Kernel state: 200 MB
# → Ledger réduit

# 3. Archiver et purger
bash scripts/rotate-ledger.sh
# → Archive: ledger-dump-20251103.jsonl.gz (500 MB)
# → Workspace: ~0.5 Go
```

### Session 2 : Deuxième Batch (repos 201-400)

```bash
# Même workflow
npm run train -- --max-repos 200 --concurrency 8
npm run compact
bash scripts/rotate-ledger.sh
# → Workspace reste ≤ 1 Go
```

### Session N : Fusion Finale

```bash
# Après 5 batches (1000 repos)
npm run merge-kernels
# → global_state.json : état cognitif complet (~300 MB)
```

---

## 🧠 Substrat Cognitif

Le **kernel state** contient :

```json
{
  "version": "1.0.0",
  "generatedAt": "2025-11-03T23:30:00.000Z",
  "batches": 1,
  "totalRepos": 200,
  "totalCycles": 200,
  "consolidated": {
    "patterns": [
      {
        "type": "refactor",
        "confidence": 0.85,
        "frequency": 1250,
        "repos": ["repo1", "repo2", ...]
      }
    ],
    "metaADRs": [
      {
        "id": "...",
        "priority": "high",
        "recommendation": "...",
        "impact": "..."
      }
    ]
  },
  "statistics": {
    "totalPatterns": 15000,
    "totalCorrelations": 172000,
    "totalForecasts": 200,
    "totalADRs": 49,
    "avgPatternsPerRepo": 75,
    "avgCorrelationsPerPattern": 11.5
  },
  "merkleRoot": "abc123..."
}
```

**Avantages** :
- ✅ Compact : 200 MB vs 8 Go de ledger brut
- ✅ Exploitable : patterns consolidés, ADRs priorisés
- ✅ Fusionnable : merge possible entre batches
- ✅ Versionnable : Git-friendly (petit fichier JSON)

---

## 📈 Stratégie Multi-Batches (1000+ Repos)

### Approche Recommandée

```bash
# Batch 1 : 200 repos
npm run train -- --max-repos 200 --concurrency 8
npm run compact

# Batch 2 : 200 repos suivants
npm run train -- --max-repos 200 --concurrency 8
npm run compact

# ... répéter jusqu'à N batches

# Fusion finale
npm run merge-kernels
```

### Approche Automatisée

```bash
# Lance tous les batches automatiquement
npm run train-all
```

Le script `trainAll.sh` :
- Découpe `repo-list.txt` en tranches de 200
- Entraîne chaque tranche
- Compacte et archive automatiquement
- Purge entre chaque batch
- Produit N kernel states dans `archives/substrate/`

---

## 🔧 Configuration Avancée

### Ajuster le Seuil de Rotation

Éditer `trainer/autoDumpManager.ts` :

```typescript
const MAX_GB = 9.5; // Modifier selon votre RAM disponible
```

### Ajuster la Taille de Batch

Éditer `scripts/trainAll.sh` :

```bash
BATCH_SIZE=200  # 200 recommandé, max 300
```

### Augmenter la Heap Node (si besoin)

Pour les batches > 200 repos :

```bash
export NODE_OPTIONS="--max-old-space-size=16384"
npm run train -- --max-repos 300
```

---

## 📊 Monitoring & Diagnostics

### Vérifier l'État Actuel

```bash
# Taille workspace
du -sh .

# Détail composants
du -sh .reasoning_rl4/{ledger,kernel,archives} datasets/corpus

# Kernel state actuel
cat .reasoning_rl4/kernel/state.json | jq '{repos: .totalRepos, patterns: .consolidated.patterns | length, adrs: .consolidated.metaADRs | length}'

# Archives disponibles
ls -lh .reasoning_rl4/archives/
```

### Logs de Rotation

Les rotations sont loggées automatiquement dans les logs du training :

```bash
tail -f trainer/logs/training.log | grep -E "(Checking workspace|Workspace rotated)"
```

---

## 🎯 Critères de Succès

✅ **Workspace ≤ 10 Go** : Toujours  
✅ **Batch size** : 200 repos optimal  
✅ **Kernel state** : ≤ 300 MB final  
✅ **Archives** : Compression ≥ 10:1  
✅ **Pas de perte** : Substrat cognitif préservé  

---

## 🔄 Intégration avec Reasoning Layer V3

### Workflow Complet

```bash
# 1. Entraîner par batches (RL4-Trainer)
cd RL4-Trainer
npm run train-all  # 1000 repos en 5 batches

# 2. Fusionner les substrats
npm run merge-kernels  # → global_state.json

# 3. Extraire les meta-ADRs
node dist/feedback/FeedbackEngine.js

# 4. Appliquer dans RL V3
cd ../Reasoning-Layer-V3
# Implémenter les recommandations du global_state.json

# 5. Valider
cd ../RL4-Trainer
npm run train -- --max-repos 50  # Test rapide
```

---

## 💡 Best Practices

### ✅ À FAIRE

- Toujours utiliser batches de 200 repos max
- Laisser autoDumpManager gérer la rotation
- Archiver les kernel states importants
- Fusionner les substrats régulièrement

### ❌ À ÉVITER

- Ne jamais lancer > 300 repos sans rotation
- Ne jamais accumuler > 10 Go sans purge
- Ne jamais supprimer `.reasoning_rl4/kernel/` (mémoire persistante)
- Ne jamais relancer un batch sans avoir compacté le précédent

---

## 🚨 Troubleshooting

### "Out of Memory" ou Node crash

```bash
# Solution 1: Réduire concurrency
npm run train -- --max-repos 200 --concurrency 4

# Solution 2: Augmenter heap
export NODE_OPTIONS="--max-old-space-size=8192"
npm run train -- --max-repos 200
```

### Workspace > 15 Go

```bash
# Rotation manuelle immédiate
bash scripts/rotate-ledger.sh

# Ou clean complet
npm run clean
rm -rf .reasoning_rl4/ledger/*
rm -rf datasets/corpus/*
```

### Kernel state corrompu

```bash
# Reconstruire depuis archive
gunzip -c .reasoning_rl4/archives/ledger-dump-YYYYMMDD.jsonl.gz > temp-ledger.jsonl
# Puis recompact
npm run compact
```

---

## 📄 Fichiers Créés

- `scripts/trainAll.sh` : Boucle progressive automatique
- `scripts/rotate-ledger.sh` : Rotation manuelle  
- `scripts/compact-ledger.ts` : Digestion ledger → kernel
- `scripts/merge-kernel-states.ts` : Fusion multi-batches
- `trainer/autoDumpManager.ts` : Rotation automatique intégrée

---

**Le RL4-Trainer est maintenant optimisé pour entraîner sur datasets massifs avec contraintes mémoire strictes** 🚀

