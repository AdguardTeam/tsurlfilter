/**
 * @file Platform schema for parsing platform strings.
 */

import zod from 'zod';

import { PLATFORM_SEPARATOR, PlatformExpressionEvaluator } from '../platform-expression-evaluator';

/**
 * Parses a raw platform expression (potentially multiple platforms separated by |).
 * Supports multiple platforms in YAML keys (e.g., 'adg_os_any|adg_ext_any').
 * Supports negation (e.g., 'adg_any|~adg_cb_android' means all AdGuard except CB on Android).
 *
 * @param rawPlatforms Raw platform string, e.g. 'adg_safari_any|adg_os_any' or 'adg_any|~adg_cb_android'.
 *
 * @returns Platform expression string (validated, returned as-is for later expansion).
 *
 * @throws Error if the expression is malformed: it has an empty platform (e.g. a trailing `|`), names a platform
 * that does not exist, or selects no platform at all (e.g. `adg_os_any|~adg_os_any`). Such a key would silently
 * drop or orphan the data stored under it.
 *
 * @note Multiple platforms and negations in a key will be expanded during data loading.
 * @note Negated platforms will NOT have data inserted for them (they are exclusions).
 */
export const parseRawPlatforms = (rawPlatforms: string): string => {
    // Use PlatformExpressionEvaluator for validation
    // This centralizes all platform expression parsing logic
    try {
        // The evaluator skips empty slots, which in a data key can only be a typo
        if (rawPlatforms.split(PLATFORM_SEPARATOR).some((part) => part.trim().length === 0)) {
            throw new Error('the expression contains an empty platform');
        }

        // The evaluator returns an empty list when the negations leave nothing
        if (PlatformExpressionEvaluator.evaluate(rawPlatforms).length === 0) {
            throw new Error('the expression does not select any platform');
        }
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid platform expression '${rawPlatforms}': ${reason}`);
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
    .transform((value, ctx) => {
        try {
            return parseRawPlatforms(value);
        } catch (error) {
            // Report the problem as a schema issue so `safeParse` returns
            // `success: false` instead of throwing
            ctx.addIssue({
                code: zod.ZodIssueCode.custom,
                message: error instanceof Error ? error.message : String(error),
            });

            return zod.NEVER;
        }
    });
