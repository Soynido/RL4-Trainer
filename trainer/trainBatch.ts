#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, basename } from 'path';
import pLimit from 'p-limit';
import { createLogger } from './utils/logger.js';
import { GitHistoryReplayer } from './replayGitHistory.js';
import { RL4KernelTrainer } from '../kernel/RL4KernelTrainer.js';
import { GitEvent } from '../kernel/engines/PatternLearningEngine.js';
import { autoDumpIfNeeded } from './autoDumpManager.js';
import { ASTParserWorker } from './workers/ASTParserWorker.js';

const logger = createLogger('trainBatch');

/**
 * Configuration globale de l'entraînement
 */
export interface TrainingConfig {
  repoListPath: string;
  maxRepos?: number;
  concurrency: number;
  outputDir: string;
  datasetsDir: string;
  temporalWindowMs?: number;
  skipReplay?: boolean;
}

/**
 * Résultat de l'entraînement pour un repo
 */
export interface RepoTrainingResult {
  repo: string;
  success: boolean;
  error?: string;
  stats?: {
    events: number;
    patterns: number;
    correlations: number;
    forecasts: number;
    adrs: number;
    duration_ms: number;
  };
}

/**
 * Résumé global de l'entraînement
 */
export interface TrainingSummary {
  totalRepos: number;
  successful: number;
  failed: number;
  results: RepoTrainingResult[];
  totalDuration_ms: number;
  startTime: string;
  endTime: string;
}

/**
 * Orchestrateur d'entraînement batch
 */
export class BatchTrainer {
  private config: TrainingConfig;

  constructor(config: TrainingConfig) {
    this.config = config;
  }

