/**
 * @file Schema for modifier data.
 */

import zod from 'zod';

import { zodToCamelCase } from '../utils/zod-camelcase';
import {
    baseCompatibilityDataSchema,
    baseRefineLogic,
    booleanSchema,
    nonEmptyStringSchema,
} from './base';
import { getErrorMessage } from '../../utils/error';
import { EMPTY } from '../../utils/constants';

/**
 * Known validators that don't need to be validated as regex.
 */
export const KNOWN_VALIDATORS: ReadonlySet<string> = new Set([
    'csp_value',
    'domain',
    'permissions_value',
    'pipe_separated_apps',
    'pipe_separated_denyallow_domains',
    'pipe_separated_domains',
    'pipe_separated_methods',
    'pipe_separated_stealth_options',
    'regexp',
    'url',
]);

/**
 * Zod schema for modifier data.
 */
export const modifierDataSchema = zodToCamelCase(baseCompatibilityDataSchema.extend({
    /**
     * List of modifiers that are incompatible with the actual one.
     */
    conflicts: zod.array(nonEmptyStringSchema).nullable().default(null),

    /**
     * The actual modifier is incompatible with all other modifiers, except the ones listed in `conflicts`.
     */
    inverse_conflicts: booleanSchema.default(false),

    /**
     * Describes whether the actual modifier supports value assignment. For example, `$domain` is assignable,
     * so it can be used like this: `$domain=domain.com\|~subdomain.domain.com`, where `=` is the assignment operator
     * and `domain.com\|~subdomain.domain.com` is the value.
     */
    assignable: booleanSchema.default(false),

    /**
     * Describes whether the actual modifier can be negated. For example, `$third-party` is negatable,
     * so it can be used like this: `$~third-party`.
     */
    negatable: booleanSchema.default(true),

    /**
     * The actual modifier can only be used in blocking rules, it cannot be used in exceptions.
     * If it's value is `true`, then the modifier can be used only in blocking rules.
     * `exception_only` and `block_only` cannot be used together (they are mutually exclusive).
     */
    block_only: booleanSchema.default(false),

    /**
     * The actual modifier can only be used in exceptions, it cannot be used in blocking rules.
     * If it's value is `true`, then the modifier can be used only in exceptions.
     * `exception_only` and `block_only` cannot be used together (they are mutually exclusive).
     */
    exception_only: booleanSchema.default(false),

    /**
     * Describes whether the *assignable* modifier value is required.
     * For example, `$cookie` is assignable but it can be used without a value in exception rules:
     * `@@\|\|example.com^$cookie`.
     * If `false`, the `value_format` is required, e.g. the value of `$app` should always be specified
     */
    value_optional: booleanSchema.default(false),

    /**
     * Describes the format of the value for the *assignable* modifier.
     * Its value can be a regex pattern or a known validator name (e.g. `domain`, `pipe_separated_domains`, etc.).
     */
    value_format: nonEmptyStringSchema.nullable().default(null),

    /**
     * Describes the flags for the `value_format` regex pattern.
     */
    value_format_flags: nonEmptyStringSchema.nullable().default(null),
}).superRefine((data, ctx) => {
    // TODO: find something better, for now we can't add refine logic to the base schema:
    // https://github.com/colinhacks/zod/issues/454#issuecomment-848370721
    baseRefineLogic(data, ctx);

    if (data.block_only && data.exception_only) {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'block_only and exception_only are mutually exclusive',
        });
    }

    if (data.assignable && !data.value_format) {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'value_format is required for assignable modifiers',
        });
    }

    if (data.value_format) {
        const valueFormat = data.value_format.trim();

        // if it is a known validator, we don't need to validate it further
        if (KNOWN_VALIDATORS.has(valueFormat)) {
            if (data.value_format_flags) {
                ctx.addIssue({
                    code: zod.ZodIssueCode.custom,
                    message: 'value_format_flags are not allowed for known validators',
                });
            }
            return;
        }

        // otherwise, we need to validate it as a regex
        try {
            new RegExp(valueFormat, data.value_format_flags ?? EMPTY);
        } catch (error: unknown) {
            ctx.addIssue({
                code: zod.ZodIssueCode.custom,
                message: getErrorMessage(error),
            });
        }
    } else if (data.value_format_flags) {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'value_format is required for value_format_flags',
        });
    }
}));

/**
 * Type of the modifier data schema.
 */
export type ModifierDataSchema = zod.infer<typeof modifierDataSchema>;
