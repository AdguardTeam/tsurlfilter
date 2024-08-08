import { Logger } from '@adguard/logger';

/**
 * Export logger implementation.
 */
export const logger = new Logger(console);

/**
 * Stringify object via JSON.stringify without specified keys.
 *
 * @param obj Object to stringify.
 * @param excludedKeys Keys to exclude.
 *
 * @returns Stringified object without excludedKeys (checking nested keys too).
 */
export const stringifyObjectWithoutKeys = (obj: any, excludedKeys: string[]): string => {
    return JSON.stringify(
        obj,
        (key, value) => (excludedKeys.includes(key) ? undefined : value),
        2,
    );
};
