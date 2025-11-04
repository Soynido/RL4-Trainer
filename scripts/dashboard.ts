#!/usr/bin/env node

/**
 * RL4-Trainer Dashboard
 * Analyse complète des métriques d'entraînement
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface TrainingSummary {
  totalRepos: number;
  successful: number;
  failed: number;
  results: Array<{
    repo: string;
    success: boolean;
    stats?: {
      events: number;
      patterns: number;
      correlations: number;
      forecasts: number;
      adrs: number;
      duration_ms: number;
    };
  }>;
  totalDuration_ms: number;
  startTime: string;
  endTime: string;
}

async function loadLatestSummary(): Promise<TrainingSummary> {
  const diagnosticsDir = '.reasoning_rl4/diagnostics';
  const files = await fs.readdir(diagnosticsDir);
  const summaryFiles = files
    .filter(f => f.startsWith('training-summary-'))
    .sort()
    .reverse();

  if (summaryFiles.length === 0) {
    throw new Error('No training summary found');
  }

  const latestFile = join(diagnosticsDir, summaryFiles[0]);
  const content = await fs.readFile(latestFile, 'utf-8');
  return JSON.parse(content);
}

async function main() {
  console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('   RL4-TRAINER DASHBOARD - ANALYSE COGNITIVE'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════\n'));

  try {
    const summary = await loadLatestSummary();

    // 📊 Métriques Globales
    console.log(chalk.yellow.bold('📊 MÉTRIQUES GLOBALES\n'));
    
    const duration = (summary.totalDuration_ms / 1000).toFixed(2);
    const avgDuration = (summary.totalDuration_ms / summary.successful / 1000).toFixed(2);
    
    console.log(`  Total Repos      : ${chalk.green(summary.totalRepos)}`);
    console.log(`  Successful       : ${chalk.green(summary.successful)} ✓`);
    console.log(`  Failed           : ${summary.failed > 0 ? chalk.red(summary.failed) : chalk.green(summary.failed)} ${summary.failed > 0 ? '✗' : '✓'}`);
    console.log(`  Durée totale     : ${chalk.cyan(duration + 's')} (${(parseFloat(duration) / 60).toFixed(1)}min)`);
    console.log(`  Vitesse moyenne  : ${chalk.cyan(avgDuration + 's/repo')}`);
    console.log(`  Start            : ${summary.startTime}`);
    console.log(`  End              : ${summary.endTime}`);

    // 🧠 Croissance des Patterns
    console.log(chalk.yellow.bold('\n\n🧠 QUALITÉ COGNITIVE\n'));

    const successfulRepos = summary.results.filter(r => r.success && r.stats);
    
    const totalPatterns = successfulRepos.reduce((sum, r) => sum + (r.stats?.patterns || 0), 0);
    const totalCorrelations = successfulRepos.reduce((sum, r) => sum + (r.stats?.correlations || 0), 0);
    const totalForecasts = successfulRepos.reduce((sum, r) => sum + (r.stats?.forecasts || 0), 0);
    const totalADRs = successfulRepos.reduce((sum, r) => sum + (r.stats?.adrs || 0), 0);
    const totalEvents = successfulRepos.reduce((sum, r) => sum + (r.stats?.events || 0), 0);

    const reposWithForecasts = successfulRepos.filter(r => (r.stats?.forecasts || 0) > 0).length;
    const reposWithADRs = successfulRepos.filter(r => (r.stats?.adrs || 0) > 0).length;

    const avgPatterns = Math.floor(totalPatterns / successfulRepos.length);
    const avgCorrelations = Math.floor(totalCorrelations / successfulRepos.length);
    const avgForecasts = (totalForecasts / successfulRepos.length).toFixed(2);

    console.log(`  Patterns totaux      : ${chalk.green(totalPatterns.toLocaleString())} (moy: ${avgPatterns}/repo)`);
    console.log(`  Corrélations totales : ${chalk.green(totalCorrelations.toLocaleString())} (moy: ${avgCorrelations}/repo)`);
    console.log(`  Forecasts générés    : ${chalk.green(totalForecasts)} (moy: ${avgForecasts}/repo)`);
    console.log(`  ADRs actionnables    : ${chalk.green(totalADRs)}`);
    console.log(`  Événements totaux    : ${chalk.cyan(totalEvents.toLocaleString())}`);

    // Ratios
    const patternDensity = (totalPatterns / totalEvents).toFixed(3);
    const correlationRate = (totalCorrelations / totalPatterns).toFixed(1);
    const forecastRate = ((reposWithForecasts / successfulRepos.length) * 100).toFixed(1);
    const adrRate = ((reposWithADRs / successfulRepos.length) * 100).toFixed(1);

    console.log(chalk.yellow.bold('\n\n📈 RATIOS & DENSITÉ\n'));
    console.log(`  Pattern Density      : ${chalk.cyan(patternDensity)} (patterns/événements)`);
    console.log(`  Correlation Rate     : ${chalk.cyan(correlationRate + ':1')} (correlations/pattern)`);
    console.log(`  Forecast Coverage    : ${chalk.cyan(forecastRate + '%')} des repos`);
    console.log(`  ADR Generation       : ${chalk.cyan(adrRate + '%')} des repos`);

    // 🏆 Top Performers
    console.log(chalk.yellow.bold('\n\n🏆 TOP 10 REPOS (par patterns)\n'));
    
    const topRepos = successfulRepos
      .sort((a, b) => (b.stats?.patterns || 0) - (a.stats?.patterns || 0))
      .slice(0, 10);

    topRepos.forEach((repo, index) => {
      const stats = repo.stats!;
      const repoName = repo.repo.substring(0, 50);
      console.log(`  ${index + 1}.`.padEnd(4) + 
        chalk.green(repoName.padEnd(52)) + 
        `${stats.patterns} patterns, ${stats.correlations} corr, ${stats.forecasts} forecasts, ${stats.adrs} ADRs`);
    });

    // ⚠️ Repos lents
    console.log(chalk.yellow.bold('\n\n⏱️  TOP 5 REPOS LES PLUS LENTS\n'));
    
    const slowRepos = successfulRepos
      .sort((a, b) => (b.stats?.duration_ms || 0) - (a.stats?.duration_ms || 0))
      .slice(0, 5);

    slowRepos.forEach((repo, index) => {
      const stats = repo.stats!;
      const duration = (stats.duration_ms / 1000).toFixed(1);
      const repoName = repo.repo.substring(0, 50);
      console.log(`  ${index + 1}.`.padEnd(4) + 
        chalk.yellow(repoName.padEnd(52)) + 
        `${duration}s (${stats.patterns} patterns)`);
    });

    // 💾 Stockage
    console.log(chalk.yellow.bold('\n\n💾 STOCKAGE\n'));
    
    const { execSync } = await import('child_process');
    const size = execSync('du -sh .reasoning_rl4/').toString().split('\t')[0];
    const ledgerSize = execSync('du -sh .reasoning_rl4/ledger/').toString().split('\t')[0];
    
    console.log(`  Total .reasoning_rl4  : ${chalk.cyan(size)}`);
    console.log(`  Ledger                : ${chalk.cyan(ledgerSize)}`);
    
    // Projections
    const reposProcessed = summary.successful;
    const projectionFactor = 1000 / reposProcessed;
    
    if (reposProcessed < 1000) {
      const projected1000 = parseFloat(size.replace('G', '')) * projectionFactor;
      console.log(`  Projection 1000 repos : ${chalk.magenta(`~${projected1000.toFixed(1)}G`)}`);
    }

    // ✅ Validation
    console.log(chalk.yellow.bold('\n\n✅ VALIDATION\n'));
    
    const successRate = ((summary.successful / summary.totalRepos) * 100).toFixed(1);
    const speedOK = parseFloat(avgDuration) < 2;
    const forecastsOK = parseFloat(forecastRate) > 90;
    
    console.log(`  Taux de succès  : ${parseFloat(successRate) === 100 ? chalk.green(successRate + '%') : chalk.yellow(successRate + '%')} ${parseFloat(successRate) === 100 ? '✓' : '⚠'}`);
    console.log(`  Vitesse moyenne : ${speedOK ? chalk.green(avgDuration + 's') : chalk.yellow(avgDuration + 's')} ${speedOK ? '✓' : '⚠'}`);
    console.log(`  Forecasts       : ${forecastsOK ? chalk.green(forecastRate + '%') : chalk.yellow(forecastRate + '%')} ${forecastsOK ? '✓' : '⚠'}`);
    console.log(`  Erreurs         : ${summary.failed === 0 ? chalk.green('0') : chalk.red(summary.failed)} ${summary.failed === 0 ? '✓' : '✗'}`);

    console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════════════\n'));

    // Résultat final
    if (summary.failed === 0 && speedOK && forecastsOK) {
      console.log(chalk.green.bold('🎉 ENTRAÎNEMENT RÉUSSI - TOUS LES CRITÈRES VALIDÉS !\n'));
      process.exit(0);
    } else {
      console.log(chalk.yellow.bold('⚠️  ENTRAÎNEMENT TERMINÉ AVEC AVERTISSEMENTS\n'));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('❌ Erreur lors de l\'analyse:'), error);
    process.exit(1);
  }
}

main();

