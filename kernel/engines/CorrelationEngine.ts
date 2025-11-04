import { Pattern, PatternType } from './PatternLearningEngine.js';
import { createLogger } from '../../trainer/utils/logger.js';

const logger = createLogger('CorrelationEngine');

/**
 * Type de corrélation
 */
export type CorrelationType = 'temporal' | 'spatial' | 'causal' | 'semantic';

/**
 * Corrélation entre patterns
 */
export interface Correlation {
  id: string;
  pattern1: Pattern;
  pattern2: Pattern;
  type: CorrelationType;
  strength: number;
  context: string;
  confidence: number;
  timestamp: string;
}

/**
 * Engine de détection de corrélations entre patterns
 */
export class CorrelationEngine {
  private correlations: Correlation[] = [];
  private temporalWindowMs = 7 * 24 * 60 * 60 * 1000; // 7 jours par défaut

  constructor(temporalWindowMs?: number) {
    if (temporalWindowMs) {
      this.temporalWindowMs = temporalWindowMs;
    }
  }

  /**
   * Analyser les patterns et trouver les corrélations
   */
  async findCorrelations(patterns: Pattern[]): Promise<Correlation[]> {
    logger.info(`Analyzing ${patterns.length} patterns for correlations`);
    this.correlations = [];

    // Corrélations temporelles
    const temporalCorrelations = this.findTemporalCorrelations(patterns);
    this.correlations.push(...temporalCorrelations);

    // Corrélations spatiales (fichiers)
    const spatialCorrelations = this.findSpatialCorrelations(patterns);
    this.correlations.push(...spatialCorrelations);

    // Corrélations causales
    const causalCorrelations = this.findCausalCorrelations(patterns);
    this.correlations.push(...causalCorrelations);

    // Corrélations sémantiques
    const semanticCorrelations = this.findSemanticCorrelations(patterns);
    this.correlations.push(...semanticCorrelations);

    logger.success(`Found ${this.correlations.length} correlations`);
    return this.correlations;
  }

