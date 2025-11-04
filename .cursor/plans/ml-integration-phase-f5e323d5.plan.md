<!-- f5e323d5-2db6-4790-9a45-d865d17fe63a 13ad07aa-c227-477d-b5d6-42581ae6814e -->
# Plan d'Intégration ML - Phase 3

## Contexte

Le pipeline fonctionne et le kernel s'écrit correctement. Actuellement en phase d'absorption (coherence = 0.21).

**Objectif** : Greffer les modules d'analyse ML intelligents AVANT la montée en charge (Phase 2-3) pour éviter l'accumulation de bruit statistique et faire monter la coherence à >0.9.

**Ancrage conceptuel** :

> Le but de cette phase n'est pas d'ajouter du calcul, mais de renforcer la mémoire structurante du RL4.
> 
> Les modèles ML servent de **tuteurs cognitifs** pour extraire, pondérer et stabiliser les régularités que le moteur interne détecte déjà.

Cette intégration ne substitue pas le raisonnement natif, elle l'amplifie et le valide par des méthodes éprouvées de pattern mining et time-series analysis.

## Architecture Cible

Les 5 dépôts ML seront intégrés via des bridges Python dans les couches existantes :

- **PAMI** → PatternLearningEngineV2 (Analytical Layer)
- **Merlion** → CorrelationEngineV2 (Reflective Layer)  
- **HyperTS** → ForecastEngineV3 (Forecast Layer)
- **FP-Growth** → PatternLearningEngineV2 (optimisation volume)
- **SPMF** → Patterns structurels (universals >100)

## Table de Provenance (Auto-clonage)

| Module | Repository | License | Integration | Layer |
|---------|-------------|----------|--------------|--------|
| **PAMI** | https://github.com/UdayLab/PAMI | MIT | PatternLearningEngineV2 | Analytical |
| **FP-Growth** | https://github.com/MK-ek11/Frequent-Pattern-Mining-FP-Tree | MIT | PatternLearningEngineV2 (opt.) | Analytical |
| **Merlion** | https://github.com/salesforce/Merlion | Apache-2.0 | CorrelationEngineV2 | Reflective |
| **HyperTS** | https://github.com/DataCanvasIO/HyperTS | Apache-2.0 | ForecastEngineV3 | Forecast |
| **SPMF** | https://github.com/philippe-fournier-viger/spmf | GPL-3.0 | spmf_bridge.sh | Structural |

Cette table sera transformée automatiquement en JSON pour `meta/external_repos.json`.

## Étapes d'Implémentation

### 1. Infrastructure de Base

