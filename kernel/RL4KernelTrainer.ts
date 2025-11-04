#!/usr/bin/env node

import { createHash } from 'crypto';
import { PatternLearningEngine, GitEvent } from './engines/PatternLearningEngine.js';
import { PatternLearningEngineV2, PatternSequence, CausalTimeline } from './engines/PatternLearningEngineV2.js';
import { CorrelationEngine } from './engines/CorrelationEngine.js';
import { CorrelationEngineV2, CausalCorrelation, CausalChain, ContextualRule } from './engines/CorrelationEngineV2.js';
import { ForecastEngine } from './engines/ForecastEngine.js';
import { ADRGeneratorV2 } from './engines/ADRGeneratorV2.js';
import { AppendOnlyWriter } from './utils/AppendOnlyWriter.js';
import { createLogger } from '../trainer/utils/logger.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

const logger = createLogger('RL4KernelTrainer');

/**
 * Format du cycle dans le ledger
 */
export interface CycleResult {
  cycleId: number;
  timestamp: string;
  phases: {
    patterns: {
      detected: unknown[];
      count: number;
    };
    sequences?: {  // Nouveau: séquences temporelles
      extracted: PatternSequence[];
      count: number;
    };
    timeline?: CausalTimeline;  // Nouveau: timeline causale
    correlations: {
      found: unknown[];
      count: number;
    };
    causalCorrelations?: {  // Nouveau: corrélations causales V2
      found: CausalCorrelation[];
      count: number;
    };
    causalChains?: CausalChain[];  // Nouveau: chaînes causales
    contextualRules?: ContextualRule[];  // Nouveau: règles contextuelles
    forecasts: {
      predictions: unknown[];
      count: number;
    };
    adrs: {
      generated: unknown[];
      count: number;
    };
  };
  merkleRoot: string;
  prevMerkleRoot: string;
  metadata: {
    repo: string;
    duration_ms: number;
    events_processed: number;
  };
}

/**
 * Configuration du kernel
 */
export interface KernelConfig {
  repoName: string;
  eventsPath: string;
  outputDir: string;
  temporalWindowMs?: number;
  enableV2?: boolean;  // Activer Pattern Learning V2
  astFeaturesPath?: string;  // Chemin vers AST features
}

/**
 * Kernel headless RL4 pour entraînement batch
 */
export class RL4KernelTrainer {
  private patternEngine: PatternLearningEngine;
  private patternEngineV2: PatternLearningEngineV2;  // Nouveau
  private correlationEngine: CorrelationEngine;
  private correlationEngineV2: CorrelationEngineV2;  // Nouveau V2
  private forecastEngine: ForecastEngine;
  private adrGenerator: ADRGeneratorV2;
  private ledgerWriter: AppendOnlyWriter;
  private cycleCounter = 0;
  private prevMerkleRoot = '0'.repeat(64);

  constructor(private config: KernelConfig) {
    this.patternEngine = new PatternLearningEngine();
    this.patternEngineV2 = new PatternLearningEngineV2(config.outputDir);  // Nouveau
    this.correlationEngine = new CorrelationEngine(config.temporalWindowMs);
    this.correlationEngineV2 = new CorrelationEngineV2(config.outputDir);  // Nouveau V2
    this.forecastEngine = new ForecastEngine();
    this.adrGenerator = new ADRGeneratorV2();

    // Initialiser le writer du ledger
    const ledgerPath = join(config.outputDir, 'ledger', 'cycles.jsonl');
    this.ledgerWriter = new AppendOnlyWriter({
      filePath: ledgerPath,
      bufferSize: 10,
      flushIntervalMs: 5000,
      maxFileSizeMB: 100,
    });
  }

