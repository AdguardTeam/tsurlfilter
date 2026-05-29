/**
 * @file Utility functions for constructing and parsing rule set IDs and paths.
 */

/**
 * Prefix used for ruleset names and IDs.
 */
export const RULESET_NAME_PREFIX = 'ruleset_';

/**
 * Extension for ruleset files.
 */
export const RULESET_FILE_EXT = '.json';

/**
 * Path separator (forward slash, browser-safe).
 */
const PATH_SEPARATOR = '/';

/**
 * Regex that matches only numeric strings.
 */
const RE_NUMBER = /^\d+$/;

/**
 * Ensures a rule set ID has the `ruleset_` prefix.
 *
 * @param ruleSetId Rule set ID (number or string).
 *
 * @returns Rule set ID with the prefix.
 */
export function getRuleSetId(ruleSetId: string | number): string {
    let id = String(ruleSetId);

    if (!id.startsWith(RULESET_NAME_PREFIX)) {
        id = `${RULESET_NAME_PREFIX}${id}`;
    }

    return id;
}

/**
 * Returns the file path for a rule set.
 *
 * Uses forward slashes as path separator (browser-safe).
 *
 * @param ruleSetId Rule set ID (number or string).
 * @param baseDir Optional base directory.
 *
 * @returns Path to the rule set JSON file.
 */
export function getRuleSetPath(ruleSetId: string | number, baseDir?: string): string {
    const idWithPrefix = getRuleSetId(ruleSetId);
    const base = baseDir ? `${baseDir}${PATH_SEPARATOR}` : '';

    return `${base}${idWithPrefix}${PATH_SEPARATOR}${idWithPrefix}${RULESET_FILE_EXT}`;
}

/**
 * Extracts the numeric filter ID from a rule set ID or path.
 *
 * Accepted formats:
 * - `ruleset_<id>`
 * - `ruleset_<id>.json`
 * - `<path>/ruleset_<id>.json`.
 *
 * @param ruleSetId The rule set ID or path to parse.
 *
 * @returns The numeric filter ID, or `null` if it cannot be extracted.
 */
export function extractRuleSetId(ruleSetId: string): number | null {
    let id = ruleSetId;

    // Extract the last path segment if the string contains '/'
    const lastSlashIndex = id.lastIndexOf(PATH_SEPARATOR);
    if (lastSlashIndex !== -1) {
        id = id.slice(lastSlashIndex + PATH_SEPARATOR.length);
    }

    // Must start with the ruleset prefix
    if (!id.startsWith(RULESET_NAME_PREFIX)) {
        return null;
    }

    id = id.slice(RULESET_NAME_PREFIX.length);

    // Strip the .json extension if present
    if (id.endsWith(RULESET_FILE_EXT)) {
        id = id.slice(0, -RULESET_FILE_EXT.length);
    }

    // The remaining part must be a numeric string
    if (!RE_NUMBER.test(id)) {
        return null;
    }

    return parseInt(id, 10);
}
