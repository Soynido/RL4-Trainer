import { Correlation } from './CorrelationEngine.js';
import { Pattern, PatternType } from './PatternLearningEngine.js';
import { createLogger } from '../../trainer/utils/logger.js';

const logger = createLogger('ForecastEngine');

/**
 * Prédiction future
 */
export interface Forecast {
  id: string;
  prediction: string;
  predictedPattern: PatternType;
  confidence: number;
  rationale: string;
  basedOn: string[];
  timeframe: string;
  timestamp: string;
}

/**
 * Engine de prédiction basé sur les corrélations
 */
export class ForecastEngine {
  private forecasts: Forecast[] = [];

  /**
   * Générer des prédictions à partir des corrélations
   */
  async generateForecasts(
    correlations: Correlation[],
    patterns: Pattern[]
  ): Promise<Forecast[]> {
    logger.info(`Generating forecasts from ${correlations.length} correlations`);
    this.forecasts = [];

    // Grouper corrélations par type
    const temporalCorrelations = correlations.filter(c => c.type === 'temporal');
    const causalCorrelations = correlations.filter(c => c.type === 'causal');

    // Prédictions basées sur corrélations temporelles
    this.forecasts.push(...this.forecastFromTemporal(temporalCorrelations, patterns));

    // Prédictions basées sur corrélations causales
    this.forecasts.push(...this.forecastFromCausal(causalCorrelations, patterns));

    // Prédictions basées sur patterns récents
    this.forecasts.push(...this.forecastFromRecentPatterns(patterns, correlations));

    // Prédictions basées sur tendances
    this.forecasts.push(...this.forecastFromTrends(patterns));

    logger.success(`Generated ${this.forecasts.length} forecasts`);
    return this.forecasts;
  }

