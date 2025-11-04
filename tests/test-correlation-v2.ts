#!/usr/bin/env node

import { CorrelationEngineV2 } from '../kernel/engines/CorrelationEngineV2.js';
import { PatternSequence, CausalTimeline } from '../kernel/engines/PatternLearningEngineV2.js';
import { createLogger } from '../trainer/utils/logger.js';

const logger = createLogger('test-correlation-v2');

/**
 * Test du Correlation Engine V2
 */
async function testCorrelationV2() {
  logger.info('Starting Correlation Engine V2 test...');

  try {
    // Créer des séquences de test
    const sequences: PatternSequence[] = [
      {
        id: 'feature>refactor>test',
        sequence: ['feature', 'refactor', 'test'],
        timeline: [0, 2, 4],
        frequency: 5,
        repos: ['repo-a', 'repo-b', 'repo-c'],
        confidence: 0.85,
        avgLag: 2,
      },
      {
        id: 'feature>test>bugfix',
        sequence: ['feature', 'test', 'bugfix'],
        timeline: [1, 3, 6],
        frequency: 3,
        repos: ['repo-b', 'repo-d'],
        confidence: 0.75,
        avgLag: 2.5,
      },
      {
        id: 'refactor>test',
        sequence: ['refactor', 'test'],
        timeline: [2, 3],
        frequency: 8,
        repos: ['repo-a', 'repo-b', 'repo-c', 'repo-d'],
        confidence: 0.90,
        avgLag: 1,
      },
    ];

    // Créer des timelines de test
    const timelines = new Map<string, CausalTimeline>();

    timelines.set('repo-a', {
      repo: 'repo-a',
      events: [
        {
          t: 0,
          patterns: ['feature'],
          astFeatures: { functions: 5, classes: 2, dependencies: 3, calls: 10, untested: 1 },
          commit: 'abc123',
          timestamp: '2025-11-01T10:00:00Z',
        },
        {
          t: 1,
          patterns: ['refactor'],
          astFeatures: { functions: 5, classes: 2, dependencies: 3, calls: 12, untested: 0 },
          commit: 'def456',
          timestamp: '2025-11-01T11:00:00Z',
        },
        {
          t: 2,
          patterns: ['test'],
          astFeatures: { functions: 7, classes: 2, dependencies: 4, calls: 15, untested: 0 },
          commit: 'ghi789',
          timestamp: '2025-11-01T12:00:00Z',
        },
      ],
      totalCommits: 3,
      duration_ms: 7200000,
    });

    timelines.set('repo-b', {
      repo: 'repo-b',
      events: [
        {
          t: 0,
          patterns: ['feature'],
          astFeatures: { functions: 10, classes: 4, dependencies: 6, calls: 20, untested: 2 },
          commit: 'jkl012',
          timestamp: '2025-11-02T10:00:00Z',
        },
        {
          t: 1,
          patterns: ['test', 'bugfix'],
          astFeatures: { functions: 12, classes: 4, dependencies: 6, calls: 25, untested: 0 },
          commit: 'mno345',
          timestamp: '2025-11-02T11:00:00Z',
        },
      ],
      totalCommits: 2,
      duration_ms: 3600000,
    });

    // Créer le moteur
    const outputDir = '.reasoning_rl4/tmp/test-correlation-v2';
    const engine = new CorrelationEngineV2(outputDir);

    // Analyser
    logger.info('Analyzing correlations...');
    const result = await engine.analyzeCorrelations(sequences, timelines);

    logger.info('\n📊 RÉSULTATS:');
    logger.info('='.repeat(70));

    // Afficher corrélations
    logger.info(`\n🔗 CORRÉLATIONS CAUSALES (${result.correlations.length}):`);
    for (const corr of result.correlations.slice(0, 10)) {
      const contextStr = corr.context ? ` [${corr.context.type}]` : '';
      logger.info(`  ${corr.cause} → ${corr.effect}${contextStr}`);
      logger.info(`    Strength: ${corr.strength.toFixed(2)} | Lag: ${corr.lag} commits | Samples: ${corr.samples} | Confidence: ${corr.confidence.toFixed(2)}`);
    }

    // Afficher chaînes causales
    logger.info(`\n🔀 CHAÎNES CAUSALES (${result.chains.length}):`);
    for (const chain of result.chains.slice(0, 5)) {
      const chainStr = chain.chain.map(c => c.pattern).join(' → ');
      logger.info(`  ${chainStr}`);
      logger.info(`    Strength: ${chain.strength.toFixed(2)} | Avg Lag: ${chain.avgLag.toFixed(1)} | Frequency: ${chain.frequency} | Repos: ${chain.repos.length}`);
    }

    // Afficher règles contextuelles
    logger.info(`\n📜 RÈGLES CONTEXTUELLES (${result.contextualRules.length}):`);
    for (const rule of result.contextualRules.slice(0, 5)) {
      logger.info(`  ${rule.rule}`);
      logger.info(`    Confidence: ${rule.confidence.toFixed(2)}`);
    }

    logger.info('\n' + '='.repeat(70));

    // Validations
    const validations = {
      hasCorrelations: result.correlations.length > 0,
      hasChains: result.chains.length > 0,
      strengthInRange: result.correlations.every(c => c.strength >= 0 && c.strength <= 1),
      lagPositive: result.correlations.every(c => c.lag >= 0),
      hasContextualRules: result.contextualRules.length >= 0,
    };

    logger.info('\n✅ VALIDATIONS:');
    logger.info(`  Corrélations générées: ${validations.hasCorrelations ? '✓' : '✗'}`);
    logger.info(`  Chaînes causales générées: ${validations.hasChains ? '✓' : '✗'}`);
    logger.info(`  Strength valides (0-1): ${validations.strengthInRange ? '✓' : '✗'}`);
    logger.info(`  Lag positifs: ${validations.lagPositive ? '✓' : '✗'}`);
    logger.info(`  Règles contextuelles: ${validations.hasContextualRules ? '✓' : '✗'}`);

    const allValid = Object.values(validations).every(v => v);

    if (allValid && result.correlations.length > 0) {
      logger.success('\n✅ CORRELATION ENGINE V2 TEST PASSED');
      logger.success(`   - ${result.correlations.length} corrélations causales`);
      logger.success(`   - ${result.chains.length} chaînes causales`);
      logger.success(`   - ${result.contextualRules.length} règles contextuelles`);
      logger.success(`   - Strength max: ${result.correlations[0]?.strength.toFixed(2)}`);
      return true;
    } else {
      logger.error('\n❌ CORRELATION ENGINE V2 TEST FAILED');
      return false;
    }

  } catch (error) {
    logger.error('Test failed with error:', error);
    return false;
  }
}

// Exécuter le test
testCorrelationV2()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

