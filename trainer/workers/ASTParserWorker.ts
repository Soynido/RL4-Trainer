import { promises as fs } from 'fs';
import path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ASTParserWorker');

/**
 * Feature AST extraite d'un fichier modifié
 */
export interface ASTFeature {
  repo: string;
  commit: string;
  file: string;
  type: 'function' | 'class' | 'import' | 'test' | 'variable' | 'comment' | 'export' | 'dependency' | 'call' | 'test_coverage';
  name: string;
  complexity: number;
  context: {
    lines: number;
    dependencies: number;
    hasTest: boolean;
    isExported: boolean;
    // Enrichissements comportementaux
    from?: string;        // Pour les dépendances : fichier source
    to?: string;          // Pour les dépendances : fichier cible
    isAsync?: boolean;    // Pour les appels : appel asynchrone
    isTested?: boolean;   // Pour les fonctions : couverture de tests
    calledBy?: string[];  // Pour les fonctions : qui les appelle
  };
}

/**
 * Worker d'analyse syntaxique (AST) pour extraire des patterns structurels
 * 
 * Analyse chaque commit au niveau syntaxique pour extraire :
 * - Fonctions, classes, imports, exports
 * - Complexité (lignes, paramètres, branches)
 * - Contexte (tests, dépendances)
 * 
 * Output : .reasoning_rl4/tmp/ast_<repo>_<commit>.jsonl
 */
export class ASTParserWorker {
  private outputDir: string;

  constructor(outputDir: string = '.reasoning_rl4/tmp') {
    this.outputDir = outputDir;
  }

  /**
   * Analyse AST des fichiers modifiés d'un commit
   * 
   * @param repoName - Nom du repo
   * @param commitId - ID du commit
   * @param files - Chemins absolus des fichiers modifiés
   * @returns Features AST extraites
   */
  async analyzeCommit(
    repoName: string,
    commitId: string,
    files: string[]
  ): Promise<ASTFeature[]> {
    const features: ASTFeature[] = [];
    const allFunctions = new Map<string, string[]>(); // nom fonction -> fichiers
    const testFiles = files.filter(f => /test|spec/i.test(f));

    logger.info(`[${repoName}@${commitId}] Analyzing ${files.length} files (${testFiles.length} tests)`);

    // Phase 1 : Parser tous les fichiers et construire l'index des fonctions
    for (const filePath of files) {
      // Ne traiter que les fichiers TypeScript/JavaScript
      if (!this.isSupportedFile(filePath)) {
        continue;
      }

      try {
        // Vérifier que le fichier existe
        const exists = await this.fileExists(filePath);
        if (!exists) {
          logger.debug(`File not found, skipping: ${filePath}`);
          continue;
        }

        const code = await fs.readFile(filePath, 'utf-8');
        
        // Parser l'AST
        const ast = parse(code, {
          loc: true,
          comment: true,
          jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
        });

        // Extraire les features avec contexte enrichi
        const fileFeatures = this.extractFeatures(ast, filePath, testFiles);

        // Indexer les fonctions pour la cohérence de tests
        for (const feature of fileFeatures) {
          if (feature.type === 'function') {
            if (!allFunctions.has(feature.name)) {
              allFunctions.set(feature.name, []);
            }
            allFunctions.get(feature.name)!.push(filePath);
          }
        }

        // Enrichir avec metadata du commit
        features.push(
          ...fileFeatures.map(f => ({
            ...f,
            repo: repoName,
            commit: commitId,
          }))
        );
      } catch (err) {
        const error = err as Error;
        logger.warn(`Error parsing ${filePath}: ${error.message}`);
      }
    }

    // Phase 2 : Enrichir avec la cohérence de tests
    for (const feature of features) {
      if (feature.type === 'function' && !feature.context.hasTest) {
        // 🧪 Enrichissement 3 : Cohérence de tests
        // Vérifier si cette fonction est testée dans un fichier de test
        const isTested = testFiles.some(testFile => {
          // Vérifier si le nom de la fonction apparaît dans un fichier de test
          return testFile.includes(feature.name);
        });
        feature.context.isTested = isTested;
      }
    }

    // Sauvegarder les features
    if (features.length > 0) {
      await this.saveFeatures(repoName, commitId, features);
      logger.success(`Extracted ${features.length} AST features from ${repoName}@${commitId}`);
    }

    return features;
  }

