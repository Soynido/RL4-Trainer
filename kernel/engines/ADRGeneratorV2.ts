import { Forecast } from './ForecastEngine.js';
import { Correlation } from './CorrelationEngine.js';
import { Pattern } from './PatternLearningEngine.js';
import { createLogger } from '../../trainer/utils/logger.js';

const logger = createLogger('ADRGeneratorV2');

/**
 * Architecture Decision Record
 */
export interface ADR {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string[];
  status: 'proposed' | 'accepted' | 'rejected' | 'implemented' | 'deprecated';
  basedOn: {
    forecasts: string[];
    correlations: string[];
    patterns: string[];
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

/**
 * Engine de génération d'ADRs basé sur forecasts et corrélations
 */
export class ADRGeneratorV2 {
  private adrs: ADR[] = [];

  /**
   * Générer des ADRs à partir des forecasts et corrélations
   */
  async generateADRs(
    forecasts: Forecast[],
    correlations: Correlation[],
    patterns: Pattern[]
  ): Promise<ADR[]> {
    logger.info(`Generating ADRs from ${forecasts.length} forecasts`);
    this.adrs = [];

    // ADRs basés sur forecasts à haute confiance
    const highConfidenceForecasts = forecasts.filter(f => f.confidence >= 0.6);
    this.adrs.push(...this.generateFromForecasts(highConfidenceForecasts));

    // ADRs basés sur patterns récents problématiques
    this.adrs.push(...this.generateFromPatterns(patterns));

    // ADRs basés sur corrélations fortes
    const strongCorrelations = correlations.filter(c => c.strength >= 0.7);
    this.adrs.push(...this.generateFromCorrelations(strongCorrelations));

    // Dédupliquer et prioriser
    this.adrs = this.deduplicateAndPrioritize(this.adrs);

    logger.success(`Generated ${this.adrs.length} ADRs`);
    return this.adrs;
  }

  /**
   * Générer ADRs à partir de forecasts
   */
  private generateFromForecasts(forecasts: Forecast[]): ADR[] {
    const adrs: ADR[] = [];

    for (const forecast of forecasts) {
      const adr = this.createADRForForecast(forecast);
      if (adr) {
        adrs.push(adr);
      }
    }

    return adrs;
  }

  /**
   * Créer un ADR pour un forecast spécifique
   */
  private createADRForForecast(forecast: Forecast): ADR | null {
    const type = forecast.predictedPattern;

    switch (type) {
      case 'test':
        return {
          id: `adr-forecast-${forecast.id}`,
          title: 'Ajouter tests de couverture',
          context: `Prédiction: ${forecast.prediction}. ${forecast.rationale}`,
          decision: 'Implémenter des tests unitaires et d\'intégration avant de continuer le développement de nouvelles features.',
          consequences: [
            'Réduction des bugs en production',
            'Amélioration de la confiance dans les refactors',
            'Temps de développement initial légèrement augmenté',
            'Maintenance facilitée à long terme',
          ],
          status: 'proposed',
          basedOn: {
            forecasts: [forecast.id],
            correlations: forecast.basedOn,
            patterns: [],
          },
          priority: forecast.confidence > 0.7 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
        };

      case 'bugfix':
        return {
          id: `adr-forecast-${forecast.id}`,
          title: 'Anticiper et prévenir les bugs potentiels',
          context: `Prédiction: ${forecast.prediction}. ${forecast.rationale}`,
          decision: 'Effectuer une revue de code approfondie et ajouter des tests de régression avant le prochain déploiement.',
          consequences: [
            'Détection précoce des bugs',
            'Réduction du temps de correction',
            'Amélioration de la qualité du code',
            'Overhead de revue augmenté',
          ],
          status: 'proposed',
          basedOn: {
            forecasts: [forecast.id],
            correlations: forecast.basedOn,
            patterns: [],
          },
          priority: forecast.confidence > 0.6 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
        };

      case 'refactor':
        return {
          id: `adr-forecast-${forecast.id}`,
          title: 'Planifier refactoring du code',
          context: `Prédiction: ${forecast.prediction}. ${forecast.rationale}`,
          decision: 'Allouer du temps pour un refactoring ciblé des modules identifiés, avec tests avant/après.',
          consequences: [
            'Code plus maintenable',
            'Dette technique réduite',
            'Risque de régression si mal exécuté',
            'Temps de développement des features ralenti temporairement',
          ],
          status: 'proposed',
          basedOn: {
            forecasts: [forecast.id],
            correlations: forecast.basedOn,
            patterns: [],
          },
          priority: 'medium',
          timestamp: new Date().toISOString(),
        };

      case 'documentation':
        return {
          id: `adr-forecast-${forecast.id}`,
          title: 'Améliorer la documentation',
          context: `Prédiction: ${forecast.prediction}. ${forecast.rationale}`,
          decision: 'Mettre à jour la documentation technique et les commentaires de code pour les modules récemment modifiés.',
          consequences: [
            'Meilleure compréhension du code par l\'équipe',
            'Onboarding facilité',
            'Maintenance simplifiée',
            'Temps investi dans la rédaction',
          ],
          status: 'proposed',
          basedOn: {
            forecasts: [forecast.id],
            correlations: forecast.basedOn,
            patterns: [],
          },
          priority: 'low',
          timestamp: new Date().toISOString(),
        };

      case 'performance':
        return {
          id: `adr-forecast-${forecast.id}`,
          title: 'Optimiser les performances',
          context: `Prédiction: ${forecast.prediction}. ${forecast.rationale}`,
          decision: 'Effectuer un profiling et optimiser les points chauds identifiés.',
          consequences: [
            'Temps de réponse amélioré',
            'Meilleure expérience utilisateur',
            'Complexité du code potentiellement augmentée',
            'Nécessite des benchmarks',
          ],
          status: 'proposed',
          basedOn: {
            forecasts: [forecast.id],
            correlations: forecast.basedOn,
            patterns: [],
          },
          priority: 'medium',
          timestamp: new Date().toISOString(),
        };

      case 'security':
        return {
          id: `adr-forecast-${forecast.id}`,
          title: 'Renforcer la sécurité',
          context: `Prédiction: ${forecast.prediction}. ${forecast.rationale}`,
          decision: 'Effectuer un audit de sécurité et implémenter les corrections nécessaires immédiatement.',
          consequences: [
            'Réduction des vulnérabilités',
            'Conformité réglementaire améliorée',
            'Confiance des utilisateurs renforcée',
            'Temps de développement impacté',
          ],
          status: 'proposed',
          basedOn: {
            forecasts: [forecast.id],
            correlations: forecast.basedOn,
            patterns: [],
          },
          priority: 'critical',
          timestamp: new Date().toISOString(),
        };

      default:
        return null;
    }
  }

  /**
   * Générer ADRs à partir de patterns
   */
  private generateFromPatterns(patterns: Pattern[]): ADR[] {
    const adrs: ADR[] = [];

    // Analyser patterns récents
    const recent = patterns.slice(-20);
    
    // Détecter absence de tests
    const hasFeatures = recent.some(p => p.type === 'feature');
    const hasTests = recent.some(p => p.type === 'test');
    
    if (hasFeatures && !hasTests) {
      adrs.push({
        id: 'adr-pattern-notests',
        title: 'Établir politique de test obligatoire',
        context: 'Features récentes développées sans tests associés.',
        decision: 'Mettre en place une politique de "pas de merge sans tests" pour toute nouvelle feature.',
        consequences: [
          'Couverture de tests améliorée',
          'Bugs détectés plus tôt',
          'Cycle de développement légèrement allongé',
          'Qualité globale améliorée',
        ],
        status: 'proposed',
        basedOn: {
          forecasts: [],
          correlations: [],
          patterns: recent.filter(p => p.type === 'feature').map(p => p.context.commit),
        },
        priority: 'high',
        timestamp: new Date().toISOString(),
      });
    }

    return adrs;
  }

  /**
   * Générer ADRs à partir de corrélations
   */
  private generateFromCorrelations(correlations: Correlation[]): ADR[] {
    const adrs: ADR[] = [];

    // Identifier corrélations causales fortes
    const strongCausal = correlations.filter(c => c.type === 'causal' && c.strength >= 0.7);

    if (strongCausal.length > 0) {
      // Grouper par cause
      const causeGroups: Record<string, Correlation[]> = {};
      for (const corr of strongCausal) {
        const cause = corr.pattern1.type;
        if (!causeGroups[cause]) {
          causeGroups[cause] = [];
        }
        causeGroups[cause].push(corr);
      }

      // Générer ADR pour chaque cause fréquente
      for (const [cause, corrs] of Object.entries(causeGroups)) {
        if (corrs.length >= 2) {
          adrs.push({
            id: `adr-causal-${cause}`,
            title: `Gérer les impacts des ${cause}`,
            context: `Corrélations causales fortes détectées: ${cause} conduit souvent à d'autres changements.`,
            decision: `Lors de ${cause}, anticiper et planifier les changements associés identifiés par l'analyse.`,
            consequences: [
              'Meilleure planification',
              'Réduction des surprises',
              'Workflow plus fluide',
              'Nécessite discipline d\'équipe',
            ],
            status: 'proposed',
            basedOn: {
              forecasts: [],
              correlations: corrs.map(c => c.id),
              patterns: [],
            },
            priority: 'medium',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return adrs;
  }

  /**
   * Dédupliquer et prioriser les ADRs
   */
  private deduplicateAndPrioritize(adrs: ADR[]): ADR[] {
    // Utiliser un Map pour dédupliquer par titre similaire
    const unique: Map<string, ADR> = new Map();

    for (const adr of adrs) {
      const key = adr.title.toLowerCase().replace(/\s+/g, '-');
      const existing = unique.get(key);

      if (!existing || this.getPriorityScore(adr.priority) > this.getPriorityScore(existing.priority)) {
        unique.set(key, adr);
      }
    }

    // Trier par priorité
    return Array.from(unique.values()).sort((a, b) => 
      this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority)
    );
  }

  /**
   * Score numérique pour la priorité
   */
  private getPriorityScore(priority: ADR['priority']): number {
    const scores = { critical: 4, high: 3, medium: 2, low: 1 };
    return scores[priority];
  }

  /**
   * Obtenir tous les ADRs
   */
  getADRs(): ADR[] {
    return this.adrs;
  }

  /**
   * Obtenir ADRs par priorité
   */
  getADRsByPriority(priority: ADR['priority']): ADR[] {
    return this.adrs.filter(adr => adr.priority === priority);
  }
}

