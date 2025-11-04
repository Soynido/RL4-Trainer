import { promises as fs } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createLogger } from '../../trainer/utils/logger.js';
import { PatternType } from './PatternLearningEngine.js';
import { CausalCorrelation, CausalChain } from './CorrelationEngineV2.js';
import { CausalTimeline } from './PatternLearningEngineV2.js';

const logger = createLogger('ForecastEngineV3');

/**
 * Prédiction avec mémoire réflexive
 */
export interface PredictiveForecast {
  id: string;
  predicted: PatternType;
  basedOn: PatternType[];
  confidence: number;
  horizon: number;  // Nombre de commits avant réalisation
  reasoning: ReasoningEntry;  // Mémoire du raisonnement
  timestamp: string;
}

/**
 * Entrée de mémoire réflexive (journal de raisonnement)
 */
export interface ReasoningEntry {
  when: string;  // Timestamp de la prédiction
  hypothesis: string;  // L'hypothèse formulée
  basedOn: string[];  // Patterns/corrélations utilisés
  predicted: PatternType;
  confidence: number;
  actualOutcome?: PatternType;  // Ce qui s'est réellement passé
  wasCorrect?: boolean;  // La prédiction était-elle correcte ?
  coherenceAfter?: number;  // Score de cohérence après validation
  learning?: string;  // Ce qui a été appris
}

/**
 * Trajectoire possible d'un repo
 */
export interface Trajectory {
  id: string;
  currentState: PatternType[];  // Patterns actuels
  possibleFutures: Array<{
    patterns: PatternType[];
    probability: number;
    basedOn: string[];  // Chaînes causales utilisées
  }>;
  confidence: number;
}

/**
 * Forecast Engine V3 - Forecast Layer
 * 
 * Simule trajectoires possibles et maintient une mémoire réflexive.
 * 
 * Cycle cognitif :
 * 1. HYPOTHÈSE : Imaginer la suite logique d'un repo
 * 2. CONFRONTATION : Comparer prédiction vs réalité
 * 3. ÉVALUATION : Mesurer coherence
 * 4. APPRENTISSAGE : Ajuster logique interne
 * 5. MÉMOIRE : Enregistrer le raisonnement
 * 
 * Architecture:
 * - Utilise causal chains pour prédire patterns probables
 * - Calcule confidence et horizon
 * - Maintient reasoning_history.jsonl
 * - Mesure forecast_precision en continu
 */
export class ForecastEngineV3 {
  private reasoningHistory: ReasoningEntry[] = [];
  private forecastPrecision = 0.0;
  private outputDir: string;

  constructor(outputDir: string = '.reasoning_rl4') {
    this.outputDir = outputDir;
  }

  /**
   * Générer forecasts depuis corrélations causales + timelines
   */
  async generateForecasts(
    causalCorrelations: CausalCorrelation[],
    causalChains: CausalChain[],
    timeline: CausalTimeline
  ): Promise<{
    forecasts: PredictiveForecast[];
    trajectories: Trajectory[];
    precision: number;
  }> {
    logger.info(`Generating forecasts from ${causalCorrelations.length} correlations, ${causalChains.length} chains`);

    // 1. Analyser l'état actuel du repo
    const currentState = this.analyzeCurrentState(timeline);
    logger.debug(`Current state: ${currentState.join(', ')}`);

    // 2. Prédire patterns probables basés sur corrélations
    const nativeForecasts = this.predictNextPatterns(currentState, causalCorrelations);
    logger.success(`Generated ${nativeForecasts.length} native forecasts`);

    // 3. Enrichir avec HyperTS ML Bridge
    const enrichedForecasts = await this.callHyperTSBridge(nativeForecasts, timeline);
    const forecasts = enrichedForecasts.length > 0 ? enrichedForecasts : nativeForecasts;
    
    if (enrichedForecasts.length === 0 && nativeForecasts.length > 0) {
      logger.info('HyperTS bridge not used (fallback to native forecasts)');
    } else {
      logger.success(`Forecasts enriched with HyperTS: ${forecasts.length}`);
    }

    // 4. Simuler trajectoires possibles
    const trajectories = this.simulateTrajectories(currentState, causalChains);
    logger.success(`Simulated ${trajectories.length} trajectories`);

    // 4. Confronter avec réalité (si disponible)
    const precision = await this.evaluatePrecision(forecasts, timeline);
    this.forecastPrecision = precision;
    logger.success(`Forecast precision: ${precision.toFixed(2)}`);

    // 5. Sauvegarder
    await this.saveResults(forecasts, this.reasoningHistory, precision);

    return {
      forecasts,
      trajectories,
      precision,
    };
  }

