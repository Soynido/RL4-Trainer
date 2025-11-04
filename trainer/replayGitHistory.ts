#!/usr/bin/env node

import simpleGit, { SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { createLogger } from './utils/logger.js';
import { GitEvent } from '../kernel/engines/PatternLearningEngine.js';

const logger = createLogger('replayGitHistory');

/**
 * Configuration pour le replay Git
 */
export interface ReplayConfig {
  repoPath: string;
  outputDir: string;
  limit?: number;
  branch?: string;
}

/**
 * Résultat du replay
 */
export interface ReplayResult {
  repoName: string;
  eventsGenerated: number;
  outputPath: string;
  timeRange: {
    first: string;
    last: string;
  };
}

/**
 * Replayer l'historique Git d'un repository
 */
export class GitHistoryReplayer {
  private git: SimpleGit;
  private repoName: string;

  constructor(private config: ReplayConfig) {
    const git = simpleGit.default ? simpleGit.default : simpleGit;
    this.git = (git as any)(config.repoPath);
    this.repoName = basename(config.repoPath);
  }

  /**
   * Exécuter le replay complet
   */
  async replay(): Promise<ReplayResult> {
    logger.info(`Starting replay for repo: ${this.repoName}`);

    try {
      // Vérifier que c'est un repo Git valide
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error(`${this.config.repoPath} is not a valid Git repository`);
      }

      // Extraire les commits
      const events = await this.extractCommits();
      logger.success(`Extracted ${events.length} commits`);

      // Écrire les événements dans le dataset
      const outputPath = await this.writeToDataset(events);
      
      const result: ReplayResult = {
        repoName: this.repoName,
        eventsGenerated: events.length,
        outputPath,
        timeRange: {
          first: events[0]?.timestamp || '',
          last: events[events.length - 1]?.timestamp || '',
        },
      };

      logger.success(`Replay completed: ${result.eventsGenerated} events written to ${result.outputPath}`);
      return result;

    } catch (error) {
      logger.error(`Replay failed for ${this.repoName}`, error);
      throw error;
    }
  }

  /**
   * Extraire les commits avec leurs statistiques
   */
  private async extractCommits(): Promise<GitEvent[]> {
    const events: GitEvent[] = [];
    const branch = this.config.branch || 'HEAD';

    logger.info(`Fetching commits from branch: ${branch}`);

    // Options pour git log
    const logOptions: string[] = [
      '--reverse',
      '--numstat',
      '--format=%H|%an|%ae|%aI|%s',
    ];

    if (this.config.limit) {
      logOptions.push(`-n${this.config.limit}`);
    }

    // Exécuter git log
    const logResult = await this.git.raw(['log', ...logOptions, branch]);
    
    // Parser le résultat
    const commits = this.parseGitLog(logResult);
    
    logger.debug(`Parsed ${commits.length} commits`);

    // Convertir en événements normalisés
    for (const commit of commits) {
      const event = await this.normalizeEvent(commit);
      events.push(event);
    }

    return events;
  }

  /**
   * Parser le résultat de git log
   */
  private parseGitLog(logOutput: string): Array<{
    hash: string;
    author: string;
    email: string;
    date: string;
    message: string;
    files: Array<{ path: string; additions: number; deletions: number }>;
  }> {
    const commits: Array<{
      hash: string;
      author: string;
      email: string;
      date: string;
      message: string;
      files: Array<{ path: string; additions: number; deletions: number }>;
    }> = [];

    const lines = logOutput.split('\n');
    let currentCommit: {
      hash: string;
      author: string;
      email: string;
      date: string;
      message: string;
      files: Array<{ path: string; additions: number; deletions: number }>;
    } | null = null;

    for (const line of lines) {
      // Format: hash|author|email|date|message
      if (line.includes('|') && !line.startsWith('\t')) {
        // Sauvegarder le commit précédent
        if (currentCommit) {
          commits.push(currentCommit);
        }

        // Parser nouveau commit
        const parts = line.split('|');
        if (parts.length >= 5) {
          currentCommit = {
            hash: parts[0],
            author: parts[1],
            email: parts[2],
            date: parts[3],
            message: parts.slice(4).join('|'), // Au cas où le message contient des |
            files: [],
          };
        }
      } else if (line.trim() && currentCommit) {
        // Parser numstat: additions  deletions  path
        const statMatch = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
        if (statMatch) {
          const additions = statMatch[1] === '-' ? 0 : parseInt(statMatch[1], 10);
          const deletions = statMatch[2] === '-' ? 0 : parseInt(statMatch[2], 10);
          const path = statMatch[3];

          currentCommit.files.push({
            path,
            additions,
            deletions,
          });
        }
      }
    }

    // Ajouter le dernier commit
    if (currentCommit) {
      commits.push(currentCommit);
    }

    return commits;
  }

  /**
   * Normaliser un commit en événement
   */
  private async normalizeEvent(commit: {
    hash: string;
    author: string;
    email: string;
    date: string;
    message: string;
    files: Array<{ path: string; additions: number; deletions: number }>;
  }): Promise<GitEvent> {
    // Déterminer le status des fichiers (approximation basée sur additions/deletions)
    const files = commit.files.map(file => {
      let status: 'added' | 'modified' | 'deleted';
      
      if (file.deletions === 0 && file.additions > 0) {
        status = 'added';
      } else if (file.additions === 0 && file.deletions > 0) {
        status = 'deleted';
      } else {
        status = 'modified';
      }

      return {
        path: file.path,
        status,
        additions: file.additions,
        deletions: file.deletions,
      };
    });

    return {
      type: 'commit',
      timestamp: commit.date,
      author: `${commit.author} <${commit.email}>`,
      hash: commit.hash,
      message: commit.message,
      files,
      metadata: {
        repo: this.repoName,
        branch: this.config.branch || 'main',
      },
    };
  }

  /**
   * Écrire les événements dans le dataset
   */
  private async writeToDataset(events: GitEvent[]): Promise<string> {
    // Créer le dossier de sortie
    const corpusDir = join(this.config.outputDir, 'corpus', this.repoName);
    await fs.mkdir(corpusDir, { recursive: true });

    // Chemin du fichier de sortie
    const outputPath = join(corpusDir, 'commits.jsonl');

    // Écrire en JSONL
    const lines = events.map(event => JSON.stringify(event)).join('\n');
    await fs.writeFile(outputPath, lines + '\n', 'utf-8');

    // Écrire aussi un fichier de métadonnées
    const metadata = {
      repo_name: this.repoName,
      repo_path: this.config.repoPath,
      events_count: events.length,
      time_range: {
        first: events[0]?.timestamp || null,
        last: events[events.length - 1]?.timestamp || null,
      },
      generated_at: new Date().toISOString(),
    };

    const metadataPath = join(corpusDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    logger.debug(`Wrote metadata to ${metadataPath}`);

    return outputPath;
  }
}

/**
 * CLI pour exécuter le replay en standalone
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parser les arguments
  let repoPath: string | undefined;
  let limit: number | undefined;
  let branch: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) {
      repoPath = args[i + 1];
    }
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--branch' && args[i + 1]) {
      branch = args[i + 1];
    }
  }

  if (!repoPath) {
    console.error('Usage: node replayGitHistory.js --repo <path> [--limit <n>] [--branch <name>]');
    process.exit(1);
  }

  const config: ReplayConfig = {
    repoPath,
    outputDir: 'datasets',
    limit,
    branch,
  };

  logger.info('Starting Git History Replay');
  logger.info(`Repo: ${repoPath}`);
  if (limit) logger.info(`Limit: ${limit} commits`);
  if (branch) logger.info(`Branch: ${branch}`);

  try {
    const replayer = new GitHistoryReplayer(config);
    const result = await replayer.replay();

    // Afficher résumé
    console.log('\n=== Replay Result ===');
    console.log(`Repo: ${result.repoName}`);
    console.log(`Events: ${result.eventsGenerated}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Time Range: ${result.timeRange.first} → ${result.timeRange.last}`);

    logger.success('Git History Replay completed successfully');
  } catch (error) {
    logger.error('Git History Replay failed', error);
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