  /**
   * Exécuter un cycle complet d'analyse
   */
  async runCycle(events: GitEvent[]): Promise<CycleResult> {
    const startTime = Date.now();
    this.cycleCounter++;

    logger.info(`Starting cycle ${this.cycleCounter} with ${events.length} events`);

    try {
      // Phase 1: Pattern Learning
      logger.debug('Phase 1: Pattern Learning');
      const patterns = await this.patternEngine.detectPatterns(events);
      logger.success(`Phase 1 complete: ${patterns.length} patterns detected`);

      // Phase 1.5: Pattern Learning V2 (si activé)
      let sequences: PatternSequence[] = [];
      let timeline: CausalTimeline | undefined;
      
      if (this.config.enableV2) {
        logger.debug('Phase 1.5: Pattern Learning V2 (Analytical Layer)');
        const v2Result = await this.patternEngineV2.analyzeRepo(
          this.config.repoName,
          events,
          patterns,
          this.config.astFeaturesPath
        );
        sequences = v2Result.sequences;
        timeline = v2Result.timeline;
        logger.success(`Phase 1.5 complete: ${sequences.length} sequences, ${timeline.events.length} timeline events`);
      }

      // Phase 2: Correlation
      logger.debug('Phase 2: Correlation Analysis');
      const correlations = await this.correlationEngine.findCorrelations(patterns);
      logger.success(`Phase 2 complete: ${correlations.length} correlations found`);

      // Phase 2.5: Correlation V2 (si V2 activée)
      let causalCorrelations: CausalCorrelation[] = [];
      let causalChains: CausalChain[] = [];
      let contextualRules: ContextualRule[] = [];

      if (this.config.enableV2 && sequences.length > 0 && timeline) {
        logger.debug('Phase 2.5: Correlation V2 (Reflective Layer)');
        const timelinesMap = new Map<string, CausalTimeline>();
        timelinesMap.set(this.config.repoName, timeline);
        
        const v2Result = await this.correlationEngineV2.analyzeCorrelations(sequences, timelinesMap);
        causalCorrelations = v2Result.correlations;
        causalChains = v2Result.chains;
        contextualRules = v2Result.contextualRules;
        logger.success(`Phase 2.5 complete: ${causalCorrelations.length} causal correlations, ${causalChains.length} chains, ${contextualRules.length} rules`);
      }

      // Phase 3: Forecast
      logger.debug('Phase 3: Forecast Generation');
      const forecasts = await this.forecastEngine.generateForecasts(correlations, patterns);
      logger.success(`Phase 3 complete: ${forecasts.length} forecasts generated`);

      // Phase 4: ADR Generation
      logger.debug('Phase 4: ADR Generation');
      const adrs = await this.adrGenerator.generateADRs(forecasts, correlations, patterns);
      logger.success(`Phase 4 complete: ${adrs.length} ADRs generated`);

      // Construire le résultat du cycle
      const cycle: CycleResult = {
        cycleId: this.cycleCounter,
        timestamp: new Date().toISOString(),
        phases: {
          patterns: {
            detected: patterns,
            count: patterns.length,
          },
          ...(this.config.enableV2 && {
            sequences: {
              extracted: sequences,
              count: sequences.length,
            },
            timeline,
          }),
          correlations: {
            found: correlations,
            count: correlations.length,
          },
          ...(this.config.enableV2 && {
            causalCorrelations: {
              found: causalCorrelations,
              count: causalCorrelations.length,
            },
            causalChains,
            contextualRules,
          }),
          forecasts: {
            predictions: forecasts,
            count: forecasts.length,
          },
          adrs: {
            generated: adrs,
            count: adrs.length,
          },
        },
        merkleRoot: '',
        prevMerkleRoot: this.prevMerkleRoot,
        metadata: {
          repo: this.config.repoName,
          duration_ms: Date.now() - startTime,
          events_processed: events.length,
        },
      };

      // Calculer le merkleRoot
      cycle.merkleRoot = this.calculateMerkleRoot(cycle);
      this.prevMerkleRoot = cycle.merkleRoot;

      // Écrire dans le ledger
      await this.writeLedger(cycle);

      logger.success(`Cycle ${this.cycleCounter} completed in ${cycle.metadata.duration_ms}ms`);

      return cycle;
    } catch (error) {
      logger.error(`Cycle ${this.cycleCounter} failed`, error);
      throw error;
    }
  }

