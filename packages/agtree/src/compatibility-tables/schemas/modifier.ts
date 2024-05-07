import zod from 'zod';
import XRegExp from 'xregexp';

import { zodToCamelCase } from '../utils/zod-camelcase';
import { baseCompatibilityDataSchema, baseRefineLogic, booleanSchema } from './base';
import { getErrorMessage } from '../../utils/error';

const KNOWN_VALIDATORS = new Set([
    'domain',
    'pipe_separated_domains',
    'regexp',
    'url',
]);

export const modifierDataSchema = zodToCamelCase(baseCompatibilityDataSchema.extend({
    conflicts: zod.array(zod.string().min(1)).nullable().default(null),
    inverse_conflicts: booleanSchema.default(false),
    assignable: booleanSchema.default(false),
    negatable: booleanSchema.default(true),
    block_only: booleanSchema.default(false),
    exception_only: booleanSchema.default(false),
    value_optional: booleanSchema.default(false),
    value_format: zod.string().min(1).nullable().default(null),
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
            return;
        }

        // otherwise, we need to validate it as a regex
        try {
            XRegExp(valueFormat);
        } catch (error: unknown) {
            ctx.addIssue({
                code: zod.ZodIssueCode.custom,
                message: getErrorMessage(error),
            });
        }
    }
}));

export type ModifierDataSchema = zod.infer<typeof modifierDataSchema>;
