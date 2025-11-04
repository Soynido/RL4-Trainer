import { promises as fs } from 'fs';
import { createWriteStream, WriteStream } from 'fs';
import { dirname } from 'path';
import { createLogger } from '../../trainer/utils/logger.js';

const logger = createLogger('AppendOnlyWriter');

export interface AppendOnlyWriterConfig {
  filePath: string;
  bufferSize?: number;
  flushIntervalMs?: number;
  maxFileSizeMB?: number;
}

/**
 * Writer JSONL thread-safe avec buffer, auto-flush et rotation
 */
export class AppendOnlyWriter {
  private filePath: string;
  private buffer: string[] = [];
  private bufferSize: number;
  private flushIntervalMs: number;
  private maxFileSizeBytes: number;
  private flushTimer?: NodeJS.Timeout;
  private writeStream?: WriteStream;
  private isFlushing = false;
  private isClosing = false;

  constructor(config: AppendOnlyWriterConfig) {
    this.filePath = config.filePath;
    this.bufferSize = config.bufferSize || 10;
    this.flushIntervalMs = config.flushIntervalMs || 5000;
    this.maxFileSizeBytes = (config.maxFileSizeMB || 100) * 1024 * 1024;
    
    // Démarrer le timer de flush automatique
    this.startFlushTimer();
  }

  /**
   * Ajouter une ligne au buffer
   */
  async append(data: Record<string, unknown>): Promise<void> {
    if (this.isClosing) {
      throw new Error('Writer is closing, cannot append new data');
    }

    const jsonLine = JSON.stringify(data);
    this.buffer.push(jsonLine);

    // Flush automatique si buffer plein
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Écrire le buffer sur disque
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      // Vérifier si rotation nécessaire
      await this.checkAndRotate();

      // Créer le répertoire si nécessaire
      await fs.mkdir(dirname(this.filePath), { recursive: true });

      // Initialiser le stream si nécessaire
      if (!this.writeStream) {
        this.writeStream = createWriteStream(this.filePath, { flags: 'a' });
      }

      // Écrire toutes les lignes du buffer
      const lines = [...this.buffer];
      this.buffer = [];

      for (const line of lines) {
        await new Promise<void>((resolve, reject) => {
          this.writeStream!.write(line + '\n', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      logger.debug(`Flushed ${lines.length} lines to ${this.filePath}`);
    } catch (error) {
      logger.error('Failed to flush buffer', error);
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Vérifier la taille du fichier et effectuer rotation si nécessaire
   */
  private async checkAndRotate(): Promise<void> {
    try {
      const stats = await fs.stat(this.filePath);
      
      if (stats.size >= this.maxFileSizeBytes) {
        await this.rotate();
      }
    } catch (error: unknown) {
      // Fichier n'existe pas encore, pas de rotation nécessaire
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Effectuer rotation du fichier
   */
  private async rotate(): Promise<void> {
    logger.info(`Rotating file ${this.filePath} (size limit reached)`);

    // Fermer le stream actuel
    if (this.writeStream) {
      await new Promise<void>((resolve) => {
        this.writeStream!.end(() => resolve());
      });
      this.writeStream = undefined;
    }

    // Renommer le fichier actuel avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = this.filePath.replace(/\.jsonl$/, `.${timestamp}.jsonl`);
    
    await fs.rename(this.filePath, rotatedPath);
    logger.success(`Rotated to ${rotatedPath}`);
  }

  /**
   * Démarrer le timer de flush automatique
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        logger.error('Auto-flush failed', error);
      });
    }, this.flushIntervalMs);
  }

  /**
   * Arrêter le timer de flush
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Fermer le writer (flush final et cleanup)
   */
  async close(): Promise<void> {
    this.isClosing = true;
    this.stopFlushTimer();

    // Flush final
    if (this.buffer.length > 0) {
      await this.flush();
    }

    // Fermer le stream
    if (this.writeStream) {
      await new Promise<void>((resolve) => {
        this.writeStream!.end(() => resolve());
      });
      this.writeStream = undefined;
    }

    logger.info(`Writer closed: ${this.filePath}`);
  }
}

