# Bridges ML - RL4-Trainer

Ce dossier contient les bridges Python/Shell pour intégrer les 5 dépôts ML externes dans le pipeline cognitif RL4.

## Architecture

Chaque bridge agit comme un **tuteur cognitif** qui renforce la mémoire structurante du RL4 en appliquant des méthodes éprouvées de pattern mining et time-series analysis.

## Bridges Disponibles

| Bridge | Rôle | Layer | Input | Output |
|--------|------|-------|-------|--------|
| `pami_bridge.py` | Pattern mining avancé | Analytical | Timeline CSV | Patterns + support + confidence |
| `merlion_bridge.py` | Causalité & anomalies | Reflective | Timeline JSONL + correlations | Correlations raffinées |
| `hyperts_bridge.py` | Forecasting ML | Forecast | Correlations + timeline | Forecasts probabilistes |
| `fpgrowth_bridge.py` | Mining haute performance | Analytical | Timeline CSV | Patterns (>10k séquences) |
| `spmf_bridge.sh` | Patterns structurels | Structural | Inter-file dependencies | Universals (>100) |

## Installation

```bash
# Depuis la racine du projet
bash scripts/bootstrap-ml-modules.sh
```

Ce script :
1. Clone les 5 dépôts dans `ml-modules/`
2. Installe les requirements Python
3. Vérifie Java 11+ pour SPMF
4. Valide l'environnement

## Utilisation

Les bridges sont appelés automatiquement par les engines correspondants :

- `PatternLearningEngineV2` → `pami_bridge.py` ou `fpgrowth_bridge.py`
- `CorrelationEngineV2` → `merlion_bridge.py`
- `ForecastEngineV3` → `hyperts_bridge.py`

## Interface Bridge

Tous les bridges Python suivent la même interface :

**Input** : JSON via stdin
```json
{
  "repo": "repo-name",
  "timeline": [...],
  "config": {}
}
```

**Output** : JSON via stdout
```json
{
  "success": true,
  "data": [...],
  "metadata": {
    "duration_ms": 1234,
    "patterns_found": 42
  }
}
```

## Gestion d'Erreur

En cas d'erreur ou timeout > 300s :
- Le système revient sur la méthode native
- Les erreurs sont loguées dans `.reasoning_rl4/logs/bridges/*.log`
- Le training continue sans interruption

## Versioning

Chaque bridge écrit ses métadonnées dans `.reasoning_rl4/meta/bridges_versions.json` :
- Commit SHA du dépôt externe
- Version du bridge local
- Durée moyenne d'exécution
- Hash du résultat

## Requirements

- Python 3.9+
- Java 11+ (SPMF uniquement)
- 4 GB RAM minimum
- Voir `requirements.txt` pour les dépendances Python

## Développement

Pour créer un nouveau bridge :

1. Créer `bridges/my_bridge.py`
2. Implémenter l'interface stdin/stdout JSON
3. Ajouter dans `external_repos.json`
4. Intégrer dans l'engine correspondant
5. Ajouter les tests

## Logs

Les logs des bridges sont stockés dans :
```
.reasoning_rl4/logs/bridges/
├── pami.log
├── merlion.log
├── hyperts.log
├── fpgrowth.log
└── spmf.log
```

Format : `[TIMESTAMP] [LEVEL] [BRIDGE] message`

