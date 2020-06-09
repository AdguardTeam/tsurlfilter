import consola, { LogLevel } from 'consola';

/**
 * Logger implementation
 */
export const logger = consola.withDefaults({
    level: LogLevel.Warn,
    tag: 'AG-tsurlfilter',
});
