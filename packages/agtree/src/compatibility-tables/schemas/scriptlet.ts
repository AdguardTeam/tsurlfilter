/**
 * @file Schema for scriptlet data.
 */

import zod from 'zod';

import { zodToCamelCase } from '../utils/zod-camelcase';
import {
    baseCompatibilityDataSchema,
    baseRefineLogic,
    booleanSchema,
    nonEmptyStringSchema,
} from './base';

/**
 * Zod schema for scriptlet parameter data.
 */
const scriptletParameterSchema = zod.object({
    /**
     * Name of the actual parameter.
     */
    name: nonEmptyStringSchema,

    /**
     * Describes whether the parameter is required. Empty parameters are not allowed.
     */
    required: booleanSchema,

    /**
     * Short description of the parameter.
     * If not specified or it's value is `null`,then the description is not available.
     */
    description: nonEmptyStringSchema.nullable().default(null),

    /**
     * Regular expression that matches the value of the parameter.
     * If it's value is `null`, then the parameter value is not checked.
     */
    pattern: nonEmptyStringSchema.nullable().default(null),

    /**
     * Default value of the parameter (if any).
     */
    default: zod
        .string()
        .transform((val) => val.trim())
        .nullable()
        .default(null),

    /**
     * Describes whether the parameter is used only for debugging purposes.
     */
    debug: booleanSchema.default(false),
});

/**
 * Zod schema for scriptlet parameters.
 */
const scriptletParametersSchema = zod.array(scriptletParameterSchema);

/**
 * Schema for a uBlock Origin scriptlet token parameter.
 *
 * Tokens are optional key-value pairs that come after the required and optional
 * positional parameters in scriptlet calls. They provide additional configuration
 * options and are parsed by the getExtraArgs() function.
 *
 * @example
 * ```adblock
 * example.com##+js(aeld, click, popMagic, runAt, idle)
 * !                ↑     ↑      ↑         ↑      ↑
 * !                │     │      │         │      │
 * !                │     │      │         │      └── Token value (they always have values)
 * !                │     │      │         └── Tokens came after optional parameters
 * !                │     │      └── Second optional parameter value
 * !                │     └── First optional parameter value
 * !                └── Scriptlet name
 * ```
 * Results in
 * ```js
 * { runAt: 'idle' }
 * ```
 *
 * @see {@link https://github.com/gorhill/uBlock/blob/f1689a9ab30ae5aece3db6d7a67dbde90f6e69df/src/js/resources/safe-self.js#L137-L149}
 */
const uboScriptletTokenSchema = zod.object({
    /**
     * Name of the uBO scriptlet token (the key in the key-value pair).
     *
     * @example 'includes', 'stay', 'quitAfter', 'encoding'
     */
    name: nonEmptyStringSchema,

    /**
     * Short description of what this token controls or configures.
     * If `null`, description is not available.
     *
     * @example 'Pattern to match before applying changes'
     */
    description: nonEmptyStringSchema.nullable().default(null),

    /**
     * Regular expression pattern that matches valid VALUES for this token.
     * Defines the SYNTAX/FORMAT of acceptable values.
     * If `null`, format validation is not available.
     *
     * @example '^\\d+$' for integers, '^(base64|none)$' for enums
     *
     * Note: This validates the string format BEFORE parsing.
     * Tokens should always be provided with a value in practice.
     */
    value_format: nonEmptyStringSchema.nullable().default(null),

    /**
     * Semantic TYPE indicating how the token value is USED in code.
     * Describes the PURPOSE/BEHAVIOR, not just syntax.
     *
     * - 'string': Used as-is for string matching/operations
     * - 'integer': Numeric string auto-converted to integer during parsing
     * - 'boolean': Used as a flag; code checks for truthiness, not exact value
     *
     * This complements `value_format` by providing semantic meaning:
     * - value_format describes WHAT is valid (syntax)
     * - value_type describes HOW it's interpreted (semantics)
     *
     * @example
     * // Token: stay
     * // value_format: null (any non-empty string works)
     * // value_type: 'boolean' (checked with `if (extraArgs.stay)`)
     *
     * @example
     * // Token: quitAfter
     * // value_format: '^\\d+$' (must be digits)
     * // value_type: 'integer' (converted to number for setTimeout)
     *
     * If `null`, type is unknown or not applicable.
     */
    value_type: zod.enum(['string', 'integer', 'boolean']).nullable().default(null),

    /**
     * Default/fallback value used in scriptlet code when token is absent or falsy.
     * This is NOT a parser default but represents documented fallback patterns
     * in the scriptlet implementation (e.g., `extraArgs.quitAfter || 0`).
     *
     * If `null`, no default fallback is documented in the code.
     *
     * @example '0' for numeric defaults, 'false' for boolean defaults
     */
    default: zod.string().nullable().default(null),
});

/**
 * Zod schema for uBO scriptlet tokens.
 */
const uboScriptletTokensSchema = zod.array(uboScriptletTokenSchema);

/**
 * Zod schema for scriptlet data.
 */
export const scriptletDataSchema = zodToCamelCase(
    baseCompatibilityDataSchema.extend({
        /**
         * Describes whether the scriptlet is a trusted scriptlet.
         * Trusted scriptlets have elevated privileges and can only be used in trusted filter lists.
         */
        is_trusted: booleanSchema.default(false),

        /**
         * List of parameters that the scriptlet accepts.
         * **Every** parameter should be listed here, because we check that the scriptlet is used correctly
         * (e.g. that the number of parameters is correct).
         */
        parameters: scriptletParametersSchema.optional(),

        /**
         * List of tokens that the scriptlet accepts.
         */
        ubo_tokens: uboScriptletTokensSchema.optional(),
    }).superRefine((data, ctx) => {
        // TODO: find something better, for now we can't add refine logic to the base schema:
        // https://github.com/colinhacks/zod/issues/454#issuecomment-848370721
        baseRefineLogic(data, ctx);

        // we don't allow required parameters after optional ones
        if (!data.parameters) {
            return;
        }

        let optionalFound = false;

        for (const parameter of data.parameters) {
            if (optionalFound && parameter.required) {
                ctx.addIssue({
                    code: zod.ZodIssueCode.custom,
                    message: 'Required parameters must be before optional ones',
                });
            }

            if (!parameter.required) {
                optionalFound = true;
            }
        }
    }),
);

/**
 * Type of the scriptlet data schema.
 */
export type ScriptletDataSchema = zod.infer<typeof scriptletDataSchema>;
