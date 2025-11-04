#!/usr/bin/env node

import { ASTParserWorker } from '../trainer/workers/ASTParserWorker.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createLogger } from '../trainer/utils/logger.js';

const logger = createLogger('test-ast-enriched');

/**
 * Test des enrichissements comportementaux de l'ASTParserWorker
 */
async function testEnrichedAST() {
  logger.info('Starting enriched AST Parser test...');

  try {
    // Créer le worker
    const outputDir = '.reasoning_rl4/tmp/test-enriched';
    const astWorker = new ASTParserWorker(outputDir);

    // Chemins des fichiers de test (avec dépendances)
    const testFiles = [
      join(process.cwd(), 'tests/mocks/sample-repo/src/main.ts'),
      join(process.cwd(), 'tests/mocks/sample-repo/src/main.test.ts'),
      join(process.cwd(), 'tests/mocks/sample-repo/src/utils.ts'),
      join(process.cwd(), 'tests/mocks/sample-repo/src/utils.test.ts'),
    ];

    // Analyser le commit
    logger.info(`Analyzing ${testFiles.length} files with dependencies...`);
    const features = await astWorker.analyzeCommit('sample-repo', 'enriched-commit', testFiles);

    // Analyser les résultats
    logger.info(`\n📊 Extracted ${features.length} features (enriched):`);
    logger.info('='.repeat(80));

    // 1️⃣ Dépendances inter-fichiers
    const dependencies = features.filter(f => f.type === 'dependency');
    logger.info(`\n🔗 DÉPENDANCES INTER-FICHIERS (${dependencies.length}):`);
    for (const dep of dependencies) {
      const from = dep.context.from?.split('/').pop();
      logger.info(`  ${from} → ${dep.name}`);
    }

    // 2️⃣ Appels de fonction
    const calls = features.filter(f => f.type === 'call');
    logger.info(`\n📞 APPELS DE FONCTION (${calls.length}):`);
    
    // Grouper par fonction
    const callMap = new Map<string, number>();
    for (const call of calls) {
      callMap.set(call.name, (callMap.get(call.name) || 0) + 1);
    }
    
    for (const [funcName, count] of callMap) {
      const isAsync = calls.find(c => c.name === funcName)?.context.isAsync;
      const asyncTag = isAsync ? ' (async)' : '';
      logger.info(`  ${funcName}${asyncTag}: ${count} appel(s)`);
    }

    // 3️⃣ Cohérence de tests
    const functions = features.filter(f => f.type === 'function' && !f.context.hasTest);
    logger.info(`\n🧪 COHÉRENCE DE TESTS:`);
    
    const tested = functions.filter(f => f.context.isTested);
    const untested = functions.filter(f => !f.context.isTested);
    
    logger.info(`  ✅ Fonctions testées: ${tested.length}`);
    for (const f of tested) {
      logger.info(`     - ${f.name} (${f.file.split('/').pop()})`);
    }
    
    logger.info(`  ❌ Fonctions NON testées: ${untested.length}`);
    for (const f of untested) {
      logger.info(`     - ${f.name} (${f.file.split('/').pop()})`);
    }

    // Statistiques globales
    logger.info('\n' + '='.repeat(80));
    logger.info('📈 RÉSUMÉ:');
    logger.info(`  Fichiers analysés: ${testFiles.length}`);
    logger.info(`  Features totales: ${features.length}`);
    logger.info(`  Dépendances: ${dependencies.length}`);
    logger.info(`  Appels: ${calls.length}`);
    logger.info(`  Fonctions: ${functions.length}`);
    logger.info(`  Couverture tests: ${tested.length}/${functions.length} (${Math.round(tested.length / functions.length * 100)}%)`);
    logger.info('='.repeat(80));

    // Vérifier le fichier de sortie
    const outputFile = join(outputDir, 'ast_sample-repo_enriche.jsonl');
    const exists = await fs.access(outputFile).then(() => true).catch(() => false);
    
    if (exists) {
      logger.success(`\n✓ Output file created: ${outputFile}`);
    }

    // Validation
    if (dependencies.length > 0 && calls.length > 0) {
      logger.success('\n✅ ENRICHED AST Parser test PASSED');
      logger.success(`   - ${dependencies.length} dépendances inter-fichiers détectées`);
      logger.success(`   - ${calls.length} appels de fonction détectés`);
      logger.success(`   - ${tested.length} fonctions avec tests identifiées`);
      logger.success(`   - ${untested.length} fonctions sans tests identifiées`);
      return true;
    } else {
      logger.error('\n❌ ENRICHED AST Parser test FAILED: Enrichments not working');
      return false;
    }

  } catch (error) {
    logger.error('Test failed with error:', error);
    return false;
  }
}

// Exécuter le test
testEnrichedAST()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

