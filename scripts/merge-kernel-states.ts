#!/usr/bin/env node

/**
 * Fusion des kernel states de plusieurs batches
 * Produit un kernel state global consolidé
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

interface KernelState {
  version: string;
  generatedAt: string;
  batches: number;
  totalRepos: number;
  totalCycles: number;
  consolidated: {
    patterns: Array<{
      type: string;
      confidence: number;
      frequency: number;
      repos: string[];
    }>;
    metaADRs: Array<any>;
  };
  statistics: {
    totalPatterns: number;
    totalCorrelations: number;
    totalForecasts: number;
    totalADRs: number;
    avgPatternsPerRepo: number;
    avgCorrelationsPerPattern: number;
  };
  merkleRoot: string;
}

async function mergeKernelStates() {
  console.log('🔗 Fusion des kernel states...');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const substrateDir = 'archives/substrate';
  
  // Lister tous les fichiers state
  const files = await fs.readdir(substrateDir);
  const stateFiles = files
    .filter(f => f.startsWith('kernel_state_batch_') && f.endsWith('.json'))
    .sort();

  if (stateFiles.length === 0) {
    console.error('❌ Aucun kernel state trouvé dans', substrateDir);
    process.exit(1);
  }

  console.log(`📁 ${stateFiles.length} batches trouvés`);
  console.log('');

  // Charger tous les states
  const states: KernelState[] = [];
  for (const file of stateFiles) {
    const content = await fs.readFile(join(substrateDir, file), 'utf-8');
    states.push(JSON.parse(content));
  }

  // Fusionner
  const patternMap = new Map<string, { type: string; confidence: number; frequency: number; repos: Set<string> }>();
  const allADRs: any[] = [];
  
  let totalBatches = 0;
  let totalRepos = 0;
  let totalCycles = 0;
  let totalPatterns = 0;
  let totalCorrelations = 0;
  let totalForecasts = 0;
  let totalADRs = 0;

  for (const state of states) {
    totalBatches += state.batches;
    totalRepos += state.totalRepos;
    totalCycles += state.totalCycles;
    totalPatterns += state.statistics.totalPatterns;
    totalCorrelations += state.statistics.totalCorrelations;
    totalForecasts += state.statistics.totalForecasts;
    totalADRs += state.statistics.totalADRs;

    // Fusionner les patterns
    for (const pattern of state.consolidated.patterns) {
      if (patternMap.has(pattern.type)) {
        const existing = patternMap.get(pattern.type)!;
        existing.frequency += pattern.frequency;
        existing.confidence = (existing.confidence + pattern.confidence) / 2;
        pattern.repos.forEach(r => existing.repos.add(r));
      } else {
        patternMap.set(pattern.type, {
          type: pattern.type,
          confidence: pattern.confidence,
          frequency: pattern.frequency,
          repos: new Set(pattern.repos),
        });
      }
    }

    // Collecter les ADRs
    allADRs.push(...state.consolidated.metaADRs);
  }

  // Construire le state global
  const consolidatedPatterns = Array.from(patternMap.values())
    .map(p => ({
      type: p.type,
      confidence: p.confidence,
      frequency: p.frequency,
      repos: Array.from(p.repos).slice(0, 20),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 100); // Top 100 patterns globaux

  const topADRs = allADRs
    .filter(adr => adr.priority === 'high' || adr.priority === 'critical')
    .slice(0, 50);

  const globalState: KernelState = {
    version: '1.0.0-global',
    generatedAt: new Date().toISOString(),
    batches: totalBatches,
    totalRepos,
    totalCycles,
    consolidated: {
      patterns: consolidatedPatterns,
      metaADRs: topADRs,
    },
    statistics: {
      totalPatterns,
      totalCorrelations,
      totalForecasts,
      totalADRs,
      avgPatternsPerRepo: totalPatterns / totalRepos,
      avgCorrelationsPerPattern: totalPatterns > 0 ? totalCorrelations / totalPatterns : 0,
    },
    merkleRoot: createHash('sha256')
      .update(JSON.stringify(consolidatedPatterns))
      .digest('hex'),
  };

  // Sauvegarder
  const outputPath = '.reasoning_rl4/kernel/global_state.json';
  await fs.writeFile(outputPath, JSON.stringify(globalState, null, 2), 'utf-8');

  console.log('');
  console.log('✅ Kernel global généré');
  console.log(`  → ${outputPath}`);
  console.log(`  → Taille: ${(JSON.stringify(globalState).length / 1024).toFixed(0)} KB`);
  console.log('');
  console.log('📊 État global:');
  console.log(`  • Batches fusionnés: ${totalBatches}`);
  console.log(`  • Repos totaux: ${totalRepos}`);
  console.log(`  • Cycles totaux: ${totalCycles}`);
  console.log(`  • Meta-patterns: ${consolidatedPatterns.length}`);
  console.log(`  • ADRs prioritaires: ${topADRs.length}`);
  console.log('');
  console.log(`📈 Statistiques:`);
  console.log(`  • Patterns: ${totalPatterns.toLocaleString()}`);
  console.log(`  • Corrélations: ${totalCorrelations.toLocaleString()}`);
  console.log(`  • Forecasts: ${totalForecasts}`);
  console.log(`  • ADRs: ${totalADRs}`);
  console.log('');
  console.log(`🎯 Compression: ${(totalCycles / consolidatedPatterns.length).toFixed(0)}:1`);
  console.log('═══════════════════════════════════════════════════════════');
}

mergeKernelStates().catch(console.error);

