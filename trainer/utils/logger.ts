import pino from 'pino';
import chalk from 'chalk';

// Créer le logger pino avec configuration
const pinoLogger = (pino as any)({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

const logger = pinoLogger;

/**
 * Logger wrapper avec méthodes stylisées
 */
export class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(msg: string): string {
    return this.context ? `[${this.context}] ${msg}` : msg;
  }

  /**
   * Log informationnel standard
   */
  info(msg: string, meta?: Record<string, unknown>): void {
    logger.info(meta || {}, this.formatMessage(msg));
  }

  /**
   * Log de succès (vert)
   */
  success(msg: string, meta?: Record<string, unknown>): void {
    const formatted = chalk.green(`✓ ${this.formatMessage(msg)}`);
    logger.info(meta || {}, formatted);
  }

  /**
   * Log d'avertissement (orange)
   */
  warn(msg: string, meta?: Record<string, unknown>): void {
    const formatted = chalk.yellow(`⚠ ${this.formatMessage(msg)}`);
    logger.warn(meta || {}, formatted);
  }

  /**
   * Log d'erreur (rouge)
   */
  error(msg: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const formatted = chalk.red(`✗ ${this.formatMessage(msg)}`);
    const errorMeta = error instanceof Error 
      ? { ...meta, error: error.message, stack: error.stack }
      : { ...meta, error };
    logger.error(errorMeta, formatted);
  }

  /**
   * Log de debug (gris)
   */
  debug(msg: string, meta?: Record<string, unknown>): void {
    const formatted = chalk.gray(`🔍 ${this.formatMessage(msg)}`);
    logger.debug(meta || {}, formatted);
  }

  /**
   * Log fatal (rouge vif)
   */
  fatal(msg: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const formatted = chalk.red.bold(`💥 ${this.formatMessage(msg)}`);
    const errorMeta = error instanceof Error 
      ? { ...meta, error: error.message, stack: error.stack }
      : { ...meta, error };
    logger.fatal(errorMeta, formatted);
  }

  /**
   * Créer un logger avec contexte
   */
  child(context: string): Logger {
    return new Logger(this.context ? `${this.context}:${context}` : context);
  }
}

// Export instance par défaut
export const defaultLogger = new Logger();

// Export fonction helper pour créer logger avec contexte
export function createLogger(context: string): Logger {
  return new Logger(context);
}

