#!/usr/bin/env node

/**
 * Compactage et digestion du ledger brut
 * Extrait seulement les meta-patterns et génère kernel/state.json
 */

import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { createHash } from 'crypto';

interface Cycle {
  cycleId: number;
  timestamp: string;
  phases: {
    patterns: { detected: any[]; count: number };
    correlations: { found: any[]; count: number };
    forecasts: { predictions: any[]; count: number };
    adrs: { generated: any[]; count: number };
  };
  metadata: {
    repo: string;
    duration_ms?: number;
  };
}

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
    metaADRs: Array<{
      id: string;
      priority: string;
      recommendation: string;
      impact: string;
    }>;
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

async function compactLedger() {
  console.log('🔍 Analyse du ledger...');

  const ledgerDir = '.reasoning_rl4/ledger';
  const kernelDir = '.reasoning_rl4/kernel';
  
  // Créer le dossier kernel s'il n'existe pas
  await fs.mkdir(kernelDir, { recursive: true });

  // Lire tous les fichiers ledger
  const files = await fs.readdir(ledgerDir);
  const ledgerFiles = files.filter(f => f.endsWith('.jsonl'));

  console.log(`  → ${ledgerFiles.length} fichiers ledger trouvés`);

  let totalCycles = 0;
  const repoSet = new Set<string>();
  const patternTypes = new Map<string, number>();
  const adrsList: any[] = [];
  
  let totalPatterns = 0;
  let totalCorrelations = 0;
  let totalForecasts = 0;
  let totalADRs = 0;

  // Parser tous les cycles
  for (const file of ledgerFiles) {
    const filePath = join(ledgerDir, file);
    const fileStream = createReadStream(filePath);
    const rl = createInterface({ input: fileStream });

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const cycle: Cycle = JSON.parse(line);
        totalCycles++;

        if (cycle.metadata?.repo) {
          repoSet.add(cycle.metadata.repo);
        }

        // Consolider les patterns
        totalPatterns += cycle.phases.patterns.count || 0;
        totalCorrelations += cycle.phases.correlations.count || 0;
        totalForecasts += cycle.phases.forecasts.count || 0;
        totalADRs += cycle.phases.adrs.count || 0;

        // Compter les types de patterns
        for (const pattern of cycle.phases.patterns.detected || []) {
          const type = pattern.type || 'unknown';
          patternTypes.set(type, (patternTypes.get(type) || 0) + 1);
        }

        // Collecter les ADRs
        for (const adr of cycle.phases.adrs.generated || []) {
          adrsList.push({
            id: adr.id,
            priority: adr.priority,
            recommendation: adr.recommendation,
            impact: adr.estimatedImprovement,
            repo: cycle.metadata.repo,
          });
        }
      } catch (error) {
        // Skip invalid lines
      }
    }
  }

  console.log(`  → ${totalCycles} cycles analysés`);
  console.log(`  → ${repoSet.size} repos distincts`);
  console.log(`  → ${totalPatterns} patterns détectés`);

  // Construire les meta-patterns consolidés
  const consolidatedPatterns = Array.from(patternTypes.entries())
    .map(([type, frequency]) => ({
      type,
      confidence: frequency / totalCycles,
      frequency,
      repos: Array.from(repoSet).slice(0, 10), // Top 10 repos
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 50); // Top 50 patterns

  // Prioriser les ADRs
  const topADRs = adrsList
    .filter(adr => adr.priority === 'high' || adr.priority === 'critical')
    .slice(0, 20);

  // Construire le state du kernel
  const kernelState: KernelState = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    batches: 1,
    totalRepos: repoSet.size,
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
      avgPatternsPerRepo: totalPatterns / repoSet.size,
      avgCorrelationsPerPattern: totalPatterns > 0 ? totalCorrelations / totalPatterns : 0,
    },
    merkleRoot: createHash('sha256')
      .update(JSON.stringify(consolidatedPatterns))
      .digest('hex'),
  };

  // Sauvegarder le state
  const statePath = join(kernelDir, 'state.json');
  await fs.writeFile(statePath, JSON.stringify(kernelState, null, 2), 'utf-8');

  console.log('');
  console.log('✅ Kernel state sauvegardé');
  console.log(`  → ${statePath}`);
  console.log(`  → Taille: ${(JSON.stringify(kernelState).length / 1024).toFixed(0)} KB`);
  console.log('');
  console.log('📊 Résumé:');
  console.log(`  • ${consolidatedPatterns.length} meta-patterns`);
  console.log(`  • ${topADRs.length} ADRs prioritaires`);
  console.log(`  • ${repoSet.size} repos consolidés`);
  console.log(`  • Ratio compression: ${((totalCycles * 100) / consolidatedPatterns.length).toFixed(0)}:1`);
}

compactLedger().catch(console.error);

