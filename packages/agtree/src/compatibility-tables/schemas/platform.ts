/**
 * @file Platform schema for parsing platform strings.
 */

import zod from 'zod';

import { PlatformExpressionEvaluator } from '../platform-expression-evaluator';

/**
 * Parses a raw platform expression (potentially multiple platforms separated by |).
 * Supports multiple platforms in YAML keys (e.g., 'adg_os_any|adg_ext_any').
 * Supports negation (e.g., 'adg_any|~adg_cb_android' means all AdGuard except CB on Android).
 *
 * @param rawPlatforms Raw platform string, e.g. 'adg_safari_any|adg_os_any' or 'adg_any|~adg_cb_android'.
 *
 * @returns Platform expression string (validated, returned as-is for later expansion).
 *
 * @note Multiple platforms and negations in a key will be expanded during data loading.
 * @note Negated platforms will NOT have data inserted for them (they are exclusions).
 */
export const parseRawPlatforms = (rawPlatforms: string): string => {
    // Use PlatformExpressionEvaluator for validation
    // This centralizes all platform expression parsing logic
    try {
        PlatformExpressionEvaluator.evaluate(rawPlatforms);
    } catch (error) {
        throw new Error(`Invalid platform expression: ${rawPlatforms}`);
    }

    // Return the full expression for later expansion
    return rawPlatforms;
};

/**
 * Platform schema for Zod validation.
 * Parses and validates platform strings from YAML files.
 */
export const platformSchema = zod
    .string()
    .min(1)
    .transform((value) => parseRawPlatforms(value));
