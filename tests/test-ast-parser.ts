#!/usr/bin/env node

import { ASTParserWorker } from '../trainer/workers/ASTParserWorker.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createLogger } from '../trainer/utils/logger.js';

const logger = createLogger('test-ast-parser');

/**
 * Test du ASTParserWorker sur le repo de test
 */
async function testASTParser() {
  logger.info('Starting AST Parser test...');

  try {
    // Créer le worker
    const outputDir = '.reasoning_rl4/tmp/test';
    const astWorker = new ASTParserWorker(outputDir);

    // Chemins des fichiers de test
    const testFiles = [
      join(process.cwd(), 'tests/mocks/sample-repo/src/main.ts'),
      join(process.cwd(), 'tests/mocks/sample-repo/src/main.test.ts'),
    ];

    // Analyser le commit
    logger.info(`Analyzing ${testFiles.length} test files...`);
    const features = await astWorker.analyzeCommit('sample-repo', 'test-commit', testFiles);

    // Vérifier les résultats
    logger.info(`\nExtracted ${features.length} AST features:`);
    logger.info('='.repeat(60));

    for (const feature of features) {
      logger.info(`  Type: ${feature.type.padEnd(10)} | Name: ${feature.name.padEnd(20)} | Complexity: ${feature.complexity} | Lines: ${feature.context.lines}`);
    }

    logger.info('='.repeat(60));

    // Vérifications basiques
    const functionFeatures = features.filter(f => f.type === 'function');
    const importFeatures = features.filter(f => f.type === 'import');
    const exportFeatures = features.filter(f => f.type === 'export');

    logger.info(`\nSummary:`);
    logger.info(`  Functions: ${functionFeatures.length}`);
    logger.info(`  Imports: ${importFeatures.length}`);
    logger.info(`  Exports: ${exportFeatures.length}`);
    logger.info(`  Total: ${features.length}`);

    // Vérifier que le fichier JSONL a été créé
    const outputFile = join(outputDir, 'ast_sample-repo_test-co.jsonl');
    const exists = await fs.access(outputFile).then(() => true).catch(() => false);
    
    if (exists) {
      logger.success(`✓ Output file created: ${outputFile}`);
      
      // Afficher le contenu
      const content = await fs.readFile(outputFile, 'utf-8');
      logger.info(`\nFile content (${content.split('\n').filter(l => l.trim()).length} lines):`);
      logger.info('-'.repeat(60));
      console.log(content);
      logger.info('-'.repeat(60));
    } else {
      logger.error(`✗ Output file not found: ${outputFile}`);
    }

    // Tester la fonction loadFeatures
    logger.info('\nTesting loadFeatures...');
    const loadedFeatures = await astWorker.loadFeatures('sample-repo');
    logger.success(`✓ Loaded ${loadedFeatures.length} features from disk`);

    // Validation
    if (features.length > 0 && functionFeatures.length > 0) {
      logger.success('\n✅ AST Parser test PASSED');
      logger.success(`   - Extracted ${features.length} features`);
      logger.success(`   - Found ${functionFeatures.length} functions`);
      logger.success(`   - Output saved to ${outputDir}`);
      return true;
    } else {
      logger.error('\n❌ AST Parser test FAILED: No features extracted');
      return false;
    }

  } catch (error) {
    logger.error('Test failed with error:', error);
    return false;
  }
}

// Exécuter le test
testASTParser()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

