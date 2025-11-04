import { promises as fs } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createLogger } from '../../trainer/utils/logger.js';
import { GitEvent, Pattern, PatternType } from './PatternLearningEngine.js';
import { ASTFeature } from '../../trainer/workers/ASTParserWorker.js';

const logger = createLogger('PatternLearningEngineV2');

/**
 * Séquence temporelle de patterns
 */
export interface PatternSequence {
  id: string;
  sequence: PatternType[];
  timeline: number[];  // Timestamps relatifs (en commits)
  frequency: number;
  repos: string[];
  confidence: number;
  avgLag: number;  // Délai moyen entre patterns
}

/**
 * Event enrichi avec features AST
 */
export interface EnrichedEvent extends GitEvent {
  astFeatures?: ASTFeature[];
  patterns?: Pattern[];
  sequencePosition?: number;  // Position dans la timeline globale
}

/**
 * Timeline causale d'un repo
 */
export interface CausalTimeline {
  repo: string;
  events: Array<{
    t: number;  // Position temporelle (index de commit)
    patterns: PatternType[];
    astFeatures: {
      functions: number;
      classes: number;
      dependencies: number;
      calls: number;
      untested: number;
    };
    commit: string;
    timestamp: string;
  }>;
  totalCommits: number;
  duration_ms: number;
}

/**
 * Pattern Learning Engine V2 - Analytical Layer
 * 
 * Transforme features AST + patterns Git en séquences comportementales récurrentes
 * avec timeline causale.
 * 
 * Architecture:
 * 1. Perceptual: Charger events + AST features
 * 2. Analytical: Extraire séquences temporelles
 * 3. Grouping: Grouper patterns similaires
 * 4. Scoring: Calculer confidence scores
 * 5. Output: patterns.jsonl + timeline.jsonl
 */
export class PatternLearningEngineV2 {
  private timelines: Map<string, CausalTimeline> = new Map();
  private outputDir: string;

  constructor(outputDir: string = '.reasoning_rl4') {
    this.outputDir = outputDir;
  }

  /**
   * Analyser un repo complet : events Git + AST features → sequences + timeline
   */
  async analyzeRepo(
    repoName: string,
    events: GitEvent[],
    patterns: Pattern[],
    astFeaturesPath?: string
  ): Promise<{
    sequences: PatternSequence[];
    timeline: CausalTimeline;
  }> {
    logger.info(`[${repoName}] Starting Pattern Learning V2 analysis`);
    logger.info(`  Events: ${events.length}, Patterns: ${patterns.length}`);

    // 1. Charger AST features si disponibles
    const astFeatures = astFeaturesPath 
      ? await this.loadASTFeatures(astFeaturesPath)
      : [];
    
    logger.info(`  AST Features: ${astFeatures.length}`);

    // 2. Enrichir les events avec patterns et AST
    const enrichedEvents = this.enrichEvents(events, patterns, astFeatures);

    // 3. Construire la timeline causale
    const timeline = this.buildCausalTimeline(repoName, enrichedEvents);
    this.timelines.set(repoName, timeline);

    // 4. Extraire séquences temporelles (méthode native)
    const nativeSequences = this.extractSequences(repoName, enrichedEvents);

    // 5. Appeler ML Bridge (PAMI ou FP-Growth) pour enrichissement
    const mlSequences = await this.callMLBridge(repoName, timeline, enrichedEvents.length);

    // 6. Fusionner patterns natifs et ML
    const sequences = this.mergeSequences(nativeSequences, mlSequences);

    // 7. Sauvegarder
    await this.saveResults(repoName, sequences, timeline);

    logger.success(`[${repoName}] Analysis complete: ${sequences.length} sequences (${nativeSequences.length} native + ${mlSequences.length} ML), ${timeline.events.length} timeline events`);

    return { sequences, timeline };
  }

