import { EMPTY_STRING, RE_NUMBER, RULESET_NAME_PREFIX } from '../../common/constants';

/**
 * Extension for ruleset file.
 */
export const RULESET_FILE_EXT = '.json';

/**
 * Path separator.
 */
const PATH_SEPARATOR = '/';

/**
 * Helper method to get the rule set ID with the {@link RULESET_NAME_PREFIX} prefix.
 *
 * @param ruleSetId Rule set id. Can be a number or a string.
 *
 * @returns Rule set ID with the {@link RULESET_NAME_PREFIX} prefix.
 */
export function getRuleSetId(ruleSetId: string | number): string {
    let ruleSetIdStr = String(ruleSetId);

    if (!ruleSetIdStr.startsWith(RULESET_NAME_PREFIX)) {
        ruleSetIdStr = `${RULESET_NAME_PREFIX}${ruleSetIdStr}`;
    }

    return ruleSetIdStr;
}

/**
 * Helper method to get the path to the rule set file.
 *
 * @param ruleSetId Rule set id. Can be a number or a string.
 * @param baseDir Base directory.
 *
 * @returns Path to the rule set file.
 *
 * @note This is just a path, not a URL. To get a URL, use `browser.runtime.getURL`.
 * @note Rule set ID automatically gets a {@link RULESET_NAME_PREFIX} prefix if it doesn't have it,
 * e.g. `123` -> `ruleset_123` or `foo` -> `ruleset_foo`.
 */
export function getRuleSetPath(ruleSetId: string | number, baseDir?: string): string {
    const ruleSetIdWithPrefix = getRuleSetId(ruleSetId);
    const resultPrefix = baseDir ? `${baseDir}${PATH_SEPARATOR}` : EMPTY_STRING;
    return `${resultPrefix}${ruleSetIdWithPrefix}${PATH_SEPARATOR}${ruleSetIdWithPrefix}${RULESET_FILE_EXT}`;
}

/**
 * Helper method to extract the rule set ID from the given string.
 *
 * This method processes a string that may represent a path or contain a prefix,
 * extracts the last part if it contains slashes, removes a defined prefix if present,
 * and validates whether the remaining part is a numeric string.
 *
 * @param ruleSetId - The rule set ID or path to process.
 * @returns The extracted rule set ID as a number, or `null` if the ID cannot be extracted.
 */
export function extractRuleSetId(ruleSetId: string): number | null {
    let ruleSetIdToParse = ruleSetId;

    // Extract the last part of the path if it contains '/'
    const lastSlashIndex = ruleSetIdToParse.lastIndexOf(PATH_SEPARATOR);
    if (lastSlashIndex !== -1) {
        ruleSetIdToParse = ruleSetIdToParse.slice(lastSlashIndex + PATH_SEPARATOR.length);
    }

    // Remove the prefix and file extension if present
    if (ruleSetIdToParse.startsWith(RULESET_NAME_PREFIX)) {
        ruleSetIdToParse = ruleSetIdToParse.slice(RULESET_NAME_PREFIX.length);

        if (ruleSetIdToParse.endsWith(RULESET_FILE_EXT)) {
            ruleSetIdToParse = ruleSetIdToParse.slice(0, -RULESET_FILE_EXT.length);
        }
    }

    // Validate and parse as a number
    if (!RE_NUMBER.test(ruleSetIdToParse)) {
        return null;
    }

    const possibleInt = parseInt(ruleSetIdToParse, 10);

    return Number.isNaN(possibleInt) ? null : possibleInt;
}
