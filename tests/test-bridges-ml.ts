#!/usr/bin/env npx tsx
/**
 * Test des Bridges ML - Phase 3
 * 
 * Valide le fonctionnement des 5 bridges ML avec des données de test.
 */

import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

interface BridgeTest {
  name: string;
  bridgePath: string;
  inputData: any;
  expectedKeys: string[];
}

const tests: BridgeTest[] = [
  {
    name: 'PAMI Bridge',
    bridgePath: 'bridges/pami_bridge.py',
    inputData: {
      repo: 'test-repo',
      timeline: [
        { t: 0, patterns: ['feature'], commit: 'abc123' },
        { t: 1, patterns: ['refactor'], commit: 'def456' },
        { t: 2, patterns: ['test'], commit: 'ghi789' },
        { t: 3, patterns: ['feature', 'refactor'], commit: 'jkl012' },
        { t: 4, patterns: ['test'], commit: 'mno345' }
      ],
      config: { min_support: 0.3, min_confidence: 0.5 }
    },
    expectedKeys: ['success', 'data', 'metadata']
  },
  {
    name: 'Merlion Bridge',
    bridgePath: 'bridges/merlion_bridge.py',
    inputData: {
      repo: 'test-repo',
      correlations: [
        { cause: 'feature', effect: 'test', strength: 0.6, lag: 2 },
        { cause: 'refactor', effect: 'test', strength: 0.7, lag: 1 }
      ],
      timeline: {
        repo: 'test-repo',
        events: [
          { t: 0, patterns: ['feature'], commit: 'abc' },
          { t: 1, patterns: ['refactor'], commit: 'def' },
          { t: 2, patterns: ['test'], commit: 'ghi' }
        ]
      },
      config: { causal_threshold: 0.5, anomaly_detection: true }
    },
    expectedKeys: ['success', 'data', 'metadata']
  },
  {
    name: 'HyperTS Bridge',
    bridgePath: 'bridges/hyperts_bridge.py',
    inputData: {
      repo: 'test-repo',
      forecasts: [
        { predicted: 'test', confidence: 0.6, horizon: 3 },
        { predicted: 'bugfix', confidence: 0.5, horizon: 2 }
      ],
      timeline: {
        events: [
          { t: 0, patterns: ['feature'], commit: 'abc' },
          { t: 1, patterns: ['test'], commit: 'def' },
          { t: 2, patterns: ['bugfix'], commit: 'ghi' }
        ]
      },
      config: { forecast_horizon: 5, min_confidence: 0.4 }
    },
    expectedKeys: ['success', 'data', 'metadata']
  },
  {
    name: 'FP-Growth Bridge',
    bridgePath: 'bridges/fpgrowth_bridge.py',
    inputData: {
      repo: 'test-repo-large',
      timeline: Array.from({ length: 10 }, (_, i) => ({
        t: i,
        patterns: ['feature', 'refactor', 'test'][i % 3],
        commit: `commit${i}`
      })),
      config: { min_support: 0.3, min_confidence: 0.5 }
    },
    expectedKeys: ['success', 'data', 'metadata']
  }
];

async function testBridge(test: BridgeTest): Promise<boolean> {
  console.log(`\n${BLUE}Testing ${test.name}...${NC}`);
  
  try {
    // Vérifier que le bridge existe
    try {
      await fs.access(test.bridgePath);
    } catch {
      console.log(`${YELLOW}  ⚠ Bridge file not found: ${test.bridgePath}${NC}`);
      return false;
    }
    
    // Appeler le bridge
    const result = spawnSync('python3', [test.bridgePath], {
      input: JSON.stringify(test.inputData),
      encoding: 'utf-8',
      timeout: 10000, // 10s timeout pour tests
      maxBuffer: 10 * 1024 * 1024
    });
    
    // Vérifier les erreurs de spawn
    if (result.error) {
      console.log(`${RED}  ✗ Spawn error: ${result.error.message}${NC}`);
      return false;
    }
    
    // Vérifier le code de sortie
    if (result.status !== 0) {
      console.log(`${RED}  ✗ Exit code ${result.status}${NC}`);
      if (result.stderr) {
        console.log(`${RED}  stderr: ${result.stderr.slice(0, 200)}${NC}`);
      }
      return false;
    }
    
    // Parser la sortie JSON
    let output;
    try {
      output = JSON.parse(result.stdout);
    } catch (e) {
      console.log(`${RED}  ✗ Invalid JSON output${NC}`);
      console.log(`  stdout: ${result.stdout.slice(0, 200)}`);
      return false;
    }
    
    // Vérifier les clés attendues
    for (const key of test.expectedKeys) {
      if (!(key in output)) {
        console.log(`${RED}  ✗ Missing key: ${key}${NC}`);
        return false;
      }
    }
    
    // Vérifier le succès
    if (output.success !== true) {
      console.log(`${RED}  ✗ Bridge returned success=false${NC}`);
      if (output.error) {
        console.log(`  error: ${output.error}`);
      }
      return false;
    }
    
    // Afficher les résultats
    const duration = output.metadata?.duration_ms || 0;
    console.log(`${GREEN}  ✓ Bridge responded successfully (${duration}ms)${NC}`);
    
    if (test.name === 'PAMI Bridge' || test.name === 'FP-Growth Bridge') {
      const patternsFound = output.metadata?.patterns_found || 0;
      console.log(`    Patterns found: ${patternsFound}`);
    }
    
    if (test.name === 'Merlion Bridge') {
      const refined = output.data?.refined_correlations?.length || 0;
      const anomalies = output.data?.detected_anomalies?.length || 0;
      console.log(`    Refined correlations: ${refined}`);
      console.log(`    Anomalies detected: ${anomalies}`);
    }
    
    if (test.name === 'HyperTS Bridge') {
      const enriched = output.data?.enriched_forecasts?.length || 0;
      console.log(`    Enriched forecasts: ${enriched}`);
    }
    
    return true;
    
  } catch (error) {
    console.log(`${RED}  ✗ Unexpected error: ${error}${NC}`);
    return false;
  }
}