  /**
   * Charger AST features depuis un fichier JSONL
   */
  private async loadASTFeatures(filePath: string): Promise<ASTFeature[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      logger.warn(`Failed to load AST features: ${error}`);
      return [];
    }
  }

  /**
   * Enrichir events avec patterns et AST features
   */
  private enrichEvents(
    events: GitEvent[],
    patterns: Pattern[],
    astFeatures: ASTFeature[]
  ): EnrichedEvent[] {
    const enriched: EnrichedEvent[] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // Trouver patterns pour cet event
      const eventPatterns = patterns.filter(p => p.context.commit === event.hash);
      
      // Trouver AST features pour ce commit
      const eventASTFeatures = astFeatures.filter(f => f.commit === event.hash);

      enriched.push({
        ...event,
        patterns: eventPatterns,
        astFeatures: eventASTFeatures,
        sequencePosition: i,
      });
    }

    return enriched;
  }

  /**
   * Construire timeline causale d'un repo
   */
  private buildCausalTimeline(
    repoName: string,
    events: EnrichedEvent[]
  ): CausalTimeline {
    const timelineEvents = events.map((event, index) => {
      // Agréger AST features
      const astFeatures = event.astFeatures || [];
      
      return {
        t: index,
        patterns: (event.patterns || []).map(p => p.type),
        astFeatures: {
          functions: astFeatures.filter(f => f.type === 'function').length,
          classes: astFeatures.filter(f => f.type === 'class').length,
          dependencies: astFeatures.filter(f => f.type === 'dependency').length,
          calls: astFeatures.filter(f => f.type === 'call').length,
          untested: astFeatures.filter(f => 
            f.type === 'function' && f.context.isTested === false
          ).length,
        },
        commit: event.hash,
        timestamp: event.timestamp,
      };
    });

    return {
      repo: repoName,
      events: timelineEvents,
      totalCommits: events.length,
      duration_ms: 0,  // Sera calculé si nécessaire
    };
  }

  /**
   * Appeler PAMI ou FP-Growth bridge selon la taille
   */
  private async callMLBridge(
    repoName: string,
    timeline: CausalTimeline,
    timelineCount: number
  ): Promise<PatternSequence[]> {
    // Switch automatique vers FP-Growth si >10k séquences
    const useFPGrowth = timelineCount > 10000;
    const bridgePath = useFPGrowth 
      ? 'bridges/fpgrowth_bridge.py'
      : 'bridges/pami_bridge.py';
    
    logger.info(`Using ${useFPGrowth ? 'FP-Growth' : 'PAMI'} bridge for ${timelineCount} sequences`);
    
    try {
      // Préparer input JSON
      const input = {
        repo: repoName,
        timeline: timeline.events,
        config: {
          min_support: 0.3,
          min_confidence: 0.5
        }
      };
      
      // Appeler le bridge Python avec timeout 300s
      const result = spawnSync('python3', [bridgePath], {
        input: JSON.stringify(input),
        encoding: 'utf-8',
        timeout: 300000, // 5min timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      // Vérifier erreurs
      if (result.error) {
        throw new Error(`Bridge spawn error: ${result.error.message}`);
      }
      
      if (result.status !== 0) {
        const errorMsg = result.stderr || 'Unknown error';
        throw new Error(`Bridge exit code ${result.status}: ${errorMsg}`);
      }
      
      // Parser résultat JSON
      const output = JSON.parse(result.stdout);
      
      if (!output.success) {
        throw new Error(output.error || 'Bridge returned success=false');
      }
      
      // Convertir les patterns ML en PatternSequence
      const mlPatterns: PatternSequence[] = output.data.map((p: any) => ({
        id: p.sequence.join('>'),
        sequence: p.sequence,
        timeline: [], // Sera rempli si nécessaire
        frequency: p.frequency || 1,
        repos: [repoName],
        confidence: p.confidence || 0,
        avgLag: 1.0
      }));
      
      logger.success(`ML Bridge returned ${mlPatterns.length} patterns (${output.metadata.duration_ms}ms)`);
      
      return mlPatterns;
      
    } catch (error) {
      // FALLBACK : Revenir sur méthode native
      logger.warn(`ML Bridge failed, falling back to native method: ${error}`);
      
      // Logger l'erreur dans le fichier de log du bridge
      await this.logBridgeError(bridgePath, error as Error);
      
      return []; // Retourner vide, la méthode native sera utilisée
    }
  }
  
  /**
   * Logger les erreurs de bridge pour debugging
   */
  private async logBridgeError(bridgePath: string, error: Error): Promise<void> {
    try {
      const bridgeName = path.basename(bridgePath, '.py');
      const logPath = `.reasoning_rl4/logs/bridges/${bridgeName}.log`;
      const timestamp = new Date().toISOString();
      const errorMsg = `[${timestamp}] [ERROR] Bridge fallback triggered: ${error.message}\n`;
      
      await fs.appendFile(logPath, errorMsg, 'utf-8').catch(() => {});
    } catch {
      // Ignore logging errors
    }
  }

  /**
   * Fusionner séquences natives et ML
   * 
   * Les patterns ML enrichissent les patterns natifs, mais ne les remplacent pas.
   * En cas de doublon (même sequence ID), on garde le pattern avec la meilleure confidence.
   */
  private mergeSequences(
    nativeSequences: PatternSequence[],
    mlSequences: PatternSequence[]
  ): PatternSequence[] {
    const merged = new Map<string, PatternSequence>();
    
    // Ajouter patterns natifs
    for (const seq of nativeSequences) {
      merged.set(seq.id, seq);
    }
    
    // Ajouter ou enrichir avec patterns ML
    for (const mlSeq of mlSequences) {
      const existing = merged.get(mlSeq.id);
      
      if (!existing) {
        // Nouveau pattern ML, l'ajouter
        merged.set(mlSeq.id, mlSeq);
      } else {
        // Pattern existant, prendre le meilleur confidence
        if (mlSeq.confidence > existing.confidence) {
          merged.set(mlSeq.id, {
            ...existing,
            confidence: mlSeq.confidence,
            frequency: Math.max(existing.frequency, mlSeq.frequency)
          });
        }
      }
    }
    
    // Convertir en array et trier par confidence
    const result = Array.from(merged.values());
    result.sort((a, b) => b.confidence - a.confidence);
    
    return result;
  }

  /**
   * Extraire séquences temporelles de patterns
   */
  private extractSequences(
    repoName: string,
    events: EnrichedEvent[]
  ): PatternSequence[] {
    const sequences: PatternSequence[] = [];
    const sequenceMap = new Map<string, {
      sequence: PatternType[];
      timeline: number[];
      repos: Set<string>;
    }>();

    // Fenêtre glissante pour capturer séquences
    const windowSize = 5;  // Regarder 5 commits à la fois

    for (let i = 0; i <= events.length - windowSize; i++) {
      const window = events.slice(i, i + windowSize);
      const patternSequence = window
        .map(e => e.patterns?.map(p => p.type) || [])
        .flat()
        .filter((p, idx, arr) => arr.indexOf(p) === idx);  // Unique

      if (patternSequence.length >= 2) {
        const timeline = window.map((_, idx) => i + idx);
        const key = patternSequence.join('>');

        if (!sequenceMap.has(key)) {
          sequenceMap.set(key, {
            sequence: patternSequence,
            timeline,
            repos: new Set([repoName]),
          });
        } else {
          const existing = sequenceMap.get(key)!;
          existing.repos.add(repoName);
        }
      }
    }

    // Convertir Map en array avec confidence scores
    for (const [key, data] of sequenceMap.entries()) {
      const avgLag = data.timeline.length > 1
        ? (data.timeline[data.timeline.length - 1] - data.timeline[0]) / (data.timeline.length - 1)
        : 0;

      const confidence = this.calculateSequenceConfidence(
        data.sequence.length,
        data.repos.size,
        avgLag
      );

      sequences.push({
        id: key,
        sequence: data.sequence,
        timeline: data.timeline,
        frequency: data.repos.size,
        repos: Array.from(data.repos),
        confidence,
        avgLag,
      });
    }

    // Trier par confidence décroissante
    sequences.sort((a, b) => b.confidence - a.confidence);

    return sequences;
  }

  /**
   * Calculer confidence score d'une séquence
   * 
   * Basé sur :
   * - Longueur de la séquence (plus long = plus confiant)
   * - Nombre de repos où elle apparaît (plus = plus universel)
   * - Lag moyen (plus régulier = plus confiant)
   */
  private calculateSequenceConfidence(
    length: number,
    repoCount: number,
    avgLag: number
  ): number {
    // Score de longueur (2-5 patterns) : 0.3-0.7
    const lengthScore = Math.min(0.7, 0.3 + (length - 2) * 0.1);

    // Score de récurrence : 0.2-0.8
    const recurrenceScore = Math.min(0.8, 0.2 + (repoCount - 1) * 0.1);

    // Score de régularité (lag faible = bon) : 0.5-1.0
    const regularityScore = avgLag > 0 ? Math.max(0.5, 1 - (avgLag / 10)) : 0.5;

    // Moyenne pondérée
    const confidence = (
      lengthScore * 0.3 +
      recurrenceScore * 0.4 +
      regularityScore * 0.3
    );

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Sauvegarder résultats dans .reasoning_rl4/
   */
  private async saveResults(
    repoName: string,
    sequences: PatternSequence[],
    timeline: CausalTimeline
  ): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      // Sauvegarder patterns
      const patternsPath = path.join(this.outputDir, 'patterns.jsonl');
      const patternsContent = sequences
        .map(s => JSON.stringify({ ...s, repo: repoName }))
        .join('\n') + '\n';
      
      await fs.appendFile(patternsPath, patternsContent, 'utf-8');
      logger.debug(`Patterns saved to ${patternsPath}`);

      // Sauvegarder timeline
      const timelinePath = path.join(this.outputDir, `timeline_${repoName}.json`);
      await fs.writeFile(timelinePath, JSON.stringify(timeline, null, 2), 'utf-8');
      logger.debug(`Timeline saved to ${timelinePath}`);

    } catch (error) {
      logger.error(`Failed to save results: ${error}`);
    }
  }

  /**
   * Agréger sequences de tous les repos
   */
  async consolidateSequences(): Promise<PatternSequence[]> {
    const sequenceMap = new Map<string, {
      sequence: PatternType[];
      frequency: number;
      repos: Set<string>;
      timelines: number[][];
    }>();

    // Charger toutes les sequences depuis patterns.jsonl
    try {
      const patternsPath = path.join(this.outputDir, 'patterns.jsonl');
      const content = await fs.readFile(patternsPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const seq: PatternSequence & { repo: string } = JSON.parse(line);
        const key = seq.id;

        if (!sequenceMap.has(key)) {
          sequenceMap.set(key, {
            sequence: seq.sequence,
            frequency: 1,
            repos: new Set([seq.repo]),
            timelines: [seq.timeline],
          });
        } else {
          const existing = sequenceMap.get(key)!;
          existing.frequency++;
          existing.repos.add(seq.repo);
          existing.timelines.push(seq.timeline);
        }
      }

      // Recalculer confidence globale
      const consolidated: PatternSequence[] = [];
      
      for (const [key, data] of sequenceMap.entries()) {
        const avgLag = data.timelines
          .map(t => t.length > 1 ? (t[t.length - 1] - t[0]) / (t.length - 1) : 0)
          .reduce((a, b) => a + b, 0) / data.timelines.length;

        const confidence = this.calculateSequenceConfidence(
          data.sequence.length,
          data.repos.size,
          avgLag
        );

        consolidated.push({
          id: key,
          sequence: data.sequence,
          timeline: data.timelines[0],  // Exemple de timeline
          frequency: data.frequency,
          repos: Array.from(data.repos),
          confidence,
          avgLag,
        });
      }

      // Trier par confidence
      consolidated.sort((a, b) => b.confidence - a.confidence);

      logger.success(`Consolidated ${consolidated.length} unique sequences from ${sequenceMap.size} patterns`);
      return consolidated;

    } catch (error) {
      logger.warn(`Failed to consolidate sequences: ${error}`);
      return [];
    }
  }

  /**
   * Récupérer toutes les timelines
   */
  getTimelines(): Map<string, CausalTimeline> {
    return this.timelines;
  }
}

