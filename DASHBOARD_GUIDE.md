# 📊 Dashboard Guide - RL4 Trainer

## Vue d'ensemble

Le **Dashboard** du RL4-Trainer permet de suivre l'évolution des performances cognitives du système entre les différents runs d'entraînement. Il agrège automatiquement les données des fichiers `training-summary-*.json` et calcule les tendances.

## 🚀 Utilisation

### Commande de base

```bash
npm run dashboard
```

### Exemple de sortie

```
📊 RL4 Training Dashboard
============================================================
Runs total: 5
Last run: 2025-11-03T22:16:26.284Z
Repositories: 200
------------------------------------------------------------
Patterns           15006   +310.6%  📈
Correlations      172269   +140.1%  📈
Forecasts            213   +334.7%  📈
ADRs                  49   +276.9%  📈
AvgCycleTime        6991     +1.9%  📈
------------------------------------------------------------
🧠 Cognitive density: 75.0 patterns/repo
🔗 Correlation rate: 11.48 correlations/pattern
============================================================

💾 Saved summary to .reasoning_rl4/metrics/dashboard-latest.json
```

## 📈 Métriques Affichées

### Métriques principales

| Métrique | Description | Interprétation |
|----------|-------------|----------------|
| **Patterns** | Nombre total de patterns détectés | Plus = meilleure détection |
| **Correlations** | Nombre total de corrélations trouvées | Plus = meilleur apprentissage |
| **Forecasts** | Nombre de prédictions générées | Plus = meilleur raisonnement |
| **ADRs** | Nombre d'ADRs créés | Plus = meilleures recommandations |
| **AvgCycleTime** | Temps moyen par cycle (ms) | Moins = meilleures performances |

### Métriques dérivées

| Métrique | Calcul | Interprétation |
|----------|--------|----------------|
| **Cognitive density** | `patterns / repos` | Richesse de l'extraction par repo |
| **Correlation rate** | `correlations / patterns` | Qualité des liens détectés |

## 🔍 Interprétation des Tendances

### Symboles

- 📈 **Tendance positive** : La métrique a augmenté
- 📉 **Tendance négative** : La métrique a diminué
- ⚖️ **Stable** : Pas de changement significatif

### Pourcentages

- **Positif (+)** : Amélioration par rapport au run précédent
- **Négatif (-)** : Régression par rapport au run précédent
- **–** : Pas de données de comparaison (premier run)

## 📊 Export JSON

Le dashboard exporte automatiquement les données dans :

```
.reasoning_rl4/metrics/dashboard-latest.json
```

### Structure du fichier

```json
{
  "latest": {
    "time": "2025-11-03T22:16:26.284Z",
    "patterns": 15006,
    "correlations": 172269,
    "forecasts": 213,
    "adrs": 49,
    "avgCycle": 6991,
    "repos": 200,
    "duration": 233379
  },
  "previous": {
    "time": "...",
    "patterns": 3655,
    ...
  },
  "runs": [
    {...},
    {...}
  ]
}
```

## 💡 Cas d'usage

### 1. Suivi de progression

Après chaque entraînement batch :

```bash
npm run train -- --max-repos 100
npm run dashboard
```

Vous voyez immédiatement si le RL4 s'améliore.

### 2. Validation d'amélioration

Après modification des engines cognitifs :

```bash
# Baseline
npm run train
npm run dashboard  # Noter les métriques

# Modification du code (ex: PatternLearningEngine)
# ...

# Re-entraînement
npm run train
npm run dashboard  # Comparer avec baseline
```

### 3. Détection de régression

Si une métrique baisse significativement :
- **Patterns ↓** : Vérifier PatternLearningEngine
- **Correlations ↓** : Vérifier CorrelationEngine
- **Forecasts ↓** : Vérifier ForecastEngine
- **ADRs ↓** : Vérifier ADRGeneratorV2
- **AvgCycleTime ↑** : Optimiser les performances

### 4. Monitoring continu

Intégrer dans un pipeline CI/CD :

```bash
#!/bin/bash
npm run train -- --max-repos 50
npm run dashboard > dashboard-output.txt
# Analyser dashboard-output.txt
# Alerter si régression > 10%
```

## 🎯 Objectifs de Performance

### Valeurs cibles

| Métrique | Cible | Excellent |
|----------|-------|-----------|
| Cognitive density | > 50 patterns/repo | > 100 patterns/repo |
| Correlation rate | > 5 corr/pattern | > 10 corr/pattern |
| AvgCycleTime | < 10000ms | < 5000ms |
| Progression Patterns | +10% par run | +20% par run |
| Progression Correlations | +15% par run | +25% par run |

### Signaux d'alerte

- ⚠️ **Baisse > 20%** sur une métrique principale → Régression critique
- ⚠️ **AvgCycleTime > 15000ms** → Problème de performance
- ⚠️ **Cognitive density < 20** → Détection insuffisante
- ⚠️ **Correlation rate < 2** → Apprentissage faible

## 🔗 Intégration avec Reasoning Layer V3

Les données du dashboard peuvent être utilisées pour :

1. **Validation des meta-ADRs** : Vérifier si les recommandations améliorent les métriques
2. **Calibration automatique** : Ajuster les poids des engines selon les tendances
3. **Reporting** : Générer des rapports d'amélioration continue
4. **A/B Testing** : Comparer différentes versions du RL4

## 📝 Notes

- Le dashboard compare toujours avec le run **précédent** (pas le premier)
- Les données sont persistées dans `dashboard-latest.json`
- Pour réinitialiser : supprimer les fichiers `training-summary-*.json`
- Les runs sont triés par date de modification du fichier

## 🛠️ Troubleshooting

### Erreur "No training-summary files found"

```bash
# Lancer au moins un entraînement
npm run train -- --max-repos 1
npm run dashboard
```

### Métriques à zéro

Vérifier que les training-summary contiennent bien les stats :

```bash
cat .reasoning_rl4/diagnostics/training-summary-*.json | jq '.results[0].stats'
```

### Dashboard ne se met pas à jour

Vérifier les timestamps des fichiers :

```bash
ls -lt .reasoning_rl4/diagnostics/training-summary-*.json
```

---

**Version** : 1.0.0  
**Date** : 2025-11-03

