#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join } from 'path';
import { createLogger } from '../trainer/utils/logger.js';
import { MetricsReport, MetricsInsight } from '../metrics/types.js';
import { MetaADR, createMetaADR, formatMetaADR } from './templates/metaADR.js';
import { MetricsEngine } from '../metrics/MetricsEngine.js';

const logger = createLogger('FeedbackEngine');

/**
 * Configuration du FeedbackEngine
 */
export interface FeedbackEngineConfig {
  metricsPath: string;
  outputDir: string;
  minSeverity?: 'low' | 'medium' | 'high';
}

/**
 * Résultat de la génération de feedback
 */
export interface FeedbackResult {
  metaADRsGenerated: number;
  outputPaths: string[];
  summary: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Engine de génération de feedback (meta-ADRs)
 */
export class FeedbackEngine {
  private config: FeedbackEngineConfig;

  constructor(config: FeedbackEngineConfig) {
    this.config = config;
  }

  /**
   * Générer tous les feedbacks à partir des métriques
   */
  async generateFeedback(): Promise<FeedbackResult> {
    logger.info('Generating feedback from metrics');

    try {
      // Charger le rapport de métriques
      const report = await this.loadMetricsReport();
      
      // Créer le MetricsEngine pour l'analyse
      const metricsEngine = new MetricsEngine({
        ledgerPath: '.reasoning_rl4/ledger/cycles.jsonl',
        outputPath: this.config.metricsPath,
      });

      // Analyser et obtenir les insights
      const insights = await metricsEngine.analyzeMetrics(report);
      logger.success(`Found ${insights.length} insights`);

      if (insights.length === 0) {
        logger.info('No insights found - no meta-ADRs to generate');
        return {
          metaADRsGenerated: 0,
          outputPaths: [],
          summary: { high: 0, medium: 0, low: 0 },
        };
      }

      // Filtrer par sévérité minimale si configuré
      const filteredInsights = this.filterBySeverity(insights);
      logger.info(`Filtered to ${filteredInsights.length} insights (min severity: ${this.config.minSeverity || 'low'})`);

      // Générer meta-ADRs
      const metaADRs = await this.generateMetaADRs(filteredInsights);
      logger.success(`Generated ${metaADRs.length} meta-ADRs`);

      // Sauvegarder les meta-ADRs
      const outputPaths = await this.saveMetaADRs(metaADRs);

      // Résumé
      const summary = this.summarize(metaADRs);

      // Afficher résumé
      this.displaySummary(metaADRs);

      return {
        metaADRsGenerated: metaADRs.length,
        outputPaths,
        summary,
      };

    } catch (error) {
      logger.error('Failed to generate feedback', error);
      throw error;
    }
  }

  /**
   * Charger le rapport de métriques
   */
  private async loadMetricsReport(): Promise<MetricsReport> {
    try {
      const content = await fs.readFile(this.config.metricsPath, 'utf-8');
      return JSON.parse(content) as MetricsReport;
    } catch (error) {
      logger.error(`Failed to load metrics report from ${this.config.metricsPath}`, error);
      throw error;
    }
  }

  /**
   * Filtrer insights par sévérité
   */
  private filterBySeverity(insights: MetricsInsight[]): MetricsInsight[] {
    if (!this.config.minSeverity || this.config.minSeverity === 'low') {
      return insights;
    }

    const severityOrder = { low: 0, medium: 1, high: 2 };
    const minLevel = severityOrder[this.config.minSeverity];

    return insights.filter(insight => 
      severityOrder[insight.severity] >= minLevel
    );
  }

  /**
   * Générer meta-ADRs à partir des insights
   */
  private async generateMetaADRs(insights: MetricsInsight[]): Promise<MetaADR[]> {
    const metaADRs: MetaADR[] = [];

    for (const insight of insights) {
      try {
        const metaADR = createMetaADR(insight, 'proposed');
        metaADRs.push(metaADR);
        logger.debug(`Generated meta-ADR: ${metaADR.title}`);
      } catch (error) {
        logger.error('Failed to generate meta-ADR from insight', error, { insight });
      }
    }

    // Trier par impact (high > medium > low)
    metaADRs.sort((a, b) => {
      const impactOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });

    return metaADRs;
  }

  /**
   * Sauvegarder les meta-ADRs
   */
  private async saveMetaADRs(metaADRs: MetaADR[]): Promise<string[]> {
    const outputPaths: string[] = [];

    // Créer le dossier de sortie
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // Sauvegarder chaque meta-ADR individuellement
    for (const metaADR of metaADRs) {
      const filename = `${Date.now()}-${metaADR.id}.json`;
      const filepath = join(this.config.outputDir, filename);

      try {
        await fs.writeFile(
          filepath,
          JSON.stringify(metaADR, null, 2),
          'utf-8'
        );
        outputPaths.push(filepath);
        logger.debug(`Saved meta-ADR to ${filepath}`);
      } catch (error) {
        logger.error(`Failed to save meta-ADR ${metaADR.id}`, error);
      }
    }

    // Sauvegarder aussi un index global
    const indexPath = join(this.config.outputDir, 'index.json');
    await fs.writeFile(
      indexPath,
      JSON.stringify({
        generated_at: new Date().toISOString(),
        total: metaADRs.length,
        meta_adrs: metaADRs.map(adr => ({
          id: adr.id,
          title: adr.title,
          impact: adr.impact,
          status: adr.status,
          metric: adr.context.metric,
        })),
      }, null, 2),
      'utf-8'
    );
    outputPaths.push(indexPath);

    logger.success(`Saved ${metaADRs.length} meta-ADRs to ${this.config.outputDir}`);
    return outputPaths;
  }

