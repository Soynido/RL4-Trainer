#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join } from 'path';
import { createLogger } from '../trainer/utils/logger.js';
import { 
  DetailedMetrics, 
  MetricsReport, 
  MetricsThresholds, 
  MetricsInsight
} from './types.js';
import { CycleResult } from '../kernel/RL4KernelTrainer.js';

const logger = createLogger('MetricsEngine');

/**
 * Configuration du MetricsEngine
 */
export interface MetricsEngineConfig {
  ledgerPath: string;
  outputPath: string;
  thresholds?: MetricsThresholds;
}

/**
 * Engine de calcul et d'analyse des métriques
 */
export class MetricsEngine {
  private config: MetricsEngineConfig;
  private defaultThresholds: MetricsThresholds = {
    pattern_density_min: 0.3,
    correlation_rate_min: 0.5,
    forecast_accuracy_min: 0.4,
    cycle_time_max_ms: 3000,
    entropy_min: 1.5,
  };

  constructor(config: MetricsEngineConfig) {
    this.config = config;
  }

  /**
   * Calculer les métriques à partir du ledger
   */
  async computeMetrics(): Promise<MetricsReport> {
    logger.info('Computing metrics from ledger');

    try {
      // Charger les cycles du ledger
      const cycles = await this.loadLedger();
      logger.success(`Loaded ${cycles.length} cycles from ledger`);

      if (cycles.length === 0) {
        logger.warn('No cycles found in ledger');
        return this.createEmptyReport();
      }

      // Grouper par repo
      const byRepo = this.groupByRepo(cycles);
      
      // Calculer métriques globales
      const globalMetrics = this.calculateMetrics(cycles, 'global');
      
      // Calculer métriques par repo
      const repoMetrics: Record<string, DetailedMetrics> = {};
      for (const [repo, repoCycles] of Object.entries(byRepo)) {
        repoMetrics[repo] = this.calculateMetrics(repoCycles, repo);
      }

      // Créer le rapport
      const report: MetricsReport = {
        global: globalMetrics,
        by_repo: repoMetrics,
        generated_at: new Date().toISOString(),
        config: {
          max_repos: Object.keys(byRepo).length,
          concurrency: 0, // TODO: récupérer depuis config
        },
      };

      // Sauvegarder le rapport
      await this.saveReport(report);

      // Afficher résumé
      this.displayMetrics(report);

      return report;

    } catch (error) {
      logger.error('Failed to compute metrics', error);
      throw error;
    }
  }

