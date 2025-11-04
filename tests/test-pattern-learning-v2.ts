#!/usr/bin/env node

import { PatternLearningEngineV2 } from '../kernel/engines/PatternLearningEngineV2.js';
import { GitEvent, Pattern } from '../kernel/engines/PatternLearningEngine.js';
import { createLogger } from '../trainer/utils/logger.js';
import { promises as fs } from 'fs';

const logger = createLogger('test-pattern-v2');

/**
 * Test du Pattern Learning Engine V2
 */
async function testPatternLearningV2() {
  logger.info('Starting Pattern Learning Engine V2 test...');

  try {
    // Créer des événements Git de test
    const events: GitEvent[] = [
      {
        type: 'commit',
        timestamp: '2025-11-01T10:00:00Z',
        author: 'dev1',
        hash: 'abc123',
        message: 'Add new feature',
        files: [
          { path: 'src/feature.ts', status: 'added', additions: 50, deletions: 0 }
        ],
        metadata: { repo: 'test-repo', branch: 'main' }
      },
      {
        type: 'commit',
        timestamp: '2025-11-01T11:00:00Z',
        author: 'dev1',
        hash: 'def456',
        message: 'Refactor code',
        files: [
          { path: 'src/feature.ts', status: 'modified', additions: 20, deletions: 30 }
        ],
        metadata: { repo: 'test-repo', branch: 'main' }
      },
      {
        type: 'commit',
        timestamp: '2025-11-01T12:00:00Z',
        author: 'dev2',
        hash: 'ghi789',
        message: 'Add tests for feature',
        files: [
          { path: 'tests/feature.test.ts', status: 'added', additions: 100, deletions: 0 }
        ],
        metadata: { repo: 'test-repo', branch: 'main' }
      },
      {
        type: 'commit',
        timestamp: '2025-11-01T13:00:00Z',
        author: 'dev1',
        hash: 'jkl012',
        message: 'Fix bug in feature',
        files: [
          { path: 'src/feature.ts', status: 'modified', additions: 5, deletions: 3 }
        ],
        metadata: { repo: 'test-repo', branch: 'main' }
      },
      {
        type: 'commit',
        timestamp: '2025-11-01T14:00:00Z',
        author: 'dev2',
        hash: 'mno345',
        message: 'Update documentation',
        files: [
          { path: 'README.md', status: 'modified', additions: 30, deletions: 5 }
        ],
        metadata: { repo: 'test-repo', branch: 'main' }
      }
    ];

    // Créer des patterns de test
    const patterns: Pattern[] = [
      {
        type: 'feature',
        confidence: 0.9,
        context: {
          event: events[0],
          files: ['src/feature.ts'],
          commit: 'abc123',
          message: 'Add new feature',
          indicators: ['add', 'feature']
        },
        timestamp: '2025-11-01T10:00:00Z'
      },
      {
        type: 'refactor',
        confidence: 0.85,
        context: {
          event: events[1],
          files: ['src/feature.ts'],
          commit: 'def456',
          message: 'Refactor code',
          indicators: ['refactor']
        },
        timestamp: '2025-11-01T11:00:00Z'
      },
      {
        type: 'test',
        confidence: 0.95,
        context: {
          event: events[2],
          files: ['tests/feature.test.ts'],
          commit: 'ghi789',
          message: 'Add tests for feature',
          indicators: ['test', 'tests']
        },
        timestamp: '2025-11-01T12:00:00Z'
      },
      {
        type: 'bugfix',
        confidence: 0.8,
        context: {
          event: events[3],
          files: ['src/feature.ts'],
          commit: 'jkl012',
          message: 'Fix bug in feature',
          indicators: ['fix', 'bug']
        },
        timestamp: '2025-11-01T13:00:00Z'
      },
      {
        type: 'documentation',
        confidence: 0.9,
        context: {
          event: events[4],
          files: ['README.md'],
          commit: 'mno345',
          message: 'Update documentation',
          indicators: ['documentation', 'readme']
        },
        timestamp: '2025-11-01T14:00:00Z'
      }
    ];

    // Créer le moteur
    const outputDir = '.reasoning_rl4/tmp/test-pattern-v2';
    const engine = new PatternLearningEngineV2(outputDir);

    // Analyser le repo
    logger.info('Analyzing test repo...');
    const result = await engine.analyzeRepo('test-repo', events, patterns);

    logger.info('\n📊 RÉSULTATS:');
    logger.info('='.repeat(70));

    // Afficher sequences
    logger.info(`\n🔗 SÉQUENCES DÉTECTÉES (${result.sequences.length}):`);
    for (const seq of result.sequences.slice(0, 10)) {
      logger.info(`  ${seq.sequence.join(' → ')}`);
      logger.info(`    Confidence: ${seq.confidence.toFixed(2)} | Frequency: ${seq.frequency} | Avg Lag: ${seq.avgLag.toFixed(1)}`);
    }

    // Afficher timeline
    logger.info(`\n📅 TIMELINE CAUSALE (${result.timeline.events.length} events):`);
    for (const event of result.timeline.events) {
      const patternsStr = event.patterns.length > 0 
        ? event.patterns.join(', ')
        : 'none';
      const astStr = `F:${event.astFeatures.functions} C:${event.astFeatures.classes} D:${event.astFeatures.dependencies}`;
      logger.info(`  t=${event.t}: [${patternsStr}] AST: ${astStr}`);
    }

    logger.info('\n' + '='.repeat(70));

    // Vérifications
    const validations = {
      hasSequences: result.sequences.length > 0,
      hasTimeline: result.timeline.events.length === events.length,
      hasPatterns: result.timeline.events.some(e => e.patterns.length > 0),
      confidenceInRange: result.sequences.every(s => s.confidence >= 0 && s.confidence <= 1)
    };

    logger.info('\n✅ VALIDATIONS:');
    logger.info(`  Sequences générées: ${validations.hasSequences ? '✓' : '✗'}`);
    logger.info(`  Timeline complète: ${validations.hasTimeline ? '✓' : '✗'}`);
    logger.info(`  Patterns détectés: ${validations.hasPatterns ? '✓' : '✗'}`);
    logger.info(`  Confidence valides: ${validations.confidenceInRange ? '✓' : '✗'}`);

    // Vérifier les fichiers créés
    const outputExists = await fs.access(outputDir)
      .then(() => true)
      .catch(() => false);

    if (outputExists) {
      const files = await fs.readdir(outputDir);
      logger.info(`\n📁 FICHIERS CRÉÉS (${files.length}):`);
      for (const file of files) {
        logger.info(`  - ${file}`);
      }
    }

    const allValid = Object.values(validations).every(v => v);

    if (allValid) {
      logger.success('\n✅ PATTERN LEARNING ENGINE V2 TEST PASSED');
      logger.success(`   - ${result.sequences.length} sequences extraites`);
      logger.success(`   - ${result.timeline.events.length} events dans la timeline`);
      logger.success(`   - Confidence scores: ${result.sequences[0]?.confidence.toFixed(2)} (max)`);
      return true;
    } else {
      logger.error('\n❌ PATTERN LEARNING ENGINE V2 TEST FAILED');
      return false;
    }

  } catch (error) {
    logger.error('Test failed with error:', error);
    return false;
  }
}

// Exécuter le test
testPatternLearningV2()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

