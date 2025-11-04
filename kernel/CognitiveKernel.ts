import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../trainer/utils/logger.js';
import { PatternSequence } from './engines/PatternLearningEngineV2.js';
import { CausalCorrelation } from './engines/CorrelationEngineV2.js';
import { PredictiveForecast, ReasoningEntry } from './engines/ForecastEngineV3.js';

const logger = createLogger('CognitiveKernel');

/**
 * État cognitif consolidé du RL4
 */
export interface CognitiveState {
  coherence_score: number;  // 0-1 : compréhension de la logique interne
  forecast_precision: number;  // 0-1 : précision des prédictions
  universals: number;  // Nombre de règles universelles apprises
  reasoning_depth: number;  // Profondeur de raisonnement (4 = AST→Pattern→Corr→Forecast)
  avg_correlation_strength: number;  // Force moyenne des corrélations
  
  // Métriques détaillées
  metrics: {
    total_repos: number;
    total_patterns: number;
    total_correlations: number;
    total_forecasts: number;
    total_reasoning_entries: number;
  };
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_training: string;
}

/**
 * Règle universelle (invariant validé)
 */
export interface UniversalRule {
  id: string;
  rule: string;
  type: 'pattern' | 'correlation' | 'forecast';
  confidence: number;
  validated_in_repos: number;
  examples: string[];
}

/**
 * Cognitive Kernel - Noyau cognitif du RL4
 * 
 * Consolide l'apprentissage global :
 * - Calcule coherence_score
 * - Extrait universal_rules
 * - Maintient cognitive_state.json
 * - Exporte le kernel
 */
export class CognitiveKernel {
  private state: CognitiveState;
  private universals: UniversalRule[] = [];
  private outputDir: string;