  /**
   * Calculer le merkleRoot d'un cycle (hash SHA-256)
   */
  private calculateMerkleRoot(cycle: Omit<CycleResult, 'merkleRoot'>): string {
    // Exclure merkleRoot du calcul, inclure tout le reste
    const dataToHash = JSON.stringify({
      cycleId: cycle.cycleId,
      timestamp: cycle.timestamp,
      phases: {
        patterns: { count: cycle.phases.patterns.count },
        correlations: { count: cycle.phases.correlations.count },
        forecasts: { count: cycle.phases.forecasts.count },
        adrs: { count: cycle.phases.adrs.count },
      },
      prevMerkleRoot: cycle.prevMerkleRoot,
      metadata: cycle.metadata,
    });

    return createHash('sha256').update(dataToHash).digest('hex');
  }

  /**
   * Écrire le cycle dans le ledger
   */
  private async writeLedger(cycle: CycleResult): Promise<void> {
    try {
      await this.ledgerWriter.append(cycle as any);
      logger.debug(`Cycle ${cycle.cycleId} written to ledger`);
    } catch (error) {
      logger.error('Failed to write cycle to ledger', error);
      throw error;
    }
  }

  /**
   * Fermer le kernel (cleanup)
   */
  async close(): Promise<void> {
    logger.info('Closing kernel...');
    await this.ledgerWriter.close();
    logger.success('Kernel closed');
  }

  /**
   * Obtenir les statistiques du cycle actuel
   */
  getStats() {
    return {
      cycleCount: this.cycleCounter,
      patternStats: this.patternEngine.getStats(),
      correlationStats: this.correlationEngine.getStats(),
    };
  }
}

/**
 * CLI pour exécuter le kernel en standalone
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parser les arguments
  let repoPath: string | undefined;
  let eventsFile: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) {
      repoPath = args[i + 1];
    }
    if (args[i] === '--events' && args[i + 1]) {
      eventsFile = args[i + 1];
    }
  }

  if (!repoPath) {
    console.error('Usage: node RL4KernelTrainer.js --repo <repo-name> [--events <events.jsonl>]');
    process.exit(1);
  }

  // Charger la config
  const config: KernelConfig = {
    repoName: repoPath,
    eventsPath: eventsFile || join('datasets', 'corpus', repoPath, 'commits.jsonl'),
    outputDir: '.reasoning_rl4',
    temporalWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 jours
  };

  logger.info(`Starting RL4 Kernel Trainer for repo: ${config.repoName}`);

  try {
    // Lire les événements
    logger.info(`Reading events from ${config.eventsPath}`);
    const fileContent = await readFile(config.eventsPath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const events: GitEvent[] = lines.map(line => JSON.parse(line));
    
    logger.success(`Loaded ${events.length} events`);

    // Créer et exécuter le kernel
    const kernel = new RL4KernelTrainer(config);
    const result = await kernel.runCycle(events);

    // Afficher résumé
    console.log('\n=== Cycle Result ===');
    console.log(`Cycle ID: ${result.cycleId}`);
    console.log(`Duration: ${result.metadata.duration_ms}ms`);
    console.log(`Patterns: ${result.phases.patterns.count}`);
    console.log(`Correlations: ${result.phases.correlations.count}`);
    console.log(`Forecasts: ${result.phases.forecasts.count}`);
    console.log(`ADRs: ${result.phases.adrs.count}`);
    console.log(`Merkle Root: ${result.merkleRoot}`);

    // Fermer le kernel
    await kernel.close();

    logger.success('RL4 Kernel Trainer completed successfully');
  } catch (error) {
    logger.error('RL4 Kernel Trainer failed', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