  /**
   * Lancer l'entraînement sur tous les repos
   */
  async trainAll(): Promise<TrainingSummary> {
    const startTime = Date.now();
    const startTimeISO = new Date().toISOString();

    logger.info('Starting batch training');
    logger.info(`Concurrency: ${this.config.concurrency}`);

    try {
      // Charger la liste des repos
      const repos = await this.loadRepoList();
      logger.success(`Loaded ${repos.length} repositories`);

      // Validation du dataset
      if (repos.length < 500) {
        logger.warn(`⚠️  Only ${repos.length} repos found in repo-list.txt (recommended: 500+)`);
        logger.warn('   Consider running: bash scripts/fetch-repos.sh');
      }

      // Limiter si nécessaire
      const reposToProcess = this.config.maxRepos 
        ? repos.slice(0, this.config.maxRepos)
        : repos;

      if (reposToProcess.length < repos.length) {
        logger.info(`Processing first ${reposToProcess.length} repos (max_repos limit)`);
      }

      // Traiter en parallèle avec p-limit
      const limit = pLimit(this.config.concurrency);
      const promises = reposToProcess.map(repo =>
        limit(() => this.trainRepo(repo))
      );

      logger.info(`Processing ${reposToProcess.length} repos with concurrency ${this.config.concurrency}...`);
      const results = await Promise.allSettled(promises);

      // 🧠 Point #2 : Consolidation automatique après batch
      logger.info('Post-batch consolidation...');
      
      // Consolidation cognitive
      try {
        const { execSync } = await import('child_process');
        execSync('npm run consolidate', { stdio: 'inherit' });
        logger.success('Kernel consolidated');
      } catch (error) {
        const err = error as Error;
        logger.warn('Consolidation failed (non-blocking):', { message: err.message });
      }
      
      // Compaction ledger
      try {
        const { execSync } = await import('child_process');
        execSync('npm run compact', { stdio: 'inherit' });
        logger.success('Ledger compacted');
      } catch (error) {
        const err = error as Error;
        logger.warn('Compaction failed (non-blocking):', { message: err.message });
      }
      
      // Auto-dump si nécessaire
      logger.info('Checking workspace size...');
      const dumped = await autoDumpIfNeeded();
      if (dumped) {
        logger.success('Workspace rotated and cleaned');
      }

      // Agréger les résultats
      const repoResults: RepoTrainingResult[] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            repo: reposToProcess[index],
            success: false,
            error: result.reason?.message || 'Unknown error',
          };
        }
      });

      const successful = repoResults.filter(r => r.success).length;
      const failed = repoResults.filter(r => !r.success).length;

      const summary: TrainingSummary = {
        totalRepos: reposToProcess.length,
        successful,
        failed,
        results: repoResults,
        totalDuration_ms: Date.now() - startTime,
        startTime: startTimeISO,
        endTime: new Date().toISOString(),
      };

      // Sauvegarder le résumé
      await this.saveSummary(summary);

      // Afficher résumé
      this.displaySummary(summary);

      return summary;

    } catch (error) {
      logger.error('Batch training failed', error);
      throw error;
    }
  }

  /**
   * Entraîner un seul repo (pipeline complet)
   */
  private async trainRepo(repoPath: string): Promise<RepoTrainingResult> {
    let repoName = basename(repoPath);
    const startTime = Date.now();

    logger.info(`Starting training for: ${repoName}`);

    try {
      // Phase 0: Cloner si c'est une URL GitHub
      let actualRepoPath = repoPath;
      if (repoPath.startsWith('http://') || repoPath.startsWith('https://')) {
        // Extraire le nom du repo depuis l'URL
        const urlMatch = repoPath.match(/github\.com\/([^/]+)\/([^/\.]+)/);
        if (urlMatch) {
          repoName = `${urlMatch[1]}-${urlMatch[2]}`;
        }
        
        logger.info(`[${repoName}] Cloning from GitHub: ${repoPath}`);
        const cloneDir = join(this.config.datasetsDir, 'corpus', repoName);
        
        try {
          // Vérifier si déjà cloné
          const alreadyCloned = await fs.access(join(cloneDir, '.git'))
            .then(() => true)
            .catch(() => false);
          
          if (!alreadyCloned) {
            // Créer le dossier parent
            await fs.mkdir(cloneDir, { recursive: true });
            
            // Cloner avec profondeur limitée
            const { execSync } = await import('child_process');
            execSync(`git clone --depth 50 --quiet "${repoPath}" "${cloneDir}"`, {
              stdio: 'inherit',
              timeout: 300000, // 5min max
            });
            logger.success(`[${repoName}] Clone complete`);
          } else {
            logger.info(`[${repoName}] Already cloned, skipping`);
          }
          
          actualRepoPath = cloneDir;
        } catch (error) {
          logger.error(`[${repoName}] Clone failed, skipping repo`, error);
          throw new Error(`Failed to clone ${repoPath}`);
        }
      }

      // Phase 1: Replay Git History (si pas déjà fait)
      let eventsPath = join(this.config.datasetsDir, 'corpus', repoName, 'commits.jsonl');
      
      if (!this.config.skipReplay) {
        logger.info(`[${repoName}] Phase 1: Replaying Git history`);
        const replayer = new GitHistoryReplayer({
          repoPath: actualRepoPath,
          outputDir: this.config.datasetsDir,
        });
        const replayResult = await replayer.replay();
        eventsPath = replayResult.outputPath;
        logger.success(`[${repoName}] Replay complete: ${replayResult.eventsGenerated} events`);
      } else {
        logger.info(`[${repoName}] Skipping replay, using existing events`);
      }

      // Vérifier que le fichier d'événements existe
      try {
        await fs.access(eventsPath);
      } catch {
        throw new Error(`Events file not found: ${eventsPath}. Run without --skip-replay first.`);
      }

      // Phase 1.5: Analyse AST du repo (état actuel)
      logger.info(`[${repoName}] Phase 1.5: Analyzing AST`);
      const astWorker = new ASTParserWorker(join(this.config.outputDir, 'tmp'));
      
      // Analyser les fichiers TypeScript/JavaScript du repo
      const tsFiles = await this.findSourceFiles(actualRepoPath);
      if (tsFiles.length > 0) {
        // Analyser avec un commit "HEAD" symbolique
        await astWorker.analyzeCommit(repoName, 'HEAD', tsFiles);
        logger.success(`[${repoName}] AST analysis complete: ${tsFiles.length} files analyzed`);
      } else {
        logger.info(`[${repoName}] No TypeScript/JavaScript files found, skipping AST analysis`);
      }

      // Phase 2: Charger les événements
      logger.info(`[${repoName}] Phase 2: Loading events`);
      const fileContent = await fs.readFile(eventsPath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      const events: GitEvent[] = lines.map(line => JSON.parse(line));
      logger.success(`[${repoName}] Loaded ${events.length} events`);

      // Phase 3: Exécuter le kernel RL4
      logger.info(`[${repoName}] Phase 3: Running RL4 Kernel`);
      
      // Déterminer le chemin AST features si disponible
      const astFeaturesPath = join(this.config.outputDir, 'tmp', `ast_${repoName}_HEAD.jsonl`);
      
      const kernel = new RL4KernelTrainer({
        repoName,
        eventsPath,
        outputDir: this.config.outputDir,
        temporalWindowMs: this.config.temporalWindowMs,
        enableV2: true,  // Activer Pattern Learning V2
        astFeaturesPath,  // Passer les AST features
      });

      const cycleResult = await kernel.runCycle(events);
      await kernel.close();

      logger.success(`[${repoName}] Kernel complete: ${cycleResult.phases.patterns.count} patterns, ${cycleResult.phases.adrs.count} ADRs`);

      // Construire le résultat
      const result: RepoTrainingResult = {
        repo: repoName,
        success: true,
        stats: {
          events: events.length,
          patterns: cycleResult.phases.patterns.count,
          correlations: cycleResult.phases.correlations.count,
          forecasts: cycleResult.phases.forecasts.count,
          adrs: cycleResult.phases.adrs.count,
          duration_ms: Date.now() - startTime,
        },
      };

      logger.success(`[${repoName}] Training complete in ${result.stats!.duration_ms}ms`);
      return result;

    } catch (error) {
      logger.error(`[${repoName}] Training failed`, error);
      return {
        repo: repoName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Charger la liste des repos depuis le fichier
   */
  private async loadRepoList(): Promise<string[]> {
    try {
      const content = await fs.readFile(this.config.repoListPath, 'utf-8');
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Ignorer commentaires et lignes vides

      return lines;
    } catch (error) {
      logger.error(`Failed to load repo list from ${this.config.repoListPath}`, error);
      throw error;
    }
  }

  /**
   * Sauvegarder le résumé de l'entraînement
   */
  private async saveSummary(summary: TrainingSummary): Promise<void> {
    const summaryPath = join(this.config.outputDir, 'diagnostics', `training-summary-${Date.now()}.json`);
    
    try {
      await fs.mkdir(join(this.config.outputDir, 'diagnostics'), { recursive: true });
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
      logger.success(`Training summary saved to ${summaryPath}`);
    } catch (error) {
      logger.error('Failed to save training summary', error);
    }
  }

  /**
   * Trouver les fichiers source TypeScript/JavaScript dans un repo
   */
  private async findSourceFiles(repoPath: string): Promise<string[]> {
    const files: string[] = [];
    const ignoreDirs = ['node_modules', 'dist', 'build', '.git', 'coverage', 'vendor'];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            // Ignorer les dossiers courants
            if (!ignoreDirs.includes(entry.name)) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            // Ajouter si extension valide
            if (extensions.some(ext => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Ignorer les erreurs de permission
      }
    };

    await walk(repoPath);
    
    // Limiter à 100 fichiers pour éviter les analyses trop longues
    return files.slice(0, 100);
  }

  /**
   * Afficher le résumé dans la console
   */
  private displaySummary(summary: TrainingSummary): void {
    console.log('\n' + '='.repeat(60));
    console.log('BATCH TRAINING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Repos:     ${summary.totalRepos}`);
    console.log(`Successful:      ${summary.successful} ✓`);
    console.log(`Failed:          ${summary.failed} ✗`);
    console.log(`Total Duration:  ${(summary.totalDuration_ms / 1000).toFixed(2)}s`);
    console.log(`Start Time:      ${summary.startTime}`);
    console.log(`End Time:        ${summary.endTime}`);
    
    if (summary.successful > 0) {
      console.log('\n--- Successful Repos ---');
      const successful = summary.results.filter(r => r.success);
      for (const result of successful) {
        if (result.stats) {
          console.log(`  ✓ ${result.repo}: ${result.stats.patterns} patterns, ${result.stats.adrs} ADRs (${result.stats.duration_ms}ms)`);
        }
      }
    }

    if (summary.failed > 0) {
      console.log('\n--- Failed Repos ---');
      const failed = summary.results.filter(r => !r.success);
      for (const result of failed) {
        console.log(`  ✗ ${result.repo}: ${result.error}`);
      }
    }

    console.log('='.repeat(60) + '\n');
  }
}

/**
 * Charger la configuration depuis le fichier
 */
async function loadConfig(configPath: string): Promise<Partial<TrainingConfig>> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.warn(`Could not load config from ${configPath}, using defaults`);
    return {};
  }
}

/**
 * CLI principal
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parser les arguments
  let maxRepos: number | undefined;
  let concurrency: number | undefined;
  let skipReplay = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-repos' && args[i + 1]) {
      maxRepos = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--skip-replay') {
      skipReplay = true;
    }
  }

  // Charger config du fichier
  const fileConfig = await loadConfig('train.config.json');

  // Fusionner avec config par défaut et args CLI
  const config: TrainingConfig = {
    repoListPath: process.env.REPO_LIST_PATH || 'datasets/repo-list.txt',
    maxRepos: maxRepos || (fileConfig as any).max_repos,
    concurrency: concurrency || fileConfig.concurrency || 4,
    outputDir: (fileConfig as any).output_dir || '.reasoning_rl4',
    datasetsDir: 'datasets',
    temporalWindowMs: (fileConfig as any).cycle_interval_ms || 7 * 24 * 60 * 60 * 1000,
    skipReplay,
  };

  logger.info('RL4 Batch Trainer starting...');
  logger.info(`Configuration:`);
  logger.info(`  - Repo List: ${config.repoListPath}`);
  logger.info(`  - Max Repos: ${config.maxRepos || 'unlimited'}`);
  logger.info(`  - Concurrency: ${config.concurrency}`);
  logger.info(`  - Output Dir: ${config.outputDir}`);
  logger.info(`  - Skip Replay: ${config.skipReplay ? 'yes' : 'no'}`);

  try {
    const trainer = new BatchTrainer(config);
    const summary = await trainer.trainAll();

    if (summary.failed > 0) {
      logger.warn(`Training completed with ${summary.failed} failures`);
      process.exit(1);
    } else {
      logger.success('All repos trained successfully!');
    }
  } catch (error) {
    logger.error('Batch training failed', error);
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