**Créer structure bridges/**

```
bridges/
├── pami_bridge.py
├── merlion_bridge.py
├── hyperts_bridge.py
├── fpgrowth_bridge.py
├── spmf_bridge.sh
└── requirements.txt
```

**Créer dossier meta/** pour traçabilité

```
.reasoning_rl4/meta/
└── external_repos.json
```

Ce fichier documentera :

- Nom du dépôt
- URL GitHub
- Rôle dans RL4
- Licence
- Version/commit hash utilisé

**Script bootstrap** : `scripts/bootstrap-ml-modules.sh`

Automatisera :

- Clone des 5 dépôts dans `ml-modules/`
- Installation des requirements Python
- Vérification des dépendances Java (SPMF)
- Validation de l'environnement

### 2. PAMI - Analytical Layer (Priorité 1)

**Objectif** : Faire passer coherence de 0.2 → 0.5 sur 100+ repos

**Fichier** : `bridges/pami_bridge.py`

**Intégration** : `kernel/engines/PatternLearningEngineV2.ts` (ligne ~262)

Ajout après `extractSequences()` :

```typescript
// Appel PAMI pour mining avancé
const pamiPatterns = await this.callPAMI(timeline);
sequences.push(...pamiPatterns);
```

**Input** : Timeline CSV (commit → action → type → fichier)

**Output** : JSON avec patterns + support + confidence

**Métriques attendues** :

- +150% patterns détectés
- Coherence 0.2 → 0.5

### 3. Merlion - Reflective Layer (Priorité 2)

**Objectif** : Améliorer détection de causalité et precision prédictive

**Fichier** : `bridges/merlion_bridge.py`

**Intégration** : `kernel/engines/CorrelationEngineV2.ts` (ligne ~198)

Ajout après `findCausalCorrelations()` :

```typescript
// Raffiner avec Merlion
const refined = await this.refineCausalitiesWithMerlion(correlations, timelines);
return refined;
```

**Input** : Timeline JSONL + corrélations brutes

**Output** : Corrélations raffinées + détection anomalies

**Métriques attendues** :

- Coherence 0.5 → 0.8
- Détection premiers universals récurrents

### 4. HyperTS - Forecast Layer (Priorité 3)

**Objectif** : Ajouter couche probabiliste ML aux forecasts

**Fichier** : `bridges/hyperts_bridge.py`

**Intégration** : `kernel/engines/ForecastEngineV3.ts` (ligne ~178)

Ajout après `predictNextPatterns()` :

```typescript
// Enrichir avec ML forecasting
const mlForecasts = await this.enrichWithHyperTS(forecasts, timeline);
return this.mergeForecasts(forecasts, mlForecasts);
```

**Input** : Corrélations JSON + timeline

**Output** : Forecasts ML avec probabilités

**Métriques attendues** :

- forecast_precision 0 → 0.4-0.6
- Vraisemblance des prévisions

### 5. FP-Growth - Optimisation Volume (Priorité 4)

**Objectif** : Accélérer mining sur >10k séquences

**Fichier** : `bridges/fpgrowth_bridge.py`

**Intégration** : Switch automatique dans `PatternLearningEngineV2.ts`

```typescript
if (timelineCount > 10000) {
  return this.callFPGrowth(timeline);
} else {
  return this.callPAMI(timeline);
}
```

**Métriques attendues** :

- Réduction temps calcul ×5-10
- Stabilité sur >9 Go dataset

### 6. SPMF - Universals Structurels (Phase 4)

**Objectif** : Trouver patterns structurels universels (>100)

**Fichier** : `bridges/spmf_bridge.sh`

**Intégration** : Batch final uniquement (>200 repos)

Wrapper CLI Java pour PrefixSpan

**Métriques attendues** :

- Universals >100
- Coherence >0.9 (Phase 4)

## Mise à Jour tasks.md

Nouvelle section **Phase 3 - ML Integration** avec 12 nouvelles tâches :

```
#22 - Créer structure bridges/ + requirements.txt
#23 - Créer meta/external_repos.json
#24 - Implémenter bootstrap-ml-modules.sh
#25 - Implémenter pami_bridge.py
#26 - Intégrer PAMI dans PatternLearningEngineV2
#27 - Tester PAMI sur 10 repos
#28 - Implémenter merlion_bridge.py
#29 - Intégrer Merlion dans CorrelationEngineV2
#30 - Implémenter hyperts_bridge.py
#31 - Intégrer HyperTS dans ForecastEngineV3
#32 - Implémenter fpgrowth_bridge.py (optimisation)
#33 - Implémenter spmf_bridge.sh (optionnel Phase 4)
```

## Ordre d'Exécution Recommandé

1. **Infrastructure** (#22-24) → 1h
2. **PAMI** (#25-27) → 3h → Valider montée coherence
3. **Merlion** (#28-29) → 2h → Valider causalité
4. **HyperTS** (#30-31) → 2h → Valider forecast_precision
5. **FP-Growth** (#32) → 1h → Optimisation
6. **SPMF** (#33) → Phase 4 uniquement

**Total estimé** : 9-12h de développement

## Fichiers Clés à Modifier

- `kernel/engines/PatternLearningEngineV2.ts` (lignes 262-295)
- `kernel/engines/CorrelationEngineV2.ts` (lignes 131-198)
- `kernel/engines/ForecastEngineV3.ts` (lignes 137-178)
- `tasks.md` (nouvelle section Phase 3)
- `package.json` (nouveaux scripts bootstrap)
- `README.md` (section ML Integration)

## Validation

Après chaque intégration, mesurer et comparer aux cibles par phase :

```json
{
  "phase_2_target": {
    "coherence_score": 0.5,
    "patterns_detected": 2000
  },
  "phase_3_target": {
    "coherence_score": 0.8,
    "forecast_precision": 0.6
  },
  "phase_4_target": {
    "coherence_score": 0.9,
    "universals": 100
  }
}
```

Le script `consolidate.ts` pourra comparer l'état courant au palier visé.

## Notes Importantes

- Python 3.9+ requis pour tous les bridges
- Java 11+ requis pour SPMF uniquement
- Communication Node ↔ Python via `spawnSync()`
- Tous les bridges acceptent stdin/stdout JSON
- Timeouts configurables (default: 5min)
- **Gestion d'erreur gracieuse (fallback sur méthodes natives)**

### Comportement de Repli (Fallback)

En cas d'erreur de bridge ou de timeout > 300s :

- Le système revient automatiquement sur la méthode native (PatternLearningEngine ou ForecastEngine)
- Les erreurs sont loguées dans `.reasoning_rl4/logs/bridges/*.log`
- Le training continue sans interruption
- Les métriques de fallback sont tracées dans `cognitive_state.json`

→ Indispensable pour garantir la stabilité sur run nocturne.

## Traçabilité

Le fichier `meta/external_repos.json` permettra :

- Reproductibilité (re-clone exact)
- Auditabilité (licences)
- Provenance cognitive (source des patterns)
- Export kernel documenté

## Reproductibilité & Versioning

Chaque bridge écrit dans `.reasoning_rl4/meta/bridges_versions.json` :

- Commit SHA du dépôt externe
- Version du bridge local
- Durée moyenne d'exécution
- Hash du résultat (pour détection divergence)

Format :

```json
{
  "pami": {
    "repo_commit": "abc123...",
    "bridge_version": "1.0.0",
    "avg_duration_ms": 1234,
    "result_hash": "def456...",
    "last_used": "2025-11-04T10:00:00Z"
  }
}
```

→ Cela permettra au futur RL4-Runtime de charger ou ignorer des modules selon leur compatibilité.

### To-dos

- [ ] Créer structure bridges/ avec requirements.txt et dossier meta/ pour traçabilité
- [ ] Implémenter scripts/bootstrap-ml-modules.sh pour clonage et installation automatique
- [ ] Créer bridges/pami_bridge.py pour pattern mining
- [ ] Intégrer PAMI dans PatternLearningEngineV2.ts (Analytical Layer)
- [ ] Tester PAMI sur 10 repos et valider montée de coherence (0.2→0.5)
- [ ] Créer bridges/merlion_bridge.py pour causalité ML
- [ ] Intégrer Merlion dans CorrelationEngineV2.ts (Reflective Layer)
- [ ] Créer bridges/hyperts_bridge.py pour forecasting ML
- [ ] Intégrer HyperTS dans ForecastEngineV3.ts (Forecast Layer)
- [ ] Créer bridges/fpgrowth_bridge.py avec switch automatique >10k séquences
- [ ] Créer bridges/spmf_bridge.sh (Java) pour universals structurels (optionnel Phase 4)
- [ ] Mettre à jour tasks.md avec section Phase 3 et nouvelle table External Repositories