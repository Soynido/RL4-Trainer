#!/usr/bin/env node

/**
 * Auto Dump Manager
 * Gestion automatique de la rotation du ledger pour maintenir workspace ≤ 10 Go
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { createLogger } from './utils/logger.js';

const logger = createLogger('autoDumpManager');

const MAX_GB = 9.5; // Seuil de rotation (en Go)
const LEDGER_PATH = '.reasoning_rl4/ledger';
const CORPUS_PATH = 'datasets/corpus';
const ARCHIVE_PATH = '.reasoning_rl4/archives';

/**
 * Obtenir la taille d'un dossier en Go
 */
function getDirSizeGB(dir: string): number {
  try {
    const output = execSync(`du -sk ${dir}`).toString().split('\t')[0];
    return parseFloat(output) / 1_000_000; // Ko → Go
  } catch {
    return 0;
  }
}

/**
 * Dump et compression du ledger
 */
async function dumpLedger(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpFile = `${ARCHIVE_PATH}/ledger-dump-${timestamp}.jsonl`;

  // Créer le dossier archives
  await fs.mkdir(ARCHIVE_PATH, { recursive: true });

  logger.info('🧩 Compacting ledger...');
  
  try {
    // 1️⃣ Compacter tous les fichiers ledger en un seul
    execSync(
      `find ${LEDGER_PATH} -type f -name "*.jsonl" -print0 | sort -z | xargs -0 cat > ${dumpFile}`,
      { stdio: 'inherit' }
    );

    const dumpSizeMB = (await fs.stat(dumpFile)).size / (1024 * 1024);
    logger.info(`  → Dump créé: ${dumpSizeMB.toFixed(0)} MB`);

    // 2️⃣ Compression
    logger.info('📦 Compressing...');
    execSync(`gzip -9 ${dumpFile}`, { stdio: 'inherit' });

    const archiveSize = (await fs.stat(`${dumpFile}.gz`)).size / (1024 * 1024);
    logger.success(`  → Archive: ${archiveSize.toFixed(0)} MB (ratio: ${(dumpSizeMB / archiveSize).toFixed(1)}:1)`);

    // 3️⃣ Purge
    logger.info('🧹 Cleaning workspace...');
    execSync(`rm -rf ${LEDGER_PATH}/*`, { stdio: 'inherit' });
    execSync(`rm -rf ${CORPUS_PATH}/*`, { stdio: 'inherit' });

    // 4️⃣ Vérification
    const newSize = getDirSizeGB('.');
    logger.success(`✅ Dump done. Workspace = ${newSize.toFixed(2)} GB`);

  } catch (error) {
    logger.error('Dump failed', error);
    throw error;
  }
}

/**
 * Vérifier si un dump est nécessaire et l'exécuter
 */
export async function autoDumpIfNeeded(): Promise<boolean> {
  const sizeGB = getDirSizeGB('.');

  if (sizeGB < MAX_GB) {
    return false;
  }

  logger.warn(`⚠️  Workspace = ${sizeGB.toFixed(2)} GB → triggering dump...`);
  await dumpLedger();
  return true;
}

/**
 * CLI direct
 */
async function main() {
  console.log('🔍 Auto Dump Manager - Check workspace');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const dumped = await autoDumpIfNeeded();

  if (dumped) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Rotation terminée avec succès');
  } else {
    const currentSize = getDirSizeGB('.');
    console.log(`✅ Espace OK (${currentSize.toFixed(2)} GB / ${MAX_GB} GB max)`);
    console.log('');
    console.log('Détails:');
    console.log(`  • Ledger: ${getDirSizeGB(LEDGER_PATH).toFixed(2)} GB`);
    console.log(`  • Corpus: ${getDirSizeGB(CORPUS_PATH).toFixed(2)} GB`);
    console.log(`  • Archives: ${getDirSizeGB(ARCHIVE_PATH).toFixed(2)} GB`);
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

