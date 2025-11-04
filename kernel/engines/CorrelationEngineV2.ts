import { promises as fs } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createLogger } from '../../trainer/utils/logger.js';
import { PatternType } from './PatternLearningEngine.js';
import { PatternSequence, CausalTimeline } from './PatternLearningEngineV2.js';

const logger = createLogger('CorrelationEngineV2');

/**
 * Corrélation causale entre patterns
 */
export interface CausalCorrelation {
  id: string;
  cause: PatternType;
  effect: PatternType;
  strength: number;  // 0-1: probabilité que cause → effect
  lag: number;  // Nombre de commits d'écart
  samples: number;  // Nombre d'observations
  context?: RepoContext;  // Contexte du repo
  confidence: number;  // Confiance dans la corrélation
}

/**
 * Chaîne causale (séquence de causalités)
 */
export interface CausalChain {
  id: string;
  chain: Array<{
    pattern: PatternType;
    position: number;
  }>;
  strength: number;  // Force globale de la chaîne
  avgLag: number;  // Lag moyen entre patterns
  repos: string[];
  frequency: number;
}

/**
 * Contexte d'un repo (pour raisonnement contextuel)
 */
export interface RepoContext {
  type: 'frontend' | 'backend' | 'fullstack' | 'library' | 'infra' | 'other';
  languages: string[];
  hasTests: boolean;
  size: 'small' | 'medium' | 'large';
  activity: 'low' | 'medium' | 'high';
}

/**
 * Règle contextuelle (règle qui dépend du contexte)
 */
export interface ContextualRule {
  id: string;
  rule: string;  // Description de la règle
  condition: Partial<RepoContext>;  // Contexte où la règle s'applique
  correlation: CausalCorrelation;
  confidence: number;
  examples: string[];  // Repos où observé
}

/**
 * Correlation Engine V2 - Reflective Layer
 * 
 * Construit le cerveau causal du RL4 :
 * - Détecte corrélations causales (cause → effect)
 * - Calcule strength et lag
 * - Construit chaînes causales
 * - Apprend règles contextuelles (repo A vs repo B)
 * 
 * Architecture:
 * 1. Analyser séquences → trouver patterns adjacents
 * 2. Calculer strength (P(effect|cause))
 * 3. Calculer lag moyen
 * 4. Détecter contexte du repo
 * 5. Grouper par contexte
 * 6. Construire chaînes causales
 * 7. Output: correlations.jsonl + causal_chains.jsonl
 */
export class CorrelationEngineV2 {
  private correlations: Map<string, CausalCorrelation> = new Map();
  private chains: CausalChain[] = [];
  private contextualRules: ContextualRule[] = [];
  private outputDir: string;

  constructor(outputDir: string = '.reasoning_rl4') {
    this.outputDir = outputDir;
  }

  /**
   * Analyser séquences et timelines pour trouver corrélations causales
   */
  async analyzeCorrelations(
    sequences: PatternSequence[],
    timelines: Map<string, CausalTimeline>
  ): Promise<{
    correlations: CausalCorrelation[];
    chains: CausalChain[];
    contextualRules: ContextualRule[];
  }> {
    logger.info(`Analyzing correlations from ${sequences.length} sequences, ${timelines.size} timelines`);

    // 1. Trouver corrélations causales dans les séquences
    const correlations = this.findCausalCorrelations(sequences);
    logger.success(`Found ${correlations.length} causal correlations`);

    // 2. Raffiner avec Merlion ML Bridge
    const refined = await this.callMerlionBridge(correlations, timelines);
    const finalCorrelations = refined.length > 0 ? refined : correlations;
    logger.success(`Correlations refined with Merlion: ${finalCorrelations.length}`);

    // 3. Enrichir avec contextes des repos
    const contextualized = await this.enrichWithContext(finalCorrelations, timelines);
    logger.success(`Enriched with contexts`);

    // 3. Construire chaînes causales
    const chains = this.buildCausalChains(sequences);
    logger.success(`Built ${chains.length} causal chains`);

    // 4. Apprendre règles contextuelles
    const rules = this.learnContextualRules(contextualized);
    logger.success(`Learned ${rules.length} contextual rules`);

    // 5. Sauvegarder
    await this.saveResults(correlations, chains, rules);

    return {
      correlations,
      chains,
      contextualRules: rules,
    };
  }