  /**
   * Charger les cycles depuis le ledger JSONL
   */
  private async loadLedger(): Promise<CycleResult[]> {
    try {
      const content = await fs.readFile(this.config.ledgerPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      return lines.map(line => JSON.parse(line) as CycleResult);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn(`Ledger file not found: ${this.config.ledgerPath}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Grouper les cycles par repo
   */
  private groupByRepo(cycles: CycleResult[]): Record<string, CycleResult[]> {
    const grouped: Record<string, CycleResult[]> = {};
    
    for (const cycle of cycles) {
      const repo = cycle.metadata?.repo || 'unknown';
      if (!grouped[repo]) {
        grouped[repo] = [];
      }
      grouped[repo].push(cycle);
    }

    return grouped;
  }

  /**
   * Calculer toutes les métriques pour un ensemble de cycles
   */
  private calculateMetrics(cycles: CycleResult[], _context: string): DetailedMetrics {
    // Compteurs totaux
    const totalCycles = cycles.length;
    const totalEvents = cycles.reduce((sum, c) => sum + (c.metadata?.events_processed || 0), 0);
    const totalPatterns = cycles.reduce((sum, c) => sum + c.phases.patterns.count, 0);
    const totalCorrelations = cycles.reduce((sum, c) => sum + c.phases.correlations.count, 0);
    const totalForecasts = cycles.reduce((sum, c) => sum + c.phases.forecasts.count, 0);
    const totalAdrs = cycles.reduce((sum, c) => sum + c.phases.adrs.count, 0);
    const totalDuration = cycles.reduce((sum, c) => sum + (c.metadata?.duration_ms || 0), 0);

    // Calculs des métriques
    const pattern_density = totalEvents > 0 ? totalPatterns / totalEvents : 0;
    const correlation_rate = totalPatterns > 0 ? totalCorrelations / totalPatterns : 0;
    
    // Forecast accuracy: approximation (ratio forecasts confirmés)
    // Dans un vrai système, il faudrait tracker les forecasts confirmés
    const forecast_accuracy = totalForecasts > 0 ? Math.min(totalCorrelations / totalForecasts, 1.0) : 0;
    
    // ADR usefulness: approximation (ratio ADRs pertinents)
    // Dans un vrai système, il faudrait tracker les ADRs appliqués
    const adr_usefulness = totalAdrs > 0 ? Math.min(totalForecasts / totalAdrs, 1.0) * 0.6 : 0;
    
    // Cycle time moyen
    const cycle_time_ms = totalCycles > 0 ? totalDuration / totalCycles : 0;
    
    // Entropie (diversité des patterns)
    const entropy = this.calculateEntropy(cycles);

    return {
      pattern_density,
      correlation_rate,
      forecast_accuracy,
      adr_usefulness,
      cycle_time_ms,
      entropy,
      total_events: totalEvents,
      total_patterns: totalPatterns,
      total_correlations: totalCorrelations,
      total_forecasts: totalForecasts,
      total_adrs: totalAdrs,
      total_cycles: totalCycles,
    };
  }

  /**
   * Calculer l'entropie de Shannon pour la diversité des patterns
   */
  private calculateEntropy(cycles: CycleResult[]): number {
    // Compter les types de patterns
    const patternTypeCounts: Record<string, number> = {};
    let totalPatterns = 0;

    for (const cycle of cycles) {
      const patterns = cycle.phases.patterns.detected as Array<{ type: string }> | undefined;
      if (!patterns || !Array.isArray(patterns)) {
        continue;
      }
      for (const pattern of patterns) {
        const type = pattern.type || 'unknown';
        patternTypeCounts[type] = (patternTypeCounts[type] || 0) + 1;
        totalPatterns++;
      }
    }

    if (totalPatterns === 0) {
      return 0;
    }

    // Calculer entropie: H = -Σ(p_i * log2(p_i))
    let entropy = 0;
    for (const count of Object.values(patternTypeCounts)) {
      const probability = count / totalPatterns;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  /**
   * Analyser les métriques et détecter anomalies
   */
  async analyzeMetrics(report: MetricsReport): Promise<MetricsInsight[]> {
    logger.info('Analyzing metrics for insights');

    const insights: MetricsInsight[] = [];
    const thresholds = this.config.thresholds || this.defaultThresholds;

    // Analyser métriques globales
    insights.push(...this.detectAnomalies(report.global, thresholds, ['global']));

    // Analyser métriques par repo
    for (const [repo, metrics] of Object.entries(report.by_repo)) {
      insights.push(...this.detectAnomalies(metrics, thresholds, [repo]));
    }

    logger.success(`Found ${insights.length} insights`);
    return insights;
  }

  /**
   * Détecter les anomalies dans les métriques
   */
  private detectAnomalies(
    metrics: DetailedMetrics,
    thresholds: MetricsThresholds,
    repos: string[]
  ): MetricsInsight[] {
    const insights: MetricsInsight[] = [];

    // Pattern density trop faible
    if (metrics.pattern_density < thresholds.pattern_density_min) {
      insights.push({
        metric_name: 'pattern_density',
        observed_value: metrics.pattern_density,
        threshold: thresholds.pattern_density_min,
        deviation: (metrics.pattern_density - thresholds.pattern_density_min) / thresholds.pattern_density_min,
        severity: metrics.pattern_density < thresholds.pattern_density_min * 0.5 ? 'high' : 'medium',
        repos_affected: repos,
        recommendation: 'Étendre les heuristiques de détection de patterns',
      });
    }

    // Correlation rate trop faible
    if (metrics.correlation_rate < thresholds.correlation_rate_min) {
      insights.push({
        metric_name: 'correlation_rate',
        observed_value: metrics.correlation_rate,
        threshold: thresholds.correlation_rate_min,
        deviation: (metrics.correlation_rate - thresholds.correlation_rate_min) / thresholds.correlation_rate_min,
        severity: metrics.correlation_rate < thresholds.correlation_rate_min * 0.6 ? 'high' : 'medium',
        repos_affected: repos,
        recommendation: 'Élargir les critères de corrélation et la fenêtre temporelle',
      });
    }

    // Forecast accuracy trop faible
    if (metrics.forecast_accuracy < thresholds.forecast_accuracy_min) {
      insights.push({
        metric_name: 'forecast_accuracy',
        observed_value: metrics.forecast_accuracy,
        threshold: thresholds.forecast_accuracy_min,
        deviation: (metrics.forecast_accuracy - thresholds.forecast_accuracy_min) / thresholds.forecast_accuracy_min,
        severity: metrics.forecast_accuracy < thresholds.forecast_accuracy_min * 0.7 ? 'high' : 'medium',
        repos_affected: repos,
        recommendation: 'Calibrer les modèles de prédiction et enrichir le contexte',
      });
    }

    // Cycle time trop élevé
    if (metrics.cycle_time_ms > thresholds.cycle_time_max_ms) {
      insights.push({
        metric_name: 'cycle_time_ms',
        observed_value: metrics.cycle_time_ms,
        threshold: thresholds.cycle_time_max_ms,
        deviation: (metrics.cycle_time_ms - thresholds.cycle_time_max_ms) / thresholds.cycle_time_max_ms,
        severity: metrics.cycle_time_ms > thresholds.cycle_time_max_ms * 1.5 ? 'high' : 'medium',
        repos_affected: repos,
        recommendation: 'Optimiser les algorithmes et implémenter du caching',
      });
    }

    // Entropy trop faible
    if (metrics.entropy < thresholds.entropy_min) {
      insights.push({
        metric_name: 'entropy',
        observed_value: metrics.entropy,
        threshold: thresholds.entropy_min,
        deviation: (metrics.entropy - thresholds.entropy_min) / thresholds.entropy_min,
        severity: metrics.entropy < thresholds.entropy_min * 0.5 ? 'medium' : 'low',
        repos_affected: repos,
        recommendation: 'Élargir les catégories de patterns détectés',
      });
    }

    return insights;
  }

  /**
   * Sauvegarder le rapport
   */
  private async saveReport(report: MetricsReport): Promise<void> {
    try {
      await fs.mkdir(join(this.config.outputPath, '..'), { recursive: true });
      await fs.writeFile(
        this.config.outputPath,
        JSON.stringify(report, null, 2),
        'utf-8'
      );
      logger.success(`Metrics report saved to ${this.config.outputPath}`);
    } catch (error) {
      logger.error('Failed to save metrics report', error);
      throw error;
    }
  }

  /**
   * Créer un rapport vide
   */
  private createEmptyReport(): MetricsReport {
    const emptyMetrics: DetailedMetrics = {
      pattern_density: 0,
      correlation_rate: 0,
      forecast_accuracy: 0,
      adr_usefulness: 0,
      cycle_time_ms: 0,
      entropy: 0,
      total_events: 0,
      total_patterns: 0,
      total_correlations: 0,
      total_forecasts: 0,
      total_adrs: 0,
      total_cycles: 0,
    };

    return {
      global: emptyMetrics,
      by_repo: {},
      generated_at: new Date().toISOString(),
      config: {
        max_repos: 0,
        concurrency: 0,
      },
    };
  }

  /**
   * Afficher les métriques dans la console
   */
  private displayMetrics(report: MetricsReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('METRICS REPORT');
    console.log('='.repeat(60));
    console.log('\n--- Global Metrics ---');
    this.displayMetricSet(report.global);

    if (Object.keys(report.by_repo).length > 0) {
      console.log('\n--- By Repository ---');
      for (const [repo, metrics] of Object.entries(report.by_repo)) {
        console.log(`\n${repo}:`);
        this.displayMetricSet(metrics, '  ');
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Afficher un ensemble de métriques
   */
  private displayMetricSet(metrics: DetailedMetrics, indent = ''): void {
    console.log(`${indent}Pattern Density:      ${metrics.pattern_density.toFixed(3)}`);
    console.log(`${indent}Correlation Rate:     ${metrics.correlation_rate.toFixed(3)}`);
    console.log(`${indent}Forecast Accuracy:    ${metrics.forecast_accuracy.toFixed(3)}`);
    console.log(`${indent}ADR Usefulness:       ${metrics.adr_usefulness.toFixed(3)}`);
    console.log(`${indent}Cycle Time:           ${metrics.cycle_time_ms.toFixed(0)}ms`);
    console.log(`${indent}Entropy:              ${metrics.entropy.toFixed(3)}`);
    console.log(`${indent}---`);
    console.log(`${indent}Total Events:         ${metrics.total_events}`);
    console.log(`${indent}Total Patterns:       ${metrics.total_patterns}`);
    console.log(`${indent}Total Correlations:   ${metrics.total_correlations}`);
    console.log(`${indent}Total Forecasts:      ${metrics.total_forecasts}`);
    console.log(`${indent}Total ADRs:           ${metrics.total_adrs}`);
    console.log(`${indent}Total Cycles:         ${metrics.total_cycles}`);
  }
}

/**
 * CLI principal
 */
async function main() {
  const args = process.argv.slice(2);
  const analyze = args.includes('--analyze');

  const config: MetricsEngineConfig = {
    ledgerPath: '.reasoning_rl4/ledger/cycles.jsonl',
    outputPath: '.reasoning_rl4/metrics/stats.json',
  };

  logger.info('RL4 Metrics Engine starting...');

  try {
    const engine = new MetricsEngine(config);
    const report = await engine.computeMetrics();

    if (analyze) {
      logger.info('Running analysis...');
      const insights = await engine.analyzeMetrics(report);
      
      if (insights.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('INSIGHTS & ANOMALIES');
        console.log('='.repeat(60));
        for (const insight of insights) {
          console.log(`\n[${insight.severity.toUpperCase()}] ${insight.metric_name}`);
          console.log(`  Observed: ${insight.observed_value.toFixed(3)}`);
          console.log(`  Threshold: ${insight.threshold.toFixed(3)}`);
          console.log(`  Deviation: ${(insight.deviation * 100).toFixed(1)}%`);
          console.log(`  Repos: ${insight.repos_affected.join(', ')}`);
          console.log(`  Recommendation: ${insight.recommendation}`);
        }
        console.log('\n' + '='.repeat(60) + '\n');
      } else {
        logger.success('No anomalies detected - all metrics within thresholds');
      }
    }

    logger.success('Metrics computation completed');
  } catch (error) {
    logger.error('Metrics Engine failed', error);
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