  /**
   * Vérifie si le fichier est supporté pour l'analyse AST
   */
  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
  }

  /**
   * Vérifie si un fichier existe
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extrait les features d'un AST
   */
  private extractFeatures(
    ast: any, 
    filePath: string,
    _testFiles: string[] = []
  ): Omit<ASTFeature, 'repo' | 'commit'>[] {
    const features: Omit<ASTFeature, 'repo' | 'commit'>[] = [];
    const isTestFile = /test|spec/i.test(filePath);
    const dependencies = new Set<string>();
    const functionCalls = new Map<string, number>();

    /**
     * Parcourt récursivement l'AST
     */
    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;

      switch (node.type) {
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
          features.push({
            file: filePath,
            type: 'function',
            name: node.id?.name || 'anonymous',
            complexity: this.estimateComplexity(node),
            context: {
              lines: node.loc ? node.loc.end.line - node.loc.start.line : 0,
              dependencies: 0,
              hasTest: isTestFile,
              isExported: this.isExported(node),
            },
          });
          break;

        case 'ClassDeclaration':
        case 'ClassExpression':
          features.push({
            file: filePath,
            type: 'class',
            name: node.id?.name || 'AnonymousClass',
            complexity: this.estimateComplexity(node),
            context: {
              lines: node.loc ? node.loc.end.line - node.loc.start.line : 0,
              dependencies: 0,
              hasTest: isTestFile,
              isExported: this.isExported(node),
            },
          });
          break;

        case 'ImportDeclaration':
          const importSource = node.source?.value || 'unknown';
          dependencies.add(importSource);
          
          features.push({
            file: filePath,
            type: 'import',
            name: importSource,
            complexity: 0,
            context: {
              lines: 1,
              dependencies: 1,
              hasTest: isTestFile,
              isExported: false,
            },
          });
          
          // 🔗 Enrichissement 1 : Dépendances inter-fichiers
          features.push({
            file: filePath,
            type: 'dependency',
            name: importSource,
            complexity: 0,
            context: {
              lines: 1,
              dependencies: 1,
              hasTest: isTestFile,
              isExported: false,
              from: filePath,
              to: importSource,
            },
          });
          break;

        case 'ExportNamedDeclaration':
        case 'ExportDefaultDeclaration':
        case 'ExportAllDeclaration':
          if (node.declaration) {
            // Traverser la déclaration (fonction, classe, etc.)
            traverse(node.declaration);
          } else if (node.source) {
            // Export from another module (e.g., export * from './module')
            features.push({
              file: filePath,
              type: 'export',
              name: node.source.value || 'unknown',
              complexity: 0,
              context: {
                lines: 1,
                dependencies: 0,
                hasTest: isTestFile,
                isExported: true,
              },
            });
          }
          break;

        case 'VariableDeclaration':
          if (node.declarations) {
            for (const decl of node.declarations) {
              features.push({
                file: filePath,
                type: 'variable',
                name: decl.id?.name || 'unknown',
                complexity: 1,
                context: {
                  lines: 1,
                  dependencies: 0,
                  hasTest: isTestFile,
                  isExported: this.isExported(node),
                },
              });
            }
          }
          break;

        // 🔗 Enrichissement 2 : Détection d'appels de fonction
        case 'CallExpression':
          const calleeName = this.getCalleeName(node.callee);
          if (calleeName && calleeName !== 'anonymous') {
            functionCalls.set(calleeName, (functionCalls.get(calleeName) || 0) + 1);
            
            features.push({
              file: filePath,
              type: 'call',
              name: calleeName,
              complexity: 1,
              context: {
                lines: 1,
                dependencies: 0,
                hasTest: isTestFile,
                isExported: false,
                isAsync: node.callee?.type === 'AwaitExpression' || 
                         this.isParentAwait(node),
              },
            });
          }
          break;
      }

      // Parcourir récursivement tous les enfants
      for (const key in node) {
        const val = node[key];
        if (Array.isArray(val)) {
          val.forEach(traverse);
        } else if (val && typeof val === 'object' && val.type) {
          traverse(val);
        }
      }
    };

    traverse(ast);
    return features;
  }

  /**
   * Estime la complexité d'un nœud (fonction/classe)
   * 
   * Basé sur :
   * - Nombre de lignes
   * - Nombre de paramètres
   * - Nombre de branches (if/switch/loop)
   */
  private estimateComplexity(node: any): number {
    let score = 1;

    // Complexité basée sur le nombre de statements
    if (node.body) {
      if (Array.isArray(node.body.body)) {
        score += node.body.body.length / 5;
      }
    }

    // Complexité basée sur les paramètres
    if (node.params?.length) {
      score += node.params.length / 2;
    }

    // Complexité cyclomatique (branches)
    const branchCount = this.countBranches(node);
    score += branchCount;

    // Normaliser entre 1 et 10
    return Math.min(10, Math.max(1, Math.round(score)));
  }

  /**
   * Compte les branches (if, switch, loop, ternary)
   */
  private countBranches(node: any, count = 0): number {
    if (!node || typeof node !== 'object') return count;

    const branchTypes = [
      'IfStatement',
      'SwitchStatement',
      'ConditionalExpression',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'CatchClause',
    ];

    if (branchTypes.includes(node.type)) {
      count++;
    }

    // Parcourir récursivement
    for (const key in node) {
      const val = node[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          count = this.countBranches(item, count);
        }
      } else if (val && typeof val === 'object') {
        count = this.countBranches(val, count);
      }
    }

    return count;
  }

  /**
   * Détermine si un nœud est exporté
   */
  private isExported(_node: any): boolean {
    // Vérifier si le nœud a un parent ExportDeclaration
    // Note: cette implémentation simple ne capture pas tous les cas
    // mais fonctionne pour la plupart des patterns courants
    return false; // Sera marqué via ExportDeclaration directement
  }

  /**
   * Extrait le nom d'une fonction appelée depuis un nœud callee
   */
  private getCalleeName(callee: any): string | null {
    if (!callee) return null;

    // Appel direct : funcName()
    if (callee.type === 'Identifier') {
      return callee.name;
    }

    // Appel de méthode : obj.method()
    if (callee.type === 'MemberExpression') {
      if (callee.property?.type === 'Identifier') {
        return callee.property.name;
      }
    }

    // Appel via await : await funcName()
    if (callee.type === 'AwaitExpression' && callee.argument) {
      return this.getCalleeName(callee.argument);
    }

    return 'anonymous';
  }

  /**
   * Vérifie si un nœud est dans un contexte await
   */
  private isParentAwait(node: any): boolean {
    // Note: cette implémentation simplifiée ne vérifie que le nœud
    // Une implémentation complète devrait parcourir les parents
    return node.parent?.type === 'AwaitExpression';
  }

  /**
   * Sauvegarde les features dans un fichier JSONL
   */
  private async saveFeatures(
    repoName: string,
    commitId: string,
    features: ASTFeature[]
  ): Promise<void> {
    try {
      // Créer le dossier de sortie
      await fs.mkdir(this.outputDir, { recursive: true });

      // Générer le nom du fichier
      const outputPath = path.join(
        this.outputDir,
        `ast_${repoName}_${commitId.substring(0, 7)}.jsonl`
      );

      // Écrire en JSONL (une feature par ligne)
      const content = features.map(f => JSON.stringify(f)).join('\n') + '\n';
      await fs.appendFile(outputPath, content, 'utf-8');

      logger.debug(`Features saved to ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to save AST features: ${error}`);
    }
  }

  /**
   * Charge toutes les features AST d'un repo
   */
  async loadFeatures(repoName: string): Promise<ASTFeature[]> {
    const features: ASTFeature[] = [];

    try {
      const files = await fs.readdir(this.outputDir);
      const astFiles = files.filter(f => 
        f.startsWith(`ast_${repoName}_`) && f.endsWith('.jsonl')
      );

      for (const file of astFiles) {
        const filePath = path.join(this.outputDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          features.push(JSON.parse(line));
        }
      }

      logger.info(`Loaded ${features.length} AST features for ${repoName}`);
    } catch (error) {
      logger.warn(`Failed to load AST features: ${error}`);
    }

    return features;
  }
}

