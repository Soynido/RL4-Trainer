import { createLogger } from '../../trainer/utils/logger.js';

const logger = createLogger('PatternLearningEngine');

/**
 * Type de pattern détectable
 */
export type PatternType = 'refactor' | 'bugfix' | 'feature' | 'test' | 'documentation' | 'performance' | 'security' | 'dependency' | 'other';

/**
 * Événement Git normalisé
 */
export interface GitEvent {
  type: 'commit';
  timestamp: string;
  author: string;
  hash: string;
  message: string;
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
    additions: number;
    deletions: number;
  }>;
  metadata: {
    repo: string;
    branch: string;
  };
}

/**
 * Pattern détecté
 */
export interface Pattern {
  type: PatternType;
  confidence: number;
  context: {
    event: GitEvent;
    files: string[];
    commit: string;
    message: string;
    indicators: string[];
  };
  timestamp: string;
}

/**
 * Engine de détection de patterns dans l'historique Git
 */
export class PatternLearningEngine {
  private patterns: Pattern[] = [];
  
  /**
   * Analyser une série d'événements et détecter les patterns
   */
  async detectPatterns(events: GitEvent[]): Promise<Pattern[]> {
    logger.info(`Analyzing ${events.length} events for patterns`);
    this.patterns = [];

    for (const event of events) {
      const detectedPatterns = this.analyzeEvent(event);
      this.patterns.push(...detectedPatterns);
    }

    logger.success(`Detected ${this.patterns.length} patterns`);
    return this.patterns;
  }

  /**
   * Analyser un événement unique
   */
  private analyzeEvent(event: GitEvent): Pattern[] {
    const patterns: Pattern[] = [];
    const message = event.message.toLowerCase();
    const files = event.files.map(f => f.path);

    // Détecter refactor
    const refactorConfidence = this.detectRefactor(message, files);
    if (refactorConfidence > 0.5) {
      patterns.push(this.createPattern('refactor', refactorConfidence, event, ['commit message', 'file patterns']));
    }

    // Détecter bugfix
    const bugfixConfidence = this.detectBugfix(message, files);
    if (bugfixConfidence > 0.5) {
      patterns.push(this.createPattern('bugfix', bugfixConfidence, event, ['commit message', 'keywords']));
    }

    // Détecter feature
    const featureConfidence = this.detectFeature(message, files, event);
    if (featureConfidence > 0.5) {
      patterns.push(this.createPattern('feature', featureConfidence, event, ['commit message', 'file additions']));
    }

    // Détecter test
    const testConfidence = this.detectTest(message, files);
    if (testConfidence > 0.5) {
      patterns.push(this.createPattern('test', testConfidence, event, ['file paths', 'test keywords']));
    }

    // Détecter documentation
    const docConfidence = this.detectDocumentation(message, files);
    if (docConfidence > 0.5) {
      patterns.push(this.createPattern('documentation', docConfidence, event, ['file extensions', 'keywords']));
    }

    // Détecter performance
    const perfConfidence = this.detectPerformance(message);
    if (perfConfidence > 0.5) {
      patterns.push(this.createPattern('performance', perfConfidence, event, ['commit message']));
    }

    // Détecter security
    const securityConfidence = this.detectSecurity(message);
    if (securityConfidence > 0.5) {
      patterns.push(this.createPattern('security', securityConfidence, event, ['commit message']));
    }

    // Détecter dependency
    const depConfidence = this.detectDependency(message, files);
    if (depConfidence > 0.5) {
      patterns.push(this.createPattern('dependency', depConfidence, event, ['files', 'message']));
    }

    // Si aucun pattern spécifique, marquer comme "other"
    if (patterns.length === 0) {
      patterns.push(this.createPattern('other', 0.3, event, ['default']));
    }

    return patterns;
  }