async function testBridgesVersionsFile(): Promise<boolean> {
  console.log(`\n${BLUE}Testing bridges_versions.json...${NC}`);
  
  try {
    const versionsPath = '.reasoning_rl4/meta/bridges_versions.json';
    const content = await fs.readFile(versionsPath, 'utf-8');
    const versions = JSON.parse(content);
    
    // Vérifier la structure
    if (!versions.bridges || !versions.meta) {
      console.log(`${RED}  ✗ Invalid structure${NC}`);
      return false;
    }
    
    // Vérifier les bridges
    const expectedBridges = ['pami', 'merlion', 'hyperts', 'fpgrowth', 'spmf'];
    for (const bridge of expectedBridges) {
      if (!versions.bridges[bridge]) {
        console.log(`${RED}  ✗ Missing bridge: ${bridge}${NC}`);
        return false;
      }
    }
    
    console.log(`${GREEN}  ✓ bridges_versions.json structure valid${NC}`);
    return true;
    
  } catch (error) {
    console.log(`${RED}  ✗ Error reading bridges_versions.json: ${error}${NC}`);
    return false;
  }
}

async function testExternalReposFile(): Promise<boolean> {
  console.log(`\n${BLUE}Testing external_repos.json...${NC}`);
  
  try {
    const reposPath = '.reasoning_rl4/meta/external_repos.json';
    const content = await fs.readFile(reposPath, 'utf-8');
    const repos = JSON.parse(content);
    
    // Vérifier qu'on a 5 repos
    if (!Array.isArray(repos) || repos.length !== 5) {
      console.log(`${RED}  ✗ Expected 5 repos, got ${repos.length}${NC}`);
      return false;
    }
    
    // Vérifier chaque repo
    const expectedRepos = ['PAMI', 'FP-Growth', 'Merlion', 'HyperTS', 'SPMF'];
    for (const expectedName of expectedRepos) {
      const repo = repos.find((r: any) => r.name === expectedName);
      if (!repo) {
        console.log(`${RED}  ✗ Missing repo: ${expectedName}${NC}`);
        return false;
      }
      
      if (!repo.url || !repo.license || !repo.layer) {
        console.log(`${RED}  ✗ Incomplete data for: ${expectedName}${NC}`);
        return false;
      }
    }
    
    console.log(`${GREEN}  ✓ external_repos.json valid (5 repos)${NC}`);
    return true;
    
  } catch (error) {
    console.log(`${RED}  ✗ Error reading external_repos.json: ${error}${NC}`);
    return false;
  }
}

async function main() {
  console.log(`${BLUE}========================================${NC}`);
  console.log(`${BLUE}ML Bridges Test Suite - Phase 3${NC}`);
  console.log(`${BLUE}========================================${NC}`);
  
  // Test metadata files
  const versionsOk = await testBridgesVersionsFile();
  const reposOk = await testExternalReposFile();
  
  // Test each bridge
  let passedCount = 0;
  let failedCount = 0;
  
  for (const test of tests) {
    const passed = await testBridge(test);
    if (passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  }
  
  // Summary
  console.log(`\n${BLUE}========================================${NC}`);
  console.log(`${BLUE}Test Summary${NC}`);
  console.log(`${BLUE}========================================${NC}`);
  console.log(`Metadata files: ${versionsOk && reposOk ? GREEN + '✓' : RED + '✗'}${NC}`);
  console.log(`Bridges passed: ${GREEN}${passedCount}${NC}`);
  console.log(`Bridges failed: ${failedCount > 0 ? RED : GREEN}${failedCount}${NC}`);
  
  const totalTests = tests.length + 2; // bridges + 2 metadata files
  const totalPassed = passedCount + (versionsOk ? 1 : 0) + (reposOk ? 1 : 0);
  
  console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed`);
  
  if (failedCount > 0) {
    console.log(`\n${YELLOW}Note: Some bridges may require Python dependencies.${NC}`);
    console.log(`${YELLOW}Run: bash scripts/bootstrap-ml-modules.sh${NC}`);
  }
  
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch(console.error);

