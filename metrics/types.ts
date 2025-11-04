/**
 * Types pour le système de métriques
 */

/**
 * Métriques calculées pour un repo ou globalement
 */
export interface Metrics {
  /** Ratio patterns détectés / événements totaux */
  pattern_density: number;
  
  /** Ratio corrélations valides / patterns totaux */
  correlation_rate: number;
  
  /** Précision des prédictions (forecasts confirmés / total) */
  forecast_accuracy: number;
  
  /** Utilité des ADRs (appliqués / générés) */
  adr_usefulness: number;
  
  /** Durée moyenne d'un cycle en millisecondes */
  cycle_time_ms: number;
  
  /** Entropie de Shannon pour la diversité des patterns */
  entropy: number;
}

/**
 * Métriques détaillées avec compteurs
 */
export interface DetailedMetrics extends Metrics {
  total_events: number;
  total_patterns: number;
  total_correlations: number;
  total_forecasts: number;
  total_adrs: number;
  total_cycles: number;
}

/**
 * Statistiques agrégées par repo
 */
export interface RepoMetrics {
  repo_name: string;
  metrics: DetailedMetrics;
  computed_at: string;
}

/**
 * Format du fichier stats.json
 */
export interface MetricsReport {
  global: DetailedMetrics;
  by_repo: Record<string, DetailedMetrics>;
  generated_at: string;
  config: {
    max_repos: number;
    concurrency: number;
  };
}

/**
 * Seuils pour détection d'anomalies
 */
export interface MetricsThresholds {
  pattern_density_min: number;
  correlation_rate_min: number;
  forecast_accuracy_min: number;
  cycle_time_max_ms: number;
  entropy_min: number;
}

/**
 * Résultat d'analyse de métriques
 */
export interface MetricsInsight {
  metric_name: keyof Metrics;
  observed_value: number;
  threshold: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  repos_affected: string[];
  recommendation: string;
}

/**
 * Compteur de patterns par type
 */
export interface PatternTypeCount {
  refactor: number;
  bugfix: number;
  feature: number;
  test: number;
  documentation: number;
  other: number;
}

/**
 * Distribution de patterns pour calcul d'entropie
 */
export interface PatternDistribution {
  type: string;
  count: number;
  frequency: number;
}