  /**
   * Appeler Merlion bridge pour raffiner les corrélations
   */
  private async callMerlionBridge(
    correlations: CausalCorrelation[],
    timelines: Map<string, CausalTimeline>
  ): Promise<CausalCorrelation[]> {
    const bridgePath = 'bridges/merlion_bridge.py';
    
    logger.info('Calling Merlion bridge for causality refinement');
    
    try {
      // Préparer input JSON
      const timelineArray = Array.from(timelines.values())[0]; // Prendre première timeline
      const input = {
        repo: timelineArray?.repo || 'unknown',
        correlations: correlations.map(c => ({
          cause: c.cause,
          effect: c.effect,
          strength: c.strength,
          lag: c.lag
        })),
        timeline: timelineArray || { events: [] },
        config: {
          causal_threshold: 0.5,
          anomaly_detection: true
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
      
      // Convertir résultats ML en CausalCorrelation
      const refined: CausalCorrelation[] = output.data.refined_correlations.map((r: any) => ({
        id: `${r.cause}→${r.effect}`,
        cause: r.cause,
        effect: r.effect,
        strength: r.causal_score || r.strength,
        lag: r.lag,
        samples: correlations.find(c => c.cause === r.cause && c.effect === r.effect)?.samples || 1,
        confidence: r.confidence || 0.5
      }));
      
      logger.success(`Merlion returned ${refined.length} refined correlations (${output.metadata.duration_ms}ms)`);
      
      return refined;
      
    } catch (error) {
      // FALLBACK : Revenir sur corrélations natives
      logger.warn(`Merlion bridge failed, using native correlations: ${error}`);
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
   * Trouver corrélations causales dans les séquences
   */
  private findCausalCorrelations(sequences: PatternSequence[]): CausalCorrelation[] {
    const correlationMap = new Map<string, {
      cause: PatternType;
      effect: PatternType;
      occurrences: number;
      lags: number[];
      repos: Set<string>;
    }>();

    // Analyser chaque séquence
    for (const seq of sequences) {
      for (let i = 0; i < seq.sequence.length - 1; i++) {
        const cause = seq.sequence[i];
        const effect = seq.sequence[i + 1];
        const lag = seq.timeline[i + 1] - seq.timeline[i];

        const key = `${cause}→${effect}`;

        if (!correlationMap.has(key)) {
          correlationMap.set(key, {
            cause,
            effect,
            occurrences: 0,
            lags: [],
            repos: new Set(),
          });
        }

        const corr = correlationMap.get(key)!;
        corr.occurrences++;
        corr.lags.push(lag);
        seq.repos.forEach(r => corr.repos.add(r));
      }
    }

    // Convertir en CausalCorrelation avec calcul de strength
    const correlations: CausalCorrelation[] = [];

    for (const [key, data] of correlationMap.entries()) {
      const avgLag = data.lags.reduce((a, b) => a + b, 0) / data.lags.length;
      const strength = this.calculateCausalStrength(
        data.occurrences,
        data.repos.size,
        avgLag
      );
      const confidence = this.calculateConfidence(
        data.occurrences,
        data.lags
      );

      if (strength >= 0.3) {  // Seuil minimum
        correlations.push({
          id: key,
          cause: data.cause,
          effect: data.effect,
          strength,
          lag: Math.round(avgLag),
          samples: data.occurrences,
          confidence,
        });
      }
    }

    // Trier par strength décroissante
    correlations.sort((a, b) => b.strength - a.strength);

    return correlations;
  }

  /**
   * Calculer la force causale (P(effect|cause))
   * 
   * Basé sur :
   * - Nombre d'occurrences (plus = plus fort)
   * - Nombre de repos (plus = plus universel)
   * - Lag (plus court = plus direct)
   */
  private calculateCausalStrength(
    occurrences: number,
    repoCount: number,
    avgLag: number
  ): number {
    // Score d'occurrence : 0.2-0.6
    const occurrenceScore = Math.min(0.6, 0.2 + (occurrences - 1) * 0.05);

    // Score d'universalité : 0.2-0.8
    const universalityScore = Math.min(0.8, 0.2 + (repoCount - 1) * 0.15);

    // Score de proximité temporelle : 0.4-1.0
    const proximityScore = avgLag > 0 ? Math.max(0.4, 1 - (avgLag / 20)) : 0.5;

    // Moyenne pondérée
    return (
      occurrenceScore * 0.3 +
      universalityScore * 0.4 +
      proximityScore * 0.3
    );
  }

  /**
   * Calculer confiance basée sur la variance des lags
   */
  private calculateConfidence(occurrences: number, lags: number[]): number {
    if (lags.length < 2) return 0.5;

    const avg = lags.reduce((a, b) => a + b, 0) / lags.length;
    const variance = lags.reduce((sum, lag) => sum + Math.pow(lag - avg, 2), 0) / lags.length;
    const stdDev = Math.sqrt(variance);

    // Plus la variance est faible, plus la confiance est haute
    const consistencyScore = Math.max(0, 1 - (stdDev / 10));
    const sampleScore = Math.min(1, occurrences / 10);

    return (consistencyScore * 0.6 + sampleScore * 0.4);
  }

  /**
   * Enrichir corrélations avec contexte des repos
   */
  private async enrichWithContext(
    correlations: CausalCorrelation[],
    timelines: Map<string, CausalTimeline>
  ): Promise<CausalCorrelation[]> {
    // Pour chaque corrélation, déterminer le contexte dominant
    for (const corr of correlations) {
      const contexts: RepoContext[] = [];

      for (const timeline of timelines.values()) {
        const context = this.detectRepoContext(timeline);
        contexts.push(context);
      }

      // Si tous les contextes sont similaires, ajouter le contexte
      if (contexts.length > 0) {
        const dominantType = this.getDominantType(contexts);
        corr.context = contexts.find(c => c.type === dominantType);
      }
    }

    return correlations;
  }

  /**
   * Détecter le contexte d'un repo depuis sa timeline
   */
  private detectRepoContext(timeline: CausalTimeline): RepoContext {
    const events = timeline.events;
    
    // Analyser patterns dominants
    const allPatterns = events.flatMap(e => e.patterns);
    const hasTests = events.some(e => e.astFeatures.functions > 0 && e.patterns.includes('test'));
    
    // Déterminer type basé sur patterns
    let type: RepoContext['type'] = 'other';
    if (allPatterns.filter(p => p === 'test').length > allPatterns.length * 0.3) {
      type = 'library';  // Beaucoup de tests
    } else if (allPatterns.filter(p => p === 'feature').length > allPatterns.length * 0.4) {
      type = 'fullstack';  // Beaucoup de features
    }

    // Déterminer taille
    const avgFunctions = events.reduce((sum, e) => sum + e.astFeatures.functions, 0) / events.length;
    let size: RepoContext['size'] = 'small';
    if (avgFunctions > 20) size = 'large';
    else if (avgFunctions > 10) size = 'medium';

    // Déterminer activité
    let activity: RepoContext['activity'] = 'low';
    if (timeline.totalCommits > 100) activity = 'high';
    else if (timeline.totalCommits > 50) activity = 'medium';

    return {
      type,
      languages: ['typescript'],  // Simplifié pour l'instant
      hasTests,
      size,
      activity,
    };
  }

  /**
   * Obtenir le type dominant parmi les contextes
   */
  private getDominantType(contexts: RepoContext[]): RepoContext['type'] {
    const counts = new Map<RepoContext['type'], number>();
    for (const ctx of contexts) {
      counts.set(ctx.type, (counts.get(ctx.type) || 0) + 1);
    }
    
    let max = 0;
    let dominant: RepoContext['type'] = 'other';
    for (const [type, count] of counts.entries()) {
      if (count > max) {
        max = count;
        dominant = type;
      }
    }
    
    return dominant;
  }

  /**
   * Construire chaînes causales depuis séquences
   */
  private buildCausalChains(sequences: PatternSequence[]): CausalChain[] {
    const chains: CausalChain[] = [];

    for (const seq of sequences) {
      if (seq.sequence.length >= 3) {  // Minimum 3 patterns pour une chaîne
        chains.push({
          id: seq.id,
          chain: seq.sequence.map((pattern, idx) => ({
            pattern,
            position: idx,
          })),
          strength: seq.confidence,
          avgLag: seq.avgLag,
          repos: seq.repos,
          frequency: seq.frequency,
        });
      }
    }

    // Trier par strength
    chains.sort((a, b) => b.strength - a.strength);

    return chains;
  }

  /**
   * Apprendre règles contextuelles
   * 
   * Règle contextuelle = corrélation qui s'applique seulement dans un contexte donné
   */
  private learnContextualRules(correlations: CausalCorrelation[]): ContextualRule[] {
    const rules: ContextualRule[] = [];

    // Grouper corrélations par contexte
    const byContext = new Map<string, CausalCorrelation[]>();

    for (const corr of correlations) {
      if (corr.context) {
        const key = corr.context.type;
        if (!byContext.has(key)) {
          byContext.set(key, []);
        }
        byContext.get(key)!.push(corr);
      }
    }

    // Créer règles pour chaque contexte
    for (const [contextType, corrs] of byContext.entries()) {
      for (const corr of corrs) {
        if (corr.strength >= 0.6) {  // Seuil pour règle
          rules.push({
            id: `rule-${contextType}-${corr.id}`,
            rule: `In ${contextType} repos: ${corr.cause} → ${corr.effect} (${Math.round(corr.strength * 100)}%)`,
            condition: {
              type: contextType as RepoContext['type'],
            },
            correlation: corr,
            confidence: corr.confidence,
            examples: [],  // Sera rempli si nécessaire
          });
        }
      }
    }

    logger.debug(`Created ${rules.length} contextual rules`);

    return rules;
  }

  /**
   * Sauvegarder résultats
   */
  private async saveResults(
    correlations: CausalCorrelation[],
    chains: CausalChain[],
    rules: ContextualRule[]
  ): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      // Corrélations
      const corrPath = path.join(this.outputDir, 'correlations.jsonl');
      const corrContent = correlations.map(c => JSON.stringify(c)).join('\n') + '\n';
      await fs.writeFile(corrPath, corrContent, 'utf-8');
      logger.debug(`Correlations saved to ${corrPath}`);

      // Chaînes causales
      const chainsPath = path.join(this.outputDir, 'causal_chains.json');
      await fs.writeFile(chainsPath, JSON.stringify(chains, null, 2), 'utf-8');
      logger.debug(`Causal chains saved to ${chainsPath}`);

      // Règles contextuelles
      const rulesPath = path.join(this.outputDir, 'contextual_rules.json');
      await fs.writeFile(rulesPath, JSON.stringify(rules, null, 2), 'utf-8');
      logger.debug(`Contextual rules saved to ${rulesPath}`);

    } catch (error) {
      logger.error(`Failed to save results: ${error}`);
    }
  }

  /**
   * Récupérer toutes les corrélations
   */
  getCorrelations(): CausalCorrelation[] {
    return Array.from(this.correlations.values());
  }

  /**
   * Récupérer les chaînes causales
   */
  getCausalChains(): CausalChain[] {
    return this.chains;
  }

  /**
   * Récupérer les règles contextuelles
   */
  getContextualRules(): ContextualRule[] {
    return this.contextualRules;
  }
}