  /**
   * Prédictions basées sur corrélations temporelles
   */
  private forecastFromTemporal(correlations: Correlation[], patterns: Pattern[]): Forecast[] {
    const forecasts: Forecast[] = [];
    
    // Analyser les patterns récents (derniers 10%)
    const sortedPatterns = [...patterns].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const recentPatterns = sortedPatterns.slice(0, Math.max(Math.floor(patterns.length * 0.1), 1));

    for (const recent of recentPatterns) {
      // Trouver corrélations où ce pattern est le premier
      const relevantCorrelations = correlations.filter(
        c => c.pattern1.context.commit === recent.context.commit
      );

      for (const corr of relevantCorrelations) {
        const confidence = corr.strength * corr.confidence * 0.8;
        
        if (confidence > 0.4) {
          forecasts.push({
            id: `temporal-forecast-${forecasts.length}`,
            prediction: `Un pattern de type "${corr.pattern2.type}" est attendu prochainement`,
            predictedPattern: corr.pattern2.type,
            confidence,
            rationale: `Basé sur corrélation temporelle: ${corr.context}`,
            basedOn: [corr.id],
            timeframe: this.estimateTimeframe(corr),
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return forecasts;
  }

  /**
   * Prédictions basées sur corrélations causales
   */
  private forecastFromCausal(correlations: Correlation[], patterns: Pattern[]): Forecast[] {
    const forecasts: Forecast[] = [];

    // Patterns récents qui pourraient causer d'autres patterns
    const sortedPatterns = [...patterns].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const recentPatterns = sortedPatterns.slice(0, Math.max(Math.floor(patterns.length * 0.15), 1));

    for (const recent of recentPatterns) {
      const causalCorrelations = correlations.filter(
        c => c.type === 'causal' && c.pattern1.type === recent.type
      );

      if (causalCorrelations.length > 0) {
        // Agréger prédictions similaires
        const predictionMap: Map<PatternType, { count: number; avgStrength: number; ids: string[] }> = new Map();

        for (const corr of causalCorrelations) {
          const type = corr.pattern2.type;
          const existing = predictionMap.get(type) || { count: 0, avgStrength: 0, ids: [] };
          existing.count++;
          existing.avgStrength += corr.strength;
          existing.ids.push(corr.id);
          predictionMap.set(type, existing);
        }

        // Créer forecasts
        for (const [predictedType, data] of predictionMap) {
          const avgStrength = data.avgStrength / data.count;
          const confidence = avgStrength * recent.confidence * 0.85;

          if (confidence > 0.5) {
            forecasts.push({
              id: `causal-forecast-${forecasts.length}`,
              prediction: `Pattern "${predictedType}" probable suite au récent "${recent.type}"`,
              predictedPattern: predictedType,
              confidence,
              rationale: `Relation causale historique: ${recent.type} → ${predictedType} observée ${data.count} fois`,
              basedOn: data.ids,
              timeframe: 'Dans les 48-72 heures',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    return forecasts;
  }

  /**
   * Prédictions basées sur patterns récents
   */
  private forecastFromRecentPatterns(patterns: Pattern[], _correlations: Correlation[]): Forecast[] {
    const forecasts: Forecast[] = [];

    // Détecter séquences incomplètes
    const sortedPatterns = [...patterns].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Si beaucoup de features récentes sans tests
    const recentFeatures = sortedPatterns.slice(0, 10).filter(p => p.type === 'feature');
    const recentTests = sortedPatterns.slice(0, 10).filter(p => p.type === 'test');

    if (recentFeatures.length >= 2 && recentTests.length === 0) {
      forecasts.push({
        id: 'pattern-forecast-tests',
        prediction: 'Tests manquants pour les features récentes',
        predictedPattern: 'test',
        confidence: 0.75,
        rationale: `${recentFeatures.length} features récentes sans tests associés`,
        basedOn: recentFeatures.map(f => f.context.commit),
        timeframe: 'Recommandé immédiatement',
        timestamp: new Date().toISOString(),
      });
    }

    // Si beaucoup de refactors sans bugfix qui suit
    const recentRefactors = sortedPatterns.slice(0, 10).filter(p => p.type === 'refactor');
    const recentBugfixes = sortedPatterns.slice(0, 10).filter(p => p.type === 'bugfix');

    if (recentRefactors.length >= 2 && recentBugfixes.length === 0) {
      forecasts.push({
        id: 'pattern-forecast-bugfix',
        prediction: 'Bugfix probable après refactoring récent',
        predictedPattern: 'bugfix',
        confidence: 0.65,
        rationale: `${recentRefactors.length} refactors récents augmentent le risque de bugs`,
        basedOn: recentRefactors.map(r => r.context.commit),
        timeframe: 'Dans les 24-48 heures',
        timestamp: new Date().toISOString(),
      });
    }

    return forecasts;
  }

  /**
   * Prédictions basées sur tendances
   */
  private forecastFromTrends(patterns: Pattern[]): Forecast[] {
    const forecasts: Forecast[] = [];

    if (patterns.length < 10) {
      return forecasts; // Pas assez de données
    }

    // Analyser tendances sur les 20 derniers patterns
    const recent = patterns.slice(-20);
    const typeCounts: Record<string, number> = {};

    for (const pattern of recent) {
      typeCounts[pattern.type] = (typeCounts[pattern.type] || 0) + 1;
    }

    // Trouver type dominant
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    
    if (sortedTypes.length > 0 && sortedTypes[0][1] >= 5) {
      const dominantType = sortedTypes[0][0] as PatternType;
      const frequency = sortedTypes[0][1] / recent.length;

      forecasts.push({
        id: 'trend-forecast',
        prediction: `Tendance continue de patterns "${dominantType}"`,
        predictedPattern: dominantType,
        confidence: frequency * 0.7,
        rationale: `${sortedTypes[0][1]} occurrences sur les 20 derniers patterns (${(frequency * 100).toFixed(0)}%)`,
        basedOn: ['trend-analysis'],
        timeframe: 'Tendance continue',
        timestamp: new Date().toISOString(),
      });
    }

    return forecasts;
  }

  /**
   * Estimer le délai d'une prédiction
   */
  private estimateTimeframe(correlation: Correlation): string {
    const timeDiff = new Date(correlation.pattern2.timestamp).getTime() - 
                     new Date(correlation.pattern1.timestamp).getTime();
    
    const hours = timeDiff / (1000 * 60 * 60);
    
    if (hours < 24) {
      return `Dans les ${Math.round(hours)} heures`;
    } else if (hours < 168) {
      return `Dans les ${Math.round(hours / 24)} jours`;
    } else {
      return `Dans les ${Math.round(hours / 168)} semaines`;
    }
  }

  /**
   * Obtenir toutes les prédictions
   */
  getForecasts(): Forecast[] {
    return this.forecasts;
  }

  /**
   * Obtenir les prédictions à haute confiance
   */
  getHighConfidenceForecasts(threshold = 0.6): Forecast[] {
    return this.forecasts.filter(f => f.confidence >= threshold);
  }
}