  /**
   * Créer un résumé des meta-ADRs par impact
   */
  private summarize(metaADRs: MetaADR[]): { high: number; medium: number; low: number } {
    const summary = { high: 0, medium: 0, low: 0 };

    for (const adr of metaADRs) {
      const impact = adr.impact as string;
      if (impact === 'critical' || impact === 'high') {
        summary.high++;
      } else if (impact === 'medium') {
        summary.medium++;
      } else {
        summary.low++;
      }
    }

    return summary;
  }

  /**
   * Afficher le résumé des meta-ADRs
   */
  private displaySummary(metaADRs: MetaADR[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('FEEDBACK ENGINE - META-ADRs GENERATED');
    console.log('='.repeat(60));
    console.log(`Total Meta-ADRs: ${metaADRs.length}`);

    const byImpact = this.summarize(metaADRs);
    console.log(`  - High/Critical: ${byImpact.high}`);
    console.log(`  - Medium:        ${byImpact.medium}`);
    console.log(`  - Low:           ${byImpact.low}`);

    console.log('\n--- Meta-ADRs (by priority) ---');
    for (const adr of metaADRs) {
      const impactSymbol = this.getImpactSymbol(adr.impact);
      console.log(`\n${impactSymbol} [${adr.impact.toUpperCase()}] ${adr.title}`);
      console.log(`  ID: ${adr.id}`);
      console.log(`  Metric: ${adr.context.metric}`);
      console.log(`  Observed: ${adr.context.observed_value.toFixed(3)} (threshold: ${adr.context.threshold.toFixed(3)})`);
      console.log(`  Repos: ${adr.context.repos_affected.join(', ')}`);
      console.log(`  Recommendation: ${adr.recommendation.substring(0, 80)}...`);
      console.log(`  Improvement: ${adr.estimated_improvement}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Obtenir le symbole pour l'impact
   */
  private getImpactSymbol(impact: MetaADR['impact']): string {
    const impactStr = impact as string;
    switch (impactStr) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Exporter tous les meta-ADRs au format markdown
   */
  async exportMarkdown(): Promise<string> {
    logger.info('Exporting meta-ADRs to Markdown');

    try {
      // Charger tous les meta-ADRs
      const files = await fs.readdir(this.config.outputDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');

      const metaADRs: MetaADR[] = [];
      for (const file of jsonFiles) {
        const content = await fs.readFile(join(this.config.outputDir, file), 'utf-8');
        metaADRs.push(JSON.parse(content) as MetaADR);
      }

      // Générer markdown
      let markdown = '# Meta-ADRs - RL4 Training Feedback\n\n';
      markdown += `Generated: ${new Date().toISOString()}\n\n`;
      markdown += `Total: ${metaADRs.length}\n\n`;
      markdown += '---\n\n';

      for (const adr of metaADRs) {
        markdown += formatMetaADR(adr) + '\n\n---\n\n';
      }

      // Sauvegarder
      const outputPath = join(this.config.outputDir, 'meta-adrs.md');
      await fs.writeFile(outputPath, markdown, 'utf-8');
      logger.success(`Exported meta-ADRs to ${outputPath}`);

      return outputPath;
    } catch (error) {
      logger.error('Failed to export markdown', error);
      throw error;
    }
  }
}

/**
 * CLI principal
 */
async function main() {
  const args = process.argv.slice(2);
  const exportMd = args.includes('--export-md');
  const minSeverity = args.includes('--high-only') ? 'high' : 
                      args.includes('--medium-only') ? 'medium' : 
                      'low';

  const config: FeedbackEngineConfig = {
    metricsPath: '.reasoning_rl4/metrics/stats.json',
    outputDir: '.reasoning_rl4/feedback/meta_adrs',
    minSeverity: minSeverity as 'low' | 'medium' | 'high',
  };

  logger.info('RL4 Feedback Engine starting...');
  logger.info(`Metrics: ${config.metricsPath}`);
  logger.info(`Output: ${config.outputDir}`);
  logger.info(`Min Severity: ${config.minSeverity}`);

  try {
    const engine = new FeedbackEngine(config);
    const result = await engine.generateFeedback();

    if (result.metaADRsGenerated === 0) {
      logger.info('No feedback generated - all metrics are within acceptable ranges');
    } else {
      logger.success(`Generated ${result.metaADRsGenerated} meta-ADRs`);
      
      if (exportMd) {
        await engine.exportMarkdown();
      }
    }

  } catch (error) {
    logger.error('Feedback Engine failed', error);
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