  /**
   * Appeler HyperTS bridge pour enrichir les forecasts
   */
  private async callHyperTSBridge(
    forecasts: PredictiveForecast[],
    timeline: CausalTimeline
  ): Promise<PredictiveForecast[]> {
    const bridgePath = 'bridges/hyperts_bridge.py';
    
    logger.info('Calling HyperTS bridge for forecast enrichment');
    
    try {
      // Préparer input JSON
      const input = {
        repo: timeline.repo,
        forecasts: forecasts.map(f => ({
          predicted: f.predicted,
          confidence: f.confidence,
          horizon: f.horizon
        })),
        timeline: {
          events: timeline.events
        },
        config: {
          forecast_horizon: 5,
          min_confidence: 0.4
        }
      };
      
      // Appeler le bridge Python avec timeout 300s
      const result = spawnSync('python3', [bridgePath], {
        input: JSON.stringify(input),
        encoding: 'utf-8',
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024
      });
      
      if (result.error || result.status !== 0) {
        throw new Error(`Bridge error: ${result.error?.message || result.stderr}`);
      }
      
      const output = JSON.parse(result.stdout);
      
      if (!output.success) {
        throw new Error(output.error || 'Bridge returned success=false');
      }
      
      // Fusionner les enrichissements ML avec les forecasts natifs
      const enriched: PredictiveForecast[] = output.data.enriched_forecasts.map((ef: any) => {
        const originalForecast = forecasts.find(f => f.predicted === ef.predicted);
        
        return {
          ...(originalForecast || {}),
          id: originalForecast?.id || `forecast-ml-${ef.predicted}`,
          predicted: ef.predicted,
          basedOn: originalForecast?.basedOn || [],
          confidence: ef.vraisemblance || ef.confidence,
          horizon: ef.horizon || 3,
          reasoning: originalForecast?.reasoning || {
            when: new Date().toISOString(),
            hypothesis: `ML-enhanced forecast for ${ef.predicted}`,
            basedOn: ['HyperTS ML model'],
            predicted: ef.predicted,
            confidence: ef.vraisemblance || ef.confidence
          },
          timestamp: new Date().toISOString()
        };
      });
      
      logger.success(`HyperTS returned ${enriched.length} enriched forecasts (${output.metadata.duration_ms}ms)`);
      
      return enriched;
      
    } catch (error) {
      // FALLBACK : Revenir sur forecasts natifs
      logger.warn(`HyperTS bridge failed, using native forecasts: ${error}`);
      await this.logBridgeError(bridgePath, error as Error);
      return [];
    }
  }
  
  /**
   * Logger les erreurs de bridge
   */
  private async logBridgeError(bridgePath: string, error: Error): Promise<void> {
    try {
      const bridgeName = path.basename(bridgePath, '.py');
      const logPath = `.reasoning_rl4/logs/bridges/${bridgeName}.log`;
      const timestamp = new Date().toISOString();
      const errorMsg = `[${timestamp}] [ERROR] Bridge fallback triggered: ${error.message}\n`;
      
      await fs.appendFile(logPath, errorMsg, 'utf-8').catch(() => {});
    } catch {
      // Ignore logging errors
    }
  }

  /**
   * Analyser l'état actuel du repo (derniers patterns)
   */
  private analyzeCurrentState(timeline: CausalTimeline): PatternType[] {
    const recentEvents = timeline.events.slice(-5);  // 5 derniers commits
    const patterns: PatternType[] = [];

    for (const event of recentEvents) {
      patterns.push(...event.patterns);
    }

    return patterns;
  }

