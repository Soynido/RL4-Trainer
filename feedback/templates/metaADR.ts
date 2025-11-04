import { MetricsInsight } from '../../metrics/types.js';
import { randomUUID } from 'crypto';

/**
 * Structure d'un Meta-ADR (Architecture Decision Record sur le système RL4 lui-même)
 */
export interface MetaADR {
  /** Identifiant unique */
  id: string;
  
  /** Titre descriptif */
  title: string;
  
  /** Contexte avec métriques observées */
  context: {
    metric: string;
    observed_value: number;
    threshold: number;
    repos_affected: string[];
    description: string;
  };
  
  /** Recommandation d'amélioration */
  recommendation: string;
  
  /** Impact estimé de l'implémentation */
  impact: 'low' | 'medium' | 'high';
  
  /** Amélioration estimée (description textuelle) */
  estimated_improvement: string;
  
  /** Date de création */
  createdAt: string;
  
  /** Statut */
  status: 'proposed' | 'accepted' | 'rejected' | 'implemented';
}

/**
 * Créer un meta-ADR à partir d'un insight métrique
 */
export function createMetaADR(insight: MetricsInsight, status: MetaADR['status'] = 'proposed'): MetaADR {
  const recommendations = getRecommendationForMetric(insight);
  
  return {
    id: randomUUID(),
    title: recommendations.title,
    context: {
      metric: insight.metric_name,
      observed_value: insight.observed_value,
      threshold: insight.threshold,
      repos_affected: insight.repos_affected,
      description: recommendations.context,
    },
    recommendation: recommendations.recommendation,
    impact: insight.severity,
    estimated_improvement: recommendations.improvement,
    createdAt: new Date().toISOString(),
    status,
  };
}

/**
 * Générer recommandations spécifiques par type de métrique
 */
function getRecommendationForMetric(insight: MetricsInsight): {
  title: string;
  context: string;
  recommendation: string;
  improvement: string;
} {
  const { metric_name, observed_value, threshold, deviation } = insight;
  
  switch (metric_name) {
    case 'pattern_density':
      return {
        title: 'Améliorer la détection de patterns',
        context: `La densité de patterns détectés (${observed_value.toFixed(2)}) est inférieure au seuil minimum (${threshold}). Cela suggère que le PatternLearningEngine manque certains patterns significatifs.`,
        recommendation: 'Étendre les heuristiques du PatternLearningEngine : ajouter plus de mots-clés dans les messages de commit, analyser les extensions de fichiers modifiés, prendre en compte les ratios additions/deletions.',
        improvement: `Augmentation attendue de ${Math.abs(deviation * 100).toFixed(0)}% de la densité de patterns`,
      };
    
    case 'correlation_rate':
      return {
        title: 'Améliorer la corrélation entre patterns',
        context: `Le taux de corrélation (${observed_value.toFixed(2)}) est faible, indiquant que peu de patterns sont corrélés entre eux. Cela peut signifier que le CorrelationEngine utilise des fenêtres temporelles trop étroites ou des critères trop stricts.`,
        recommendation: 'Élargir la fenêtre temporelle de recherche de corrélations, réduire le seuil de similarité, implémenter des corrélations cross-repo basées sur les patterns de fichiers similaires.',
        improvement: `Amélioration estimée de ${Math.abs(deviation * 100).toFixed(0)}% du taux de corrélation`,
      };
    
    case 'forecast_accuracy':
      return {
        title: 'Calibrer les prédictions du ForecastEngine',
        context: `La précision des forecasts (${observed_value.toFixed(2)}) est inférieure aux attentes. Les prédictions ne sont pas suffisamment confirmées par les événements ultérieurs.`,
        recommendation: 'Calibrer les modèles de prédiction en ajustant les poids des corrélations, implémenter un système de validation différée des forecasts, enrichir le contexte historique utilisé pour les prédictions.',
        improvement: `Gain de précision attendu de ${Math.abs(deviation * 100).toFixed(0)}%`,
      };
    
    case 'adr_usefulness':
      return {
        title: 'Affiner la génération d\'ADRs',
        context: `Le taux d'utilité des ADRs (${observed_value.toFixed(2)}) suggère que beaucoup d'ADRs générés ne sont pas appliqués ou pertinents. Les recommandations sont peut-être trop génériques ou mal ciblées.`,
        recommendation: 'Affiner les templates d\'ADR pour les rendre plus spécifiques et actionnables, ajouter un système de scoring de pertinence basé sur le contexte du repo, filtrer les ADRs redondants.',
        improvement: `Réduction attendue de ${Math.abs(deviation * 100).toFixed(0)}% des ADRs non pertinents`,
      };
    
    case 'cycle_time_ms':
      return {
        title: 'Optimiser les performances du cycle cognitif',
        context: `Le temps de cycle moyen (${observed_value.toFixed(0)}ms) dépasse le seuil maximum (${threshold}ms). Cela peut impacter la capacité à traiter de nombreux repos en temps raisonnable.`,
        recommendation: 'Optimiser les algorithmes de détection de patterns (indexation, caching), paralléliser certaines phases indépendantes, implémenter un système de batch processing plus efficace.',
        improvement: `Réduction estimée de ${Math.abs(deviation * 100).toFixed(0)}% du temps de traitement`,
      };
    
    case 'entropy':
      return {
        title: 'Augmenter la diversité des patterns détectés',
        context: `L'entropie des patterns (${observed_value.toFixed(2)}) est faible, indiquant une faible diversité. Le système détecte principalement les mêmes types de patterns de manière répétitive.`,
        recommendation: 'Élargir les catégories de patterns au-delà de refactor/bugfix/feature/test (ex: performance, security, dependency), améliorer la granularité de classification, implémenter la détection de patterns composés.',
        improvement: `Augmentation attendue de ${Math.abs(deviation * 100).toFixed(0)}% de la diversité`,
      };
    
    default:
      return {
        title: `Améliorer la métrique ${metric_name}`,
        context: `La métrique ${metric_name} (${observed_value.toFixed(2)}) nécessite une attention.`,
        recommendation: 'Analyser et optimiser cette métrique spécifique.',
        improvement: `Amélioration ciblée de ${Math.abs(deviation * 100).toFixed(0)}%`,
      };
  }
}

/**
 * Formater un meta-ADR pour l'affichage ou l'export
 */
export function formatMetaADR(adr: MetaADR): string {
  return `
# ${adr.title}

**ID**: ${adr.id}
**Status**: ${adr.status}
**Impact**: ${adr.impact}
**Created**: ${new Date(adr.createdAt).toLocaleString()}

## Contexte

${adr.context.description}

**Métrique**: ${adr.context.metric}
**Valeur observée**: ${adr.context.observed_value.toFixed(3)}
**Seuil**: ${adr.context.threshold.toFixed(3)}
**Repos affectés**: ${adr.context.repos_affected.length > 0 ? adr.context.repos_affected.join(', ') : 'tous'}

## Recommandation

${adr.recommendation}

## Amélioration Estimée

${adr.estimated_improvement}
`.trim();
}

