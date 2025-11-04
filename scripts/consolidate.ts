#!/usr/bin/env node

import { CognitiveKernel } from '../kernel/CognitiveKernel.js';
import { createLogger } from '../trainer/utils/logger.js';

const logger = createLogger('consolidate');

/**
 * Script de consolidation du Cognitive Kernel
 * 
 * Consolidation automatique après chaque batch :
 * - Charge tous les patterns/correlations/forecasts
 * - Calcule coherence_score
 * - Calcule forecast_precision
 * - Extrait universal_rules
 * - Sauvegarde cognitive_state.json
 */
async function consolidateKernel() {
  logger.info('Starting kernel consolidation...');

  try {
    const kernel = new CognitiveKernel('.reasoning_rl4');
    
    // Charger état existant si disponible
    await kernel.load().catch(() => {
      logger.info('No existing state, creating new kernel');
    });

    // Consolider
    const state = await kernel.consolidate();

    // Afficher résultats
    console.log('\n' + '='.repeat(60));
    console.log('🧠 COGNITIVE KERNEL CONSOLIDATED');
    console.log('='.repeat(60));
    console.log(`Coherence Score:        ${state.coherence_score.toFixed(4)} ${state.coherence_score > 0.9 ? '✅' : '⏳'}`);
    console.log(`Forecast Precision:     ${state.forecast_precision.toFixed(4)} ${state.forecast_precision > 0.75 ? '✅' : '⏳'}`);
    console.log(`Universal Rules:        ${state.universals} ${state.universals > 100 ? '✅' : '⏳'}`);
    console.log(`Correlation Strength:   ${state.avg_correlation_strength.toFixed(4)}`);
    console.log(`Reasoning Depth:        ${state.reasoning_depth}`);
    console.log('');
    console.log('Metrics:');
    console.log(`  Total Repos:          ${state.metrics.total_repos}`);
    console.log(`  Total Patterns:       ${state.metrics.total_patterns}`);
    console.log(`  Total Correlations:   ${state.metrics.total_correlations}`);
    console.log(`  Total Forecasts:      ${state.metrics.total_forecasts}`);
    console.log(`  Reasoning Entries:    ${state.metrics.total_reasoning_entries}`);
    console.log('='.repeat(60));

    // Vérifier si objectifs atteints
    if (kernel.isGoalReached()) {
      console.log('\n🎉 OBJECTIFS ATTEINTS !');
      console.log('   Coherence > 0.9 ✅');
      console.log('   Forecast Precision > 0.75 ✅');
      console.log('   Universals > 100 ✅');
      console.log('\n📦 Exporting kernel...');
      const exportPath = await kernel.export();
      console.log(`✅ Kernel exported to: ${exportPath}`);
    } else {
      console.log('\n⏳ Objectifs pas encore atteints. Entraînement doit continuer...');
      
      const remaining = [];
      if (state.coherence_score <= 0.9) {
        remaining.push(`Coherence: ${state.coherence_score.toFixed(2)} / 0.9`);
      }
      if (state.forecast_precision <= 0.75) {
        remaining.push(`Precision: ${state.forecast_precision.toFixed(2)} / 0.75`);
      }
      if (state.universals <= 100) {
        remaining.push(`Universals: ${state.universals} / 100`);
      }
      
      console.log('   Manquant:', remaining.join(', '));
    }

    console.log('');

  } catch (error) {
    logger.error('Consolidation failed', error);
    process.exit(1);
  }
}

// Exécuter
consolidateKernel()
  .then(() => {
    logger.success('Consolidation complete');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Fatal error', error);
    process.exit(1);
  });