  /**
   * Prédire les patterns probables basés sur corrélations causales
   */
  private predictNextPatterns(
    currentState: PatternType[],
    correlations: CausalCorrelation[]
  ): PredictiveForecast[] {
    const forecasts: PredictiveForecast[] = [];

    // Pour chaque pattern actuel, chercher les effets probables
    for (const currentPattern of currentState) {
      const relevantCorrelations = correlations.filter(c => c.cause === currentPattern);

      for (const corr of relevantCorrelations) {
        // HYPOTHÈSE : Imaginer la suite logique
        const hypothesis = `Si ${corr.cause} est présent, alors ${corr.effect} devrait suivre`;
        
        // Créer l'entrée de raisonnement
        const reasoning: ReasoningEntry = {
          when: new Date().toISOString(),
          hypothesis,
          basedOn: [corr.id],
          predicted: corr.effect,
          confidence: corr.strength * corr.confidence,
        };

        this.reasoningHistory.push(reasoning);

        forecasts.push({
          id: `forecast-${forecasts.length}`,
          predicted: corr.effect,
          basedOn: [currentPattern],
          confidence: corr.strength * corr.confidence,
          horizon: corr.lag,
          reasoning,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Trier par confidence
    forecasts.sort((a, b) => b.confidence - a.confidence);

    return forecasts.slice(0, 20);  // Top 20 forecasts
  }

  /**
   * Simuler trajectoires possibles du repo
   */
  private simulateTrajectories(
    currentState: PatternType[],
    chains: CausalChain[]
  ): Trajectory[] {
    const trajectories: Trajectory[] = [];

    for (const chain of chains.slice(0, 10)) {  // Top 10 chains
      // Trouver où on est dans la chaîne
      const currentIndex = chain.chain.findIndex(c => 
        currentState.includes(c.pattern)
      );

      if (currentIndex >= 0 && currentIndex < chain.chain.length - 1) {
        // Prédire la suite de la chaîne
        const futurePatterns = chain.chain
          .slice(currentIndex + 1)
          .map(c => c.pattern);

        trajectories.push({
          id: chain.id,
          currentState,
          possibleFutures: [{
            patterns: futurePatterns,
            probability: chain.strength,
            basedOn: [chain.id],
          }],
          confidence: chain.strength,
        });
      }
    }

    return trajectories;
  }

  /**
   * CONFRONTATION : Évaluer la précision des forecasts
   * 
   * Compare les prédictions avec ce qui s'est réellement passé
   */
  private async evaluatePrecision(
    forecasts: PredictiveForecast[],
    timeline: CausalTimeline
  ): Promise<number> {
    if (forecasts.length === 0) return 0;

    let correct = 0;
    let total = 0;

    for (const forecast of forecasts) {
      // Chercher si le pattern prédit apparaît dans les N prochains commits
      const futureEvents = timeline.events.slice(-forecast.horizon);
      const actualPatterns = futureEvents.flatMap(e => e.patterns);

      if (actualPatterns.includes(forecast.predicted)) {
        correct++;
        // Mettre à jour le reasoning
        forecast.reasoning.actualOutcome = forecast.predicted;
        forecast.reasoning.wasCorrect = true;
        forecast.reasoning.coherenceAfter = correct / (total + 1);
        forecast.reasoning.learning = `Validated: ${forecast.basedOn.join(', ')} → ${forecast.predicted}`;
      } else {
        forecast.reasoning.wasCorrect = false;
        forecast.reasoning.learning = `Failed: Expected ${forecast.predicted}, found ${actualPatterns.join(', ')}`;
      }

      total++;
    }

    return total > 0 ? correct / total : 0;
  }

  /**
   * Sauvegarder forecasts et mémoire réflexive
   */
  private async saveResults(
    forecasts: PredictiveForecast[],
    history: ReasoningEntry[],
    precision: number
  ): Promise<void> {
    try {
      await fs.mkdir(path.join(this.outputDir, 'kernel'), { recursive: true });

      // Forecasts
      const forecastsPath = path.join(this.outputDir, 'forecasts.jsonl');
      const forecastsContent = forecasts.map(f => JSON.stringify(f)).join('\n') + '\n';
      await fs.appendFile(forecastsPath, forecastsContent, 'utf-8');
      logger.debug(`Forecasts saved to ${forecastsPath}`);

      // Reasoning history
      const historyPath = path.join(this.outputDir, 'kernel', 'reasoning_history.jsonl');
      const historyContent = history.map(h => JSON.stringify(h)).join('\n') + '\n';
      await fs.appendFile(historyPath, historyContent, 'utf-8');
      logger.debug(`Reasoning history saved to ${historyPath}`);

      // Métriques de précision
      const metricsPath = path.join(this.outputDir, 'kernel', 'forecast_metrics.json');
      await fs.writeFile(
        metricsPath,
        JSON.stringify({
          forecast_precision: precision,
          total_forecasts: forecasts.length,
          correct_predictions: Math.round(forecasts.length * precision),
          updated_at: new Date().toISOString(),
        }, null, 2),
        'utf-8'
      );
      logger.debug(`Forecast metrics saved to ${metricsPath}`);

    } catch (error) {
      logger.error(`Failed to save results: ${error}`);
    }
  }

  /**
   * Récupérer la mémoire réflexive
   */
  getReasoningHistory(): ReasoningEntry[] {
    return this.reasoningHistory;
  }

  /**
   * Récupérer la précision actuelle
   */
  getPrecision(): number {
    return this.forecastPrecision;
  }
}