  /**
   * Trouver corrélations temporelles (patterns qui se suivent dans le temps)
   */
  private findTemporalCorrelations(patterns: Pattern[]): Correlation[] {
    const correlations: Correlation[] = [];
    
    // Trier par timestamp
    const sorted = [...patterns].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const p1 = sorted[i];
        const p2 = sorted[j];
        
        const timeDiff = new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime();
        
        // Si dans la fenêtre temporelle
        if (timeDiff <= this.temporalWindowMs) {
          const strength = this.calculateTemporalStrength(p1, p2, timeDiff);
          
          if (strength > 0.5) {
            correlations.push({
              id: `temporal-${i}-${j}`,
              pattern1: p1,
              pattern2: p2,
              type: 'temporal',
              strength,
              context: `${p1.type} suivi de ${p2.type} dans un délai de ${Math.round(timeDiff / (1000 * 60 * 60))}h`,
              confidence: Math.min(p1.confidence, p2.confidence) * strength,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          break; // Trop loin dans le temps
        }
      }
    }

    return correlations;
  }

  /**
   * Calculer la force d'une corrélation temporelle
   */
  private calculateTemporalStrength(p1: Pattern, p2: Pattern, timeDiffMs: number): number {
    let strength = 0;

    // Patterns connus pour être liés temporellement
    const knownPairs: Record<string, string[]> = {
      'refactor': ['test', 'bugfix'],
      'feature': ['test', 'documentation'],
      'bugfix': ['test'],
      'dependency': ['bugfix', 'test'],
    };

    if (knownPairs[p1.type]?.includes(p2.type)) {
      strength += 0.5;
    }

    // Plus les patterns sont proches, plus la force est élevée
    const proximityScore = 1 - (timeDiffMs / this.temporalWindowMs);
    strength += proximityScore * 0.5;

    return Math.min(strength, 1.0);
  }

  /**
   * Trouver corrélations spatiales (patterns sur les mêmes fichiers)
   */
  private findSpatialCorrelations(patterns: Pattern[]): Correlation[] {
    const correlations: Correlation[] = [];

    for (let i = 0; i < patterns.length - 1; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const p1 = patterns[i];
        const p2 = patterns[j];

        const commonFiles = this.findCommonFiles(p1, p2);
        
        if (commonFiles.length > 0) {
          const strength = Math.min(commonFiles.length / Math.max(p1.context.files.length, p2.context.files.length), 1.0);
          
          if (strength > 0.3) {
            correlations.push({
              id: `spatial-${i}-${j}`,
              pattern1: p1,
              pattern2: p2,
              type: 'spatial',
              strength,
              context: `Patterns sur fichiers communs: ${commonFiles.join(', ')}`,
              confidence: Math.min(p1.confidence, p2.confidence) * strength,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    return correlations;
  }

  /**
   * Trouver fichiers communs entre deux patterns
   */
  private findCommonFiles(p1: Pattern, p2: Pattern): string[] {
    const files1 = new Set(p1.context.files);
    const files2 = new Set(p2.context.files);
    const common: string[] = [];

    for (const file of files1) {
      if (files2.has(file)) {
        common.push(file);
      }
    }

    return common;
  }

  /**
   * Trouver corrélations causales (un pattern cause l'autre)
   */
  private findCausalCorrelations(patterns: Pattern[]): Correlation[] {
    const correlations: Correlation[] = [];

    // Règles causales connues
    const causalRules: Array<{ cause: PatternType; effect: PatternType; strength: number }> = [
      { cause: 'refactor', effect: 'bugfix', strength: 0.7 },
      { cause: 'feature', effect: 'bugfix', strength: 0.6 },
      { cause: 'dependency', effect: 'bugfix', strength: 0.65 },
      { cause: 'refactor', effect: 'performance', strength: 0.5 },
    ];

    const sorted = [...patterns].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const p1 = sorted[i];
        const p2 = sorted[j];

        for (const rule of causalRules) {
          if (p1.type === rule.cause && p2.type === rule.effect) {
            const timeDiff = new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime();
            
            if (timeDiff <= this.temporalWindowMs) {
              correlations.push({
                id: `causal-${i}-${j}`,
                pattern1: p1,
                pattern2: p2,
                type: 'causal',
                strength: rule.strength,
                context: `${rule.cause} a probablement causé ${rule.effect}`,
                confidence: Math.min(p1.confidence, p2.confidence) * rule.strength,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return correlations;
  }

  /**
   * Trouver corrélations sémantiques (patterns avec contenu similaire)
   */
  private findSemanticCorrelations(patterns: Pattern[]): Correlation[] {
    const correlations: Correlation[] = [];

    for (let i = 0; i < patterns.length - 1; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const p1 = patterns[i];
        const p2 = patterns[j];

        const similarity = this.calculateSemanticSimilarity(p1, p2);
        
        if (similarity > 0.6) {
          correlations.push({
            id: `semantic-${i}-${j}`,
            pattern1: p1,
            pattern2: p2,
            type: 'semantic',
            strength: similarity,
            context: `Patterns sémantiquement similaires (contenu des commits)`,
            confidence: Math.min(p1.confidence, p2.confidence) * similarity,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Calculer similarité sémantique entre deux patterns
   */
  private calculateSemanticSimilarity(p1: Pattern, p2: Pattern): number {
    const words1 = new Set(p1.context.message.toLowerCase().split(/\s+/));
    const words2 = new Set(p2.context.message.toLowerCase().split(/\s+/));

    let common = 0;
    for (const word of words1) {
      if (words2.has(word) && word.length > 3) { // Ignorer mots courts
        common++;
      }
    }

    const total = Math.max(words1.size, words2.size);
    return total > 0 ? common / total : 0;
  }

  /**
   * Obtenir toutes les corrélations
   */
  getCorrelations(): Correlation[] {
    return this.correlations;
  }

  /**
   * Statistiques sur les corrélations
   */
  getStats(): Record<CorrelationType, number> {
    const stats: Record<string, number> = {};
    for (const corr of this.correlations) {
      stats[corr.type] = (stats[corr.type] || 0) + 1;
    }
    return stats as Record<CorrelationType, number>;
  }
}