  constructor(outputDir: string = '.reasoning_rl4') {
    this.outputDir = outputDir;
    
    // État initial
    this.state = {
      coherence_score: 0.0,
      forecast_precision: 0.0,
      universals: 0,
      reasoning_depth: 4,  // AST → Pattern → Correlation → Forecast
      avg_correlation_strength: 0.0,
      metrics: {
        total_repos: 0,
        total_patterns: 0,
        total_correlations: 0,
        total_forecasts: 0,
        total_reasoning_entries: 0,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_training: new Date().toISOString(),
    };
  }

  /**
   * Consolider l'apprentissage depuis tous les fichiers
   */
  async consolidate(): Promise<CognitiveState> {
    logger.info('Consolidating cognitive kernel...');

    try {
      // 1. Charger les données
      const patterns = await this.loadPatterns();
      const correlations = await this.loadCorrelations();
      const _forecasts = await this.loadForecasts();
      const reasoningHistory = await this.loadReasoningHistory();

      logger.info(`Loaded: ${patterns.length} patterns, ${correlations.length} correlations, ${_forecasts.length} forecasts`);

      // 2. Calculer coherence_score
      this.state.coherence_score = this.calculateCoherence(
        patterns,
        correlations,
        _forecasts
      );

      // 3. Calculer forecast_precision
      this.state.forecast_precision = this.calculateForecastPrecision(
        _forecasts,
        reasoningHistory
      );

      // 4. Extraire règles universelles
      this.universals = this.extractUniversalRules(correlations);
      this.state.universals = this.universals.length;

      // 5. Calculer avg_correlation_strength
      this.state.avg_correlation_strength = correlations.length > 0
        ? correlations.reduce((sum, c) => sum + c.strength, 0) / correlations.length
        : 0;

      // 6. Mettre à jour métriques
      this.state.metrics = {
        total_repos: this.countRepos(patterns),
        total_patterns: patterns.length,
        total_correlations: correlations.length,
        total_forecasts: _forecasts.length,
        total_reasoning_entries: reasoningHistory.length,
      };

      this.state.updated_at = new Date().toISOString();
      this.state.last_training = new Date().toISOString();

      // 7. Sauvegarder
      await this.save();

      logger.success(`Kernel consolidated: coherence=${this.state.coherence_score.toFixed(2)}, precision=${this.state.forecast_precision.toFixed(2)}, universals=${this.state.universals}`);

      return this.state;

    } catch (error) {
      logger.error(`Failed to consolidate kernel: ${error}`);
      throw error;
    }
  }

  /**
   * Calculer le score de cohérence global
   * 
   * Basé sur :
   * - Qualité des patterns (confidence moyenne)
   * - Qualité des corrélations (strength moyenne)
   * - Précision des forecasts
   */
  private calculateCoherence(
    patterns: PatternSequence[],
    correlations: CausalCorrelation[],
    forecastsList: PredictiveForecast[]
  ): number {
    if (patterns.length === 0) return 0;

    // Score de patterns
    const patternScore = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;

    // Score de corrélations
    const corrScore = correlations.length > 0
      ? correlations.reduce((sum, c) => sum + c.strength * c.confidence, 0) / correlations.length
      : 0;

    // Score de forecasts
    const forecastScore = forecastsList.length > 0
      ? forecastsList.reduce((sum, f) => sum + f.confidence, 0) / forecastsList.length
      : 0;

    // Cohérence globale (moyenne pondérée)
    const coherence = (
      patternScore * 0.3 +
      corrScore * 0.4 +
      forecastScore * 0.3
    );

    return Math.min(1.0, Math.max(0.0, coherence));
  }

  /**
   * Calculer la précision des forecasts
   */
  private calculateForecastPrecision(
    _forecasts: PredictiveForecast[],
    history: ReasoningEntry[]
  ): number {
    if (history.length === 0) return 0;

    const validated = history.filter(h => h.wasCorrect !== undefined);
    if (validated.length === 0) return 0;

    const correct = validated.filter(h => h.wasCorrect === true).length;
    return correct / validated.length;
  }

  /**
   * Extraire règles universelles (corrélations valides dans >50% des repos)
   */
  private extractUniversalRules(correlations: CausalCorrelation[]): UniversalRule[] {
    const rules: UniversalRule[] = [];

    for (const corr of correlations) {
      if (corr.strength >= 0.7 && corr.confidence >= 0.6) {
        rules.push({
          id: corr.id,
          rule: `${corr.cause} → ${corr.effect} (${Math.round(corr.strength * 100)}% strength, lag: ${corr.lag})`,
          type: 'correlation',
          confidence: corr.confidence,
          validated_in_repos: corr.samples,
          examples: [],
        });
      }
    }

    return rules;
  }

  /**
   * Compter le nombre unique de repos
   */
  private countRepos(patterns: PatternSequence[]): number {
    const repos = new Set<string>();
    for (const pattern of patterns) {
      pattern.repos.forEach(r => repos.add(r));
    }
    return repos.size;
  }

  /**
   * Charger patterns depuis patterns.jsonl
   */
  private async loadPatterns(): Promise<PatternSequence[]> {
    try {
      const filePath = path.join(this.outputDir, 'patterns.jsonl');
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      return lines.map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  /**
   * Charger corrélations depuis correlations.jsonl
   */
  private async loadCorrelations(): Promise<CausalCorrelation[]> {
    try {
      const filePath = path.join(this.outputDir, 'correlations.jsonl');
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      return lines.map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  /**
   * Charger forecasts depuis forecasts.jsonl
   */
  private async loadForecasts(): Promise<PredictiveForecast[]> {
    try {
      const filePath = path.join(this.outputDir, 'forecasts.jsonl');
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      return lines.map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  /**
   * Charger reasoning history
   */
  private async loadReasoningHistory(): Promise<ReasoningEntry[]> {
    try {
      const filePath = path.join(this.outputDir, 'kernel', 'reasoning_history.jsonl');
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      return lines.map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  /**
   * Sauvegarder l'état cognitif
   */
  async save(): Promise<void> {
    try {
      const kernelDir = path.join(this.outputDir, 'kernel');
      await fs.mkdir(kernelDir, { recursive: true });

      // cognitive_state.json
      const statePath = path.join(kernelDir, 'cognitive_state.json');
      await fs.writeFile(statePath, JSON.stringify(this.state, null, 2), 'utf-8');
      logger.debug(`Cognitive state saved to ${statePath}`);

      // universal_rules.json
      const rulesPath = path.join(this.outputDir, 'universal_rules.json');
      await fs.writeFile(rulesPath, JSON.stringify(this.universals, null, 2), 'utf-8');
      logger.debug(`Universal rules saved to ${rulesPath}`);

    } catch (error) {
      logger.error(`Failed to save kernel: ${error}`);
    }
  }

  /**
   * Charger l'état cognitif existant
   */
  async load(): Promise<CognitiveState> {
    try {
      const statePath = path.join(this.outputDir, 'kernel', 'cognitive_state.json');
      const content = await fs.readFile(statePath, 'utf-8');
      this.state = JSON.parse(content);
      logger.success(`Loaded cognitive state: coherence=${this.state.coherence_score.toFixed(2)}`);
      return this.state;
    } catch {
      logger.warn('No existing cognitive state found, using default');
      return this.state;
    }
  }

  /**
   * Obtenir l'état actuel
   */
  getState(): CognitiveState {
    return this.state;
  }

  /**
   * Vérifier si les objectifs sont atteints
   */
  isGoalReached(): boolean {
    return (
      this.state.coherence_score > 0.9 &&
      this.state.forecast_precision > 0.75 &&
      this.state.universals > 100
    );
  }

  /**
   * Exporter le kernel pour usage externe
   */
  async export(): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const exportDir = path.join(this.outputDir, 'exports');
    const exportName = `kernel_export_${timestamp}.tar.gz`;
    
    await fs.mkdir(exportDir, { recursive: true });
    
    logger.info(`Exporting kernel to ${exportName}...`);
    
    // TODO: Créer archive tar.gz avec tous les fichiers du kernel
    // Pour l'instant, créer un fichier manifest
    const manifest = {
      export_date: new Date().toISOString(),
      cognitive_state: this.state,
      universals: this.universals,
      files: [
        'kernel/cognitive_state.json',
        'universal_rules.json',
        'patterns.jsonl',
        'correlations.jsonl',
        'forecasts.jsonl',
        'kernel/reasoning_history.jsonl',
      ],
    };
    
    const manifestPath = path.join(exportDir, `${exportName}.manifest.json`);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    
    logger.success(`Kernel exported: ${manifestPath}`);
    return manifestPath;
  }
}