  /**
   * Détecter pattern refactor
   */
  private detectRefactor(message: string, _files: string[]): number {
    let confidence = 0;
    
    // Keywords dans le message
    const refactorKeywords = ['refactor', 'restructure', 'reorganize', 'cleanup', 'simplify', 'improve', 'optimize'];
    for (const keyword of refactorKeywords) {
      if (message.includes(keyword)) {
        confidence += 0.3;
        break;
      }
    }

    // Ratio modifications vs additions
    // Un refactor a souvent beaucoup de modifications et peu d'additions nettes
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Détecter pattern bugfix
   */
  private detectBugfix(message: string, _files: string[]): number {
    let confidence = 0;
    
    const bugKeywords = ['fix', 'bug', 'issue', 'error', 'crash', 'broken', 'repair', 'resolve', 'patch'];
    for (const keyword of bugKeywords) {
      if (message.includes(keyword)) {
        confidence += 0.4;
        break;
      }
    }

    // Pattern "fix #123" ou "closes #123"
    if (message.match(/(fix|close|resolve)s?\s*#\d+/i)) {
      confidence += 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Détecter pattern feature
   */
  private detectFeature(message: string, _files: string[], event: GitEvent): number {
    let confidence = 0;
    
    const featureKeywords = ['add', 'feature', 'implement', 'new', 'create', 'introduce'];
    for (const keyword of featureKeywords) {
      if (message.includes(keyword)) {
        confidence += 0.3;
        break;
      }
    }

    // Beaucoup de fichiers ajoutés suggère une feature
    const addedFiles = event.files.filter(f => f.status === 'added').length;
    if (addedFiles > 2) {
      confidence += 0.2;
    }

    // Beaucoup d'additions
    const totalAdditions = event.files.reduce((sum, f) => sum + f.additions, 0);
    if (totalAdditions > 100) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Détecter pattern test
   */
  private detectTest(message: string, _files: string[]): number {
    let confidence = 0;
    
    const testKeywords = ['test', 'spec', 'unit', 'integration', 'e2e'];
    for (const keyword of testKeywords) {
      if (message.includes(keyword)) {
        confidence += 0.3;
        break;
      }
    }

    // Fichiers de test
    const testPatterns = [/\.test\.(ts|js|tsx|jsx)$/, /\.spec\.(ts|js|tsx|jsx)$/, /__tests__\//, /\/test\//];
    for (const file of _files) {
      for (const pattern of testPatterns) {
        if (pattern.test(file)) {
          confidence += 0.4;
          break;
        }
      }
      if (confidence >= 0.7) break;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Détecter pattern documentation
   */
  private detectDocumentation(message: string, files: string[]): number {
    let confidence = 0;
    
    const docKeywords = ['doc', 'documentation', 'readme', 'comment', 'jsdoc'];
    for (const keyword of docKeywords) {
      if (message.includes(keyword)) {
        confidence += 0.3;
        break;
      }
    }

    // Fichiers de documentation
    const docExtensions = ['.md', '.rst', '.txt', '.adoc'];
    for (const file of files) {
      for (const ext of docExtensions) {
        if (file.endsWith(ext)) {
          confidence += 0.4;
          break;
        }
      }
      if (confidence >= 0.7) break;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Détecter pattern performance
   */
  private detectPerformance(message: string): number {
    const perfKeywords = ['performance', 'optimize', 'speed', 'faster', 'cache', 'efficiency', 'benchmark'];
    for (const keyword of perfKeywords) {
      if (message.includes(keyword)) {
        return 0.7;
      }
    }
    return 0;
  }

  /**
   * Détecter pattern security
   */
  private detectSecurity(message: string): number {
    const securityKeywords = ['security', 'vulnerability', 'exploit', 'cve', 'auth', 'authentication', 'authorization', 'xss', 'sql injection'];
    for (const keyword of securityKeywords) {
      if (message.includes(keyword)) {
        return 0.8;
      }
    }
    return 0;
  }

  /**
   * Détecter pattern dependency
   */
  private detectDependency(message: string, files: string[]): number {
    let confidence = 0;
    
    const depKeywords = ['dependency', 'dependencies', 'upgrade', 'update', 'bump', 'package'];
    for (const keyword of depKeywords) {
      if (message.includes(keyword)) {
        confidence += 0.3;
        break;
      }
    }

    // Fichiers de dépendances
    const depFiles = ['package.json', 'package-lock.json', 'yarn.lock', 'pom.xml', 'requirements.txt', 'Gemfile', 'go.mod'];
    for (const file of files) {
      if (depFiles.includes(file.split('/').pop() || '')) {
        confidence += 0.4;
        break;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Créer un objet Pattern
   */
  private createPattern(
    type: PatternType,
    confidence: number,
    event: GitEvent,
    indicators: string[]
  ): Pattern {
    return {
      type,
      confidence,
      context: {
        event,
        files: event.files.map(f => f.path),
        commit: event.hash,
        message: event.message,
        indicators,
      },
      timestamp: event.timestamp,
    };
  }

  /**
   * Obtenir tous les patterns détectés
   */
  getPatterns(): Pattern[] {
    return this.patterns;
  }

  /**
   * Statistiques sur les patterns détectés
   */
  getStats(): Record<PatternType, number> {
    const stats: Record<string, number> = {};
    for (const pattern of this.patterns) {
      stats[pattern.type] = (stats[pattern.type] || 0) + 1;
    }
    return stats as Record<PatternType, number>;
  }
}

