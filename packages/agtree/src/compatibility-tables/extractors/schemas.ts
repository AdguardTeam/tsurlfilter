import zod from 'zod';

import { platformSchema } from '../platforms';
import { zodToCamelCase } from '../utils/zod-camelcase';

export const baseCompatibilityDataSchema = zod.object({
    name: zod.string().min(1),
    aliases: zod.array(zod.string().min(1)).nullable().default(null),
    description: zod.string().min(1).nullable().default(null),
    docs: zod.string().min(1).nullable().default(null),
    version_added: zod.string().min(1).nullable().default(null),
    version_removed: zod.string().min(1).nullable().default(null),
    deprecated: zod.boolean().default(false),
    deprecation_message: zod.string().min(1).nullable().default(null),
    removed: zod.boolean().default(false),
    removal_message: zod.string().min(1).nullable().default(null),
});

export const baseCompatibilityDataSchemaCamelCase = zodToCamelCase(baseCompatibilityDataSchema);

export type BaseCompatibilityDataSchema = zod.infer<typeof baseCompatibilityDataSchemaCamelCase>;

const baseRefineLogic = (data: zod.infer<typeof baseCompatibilityDataSchema>, ctx: zod.RefinementCtx) => {
    if (data.deprecated && !data.deprecation_message) {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'deprecation_message is required for deprecated modifiers',
        });
    }
    if (!data.deprecated && data.deprecation_message) {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'deprecation_message is only allowed for deprecated modifiers',
        });
    }
};

export const modifierDataSchema = zodToCamelCase(baseCompatibilityDataSchema.extend({
    conflicts: zod.array(zod.string().min(1)).nullable().default(null),
    inverse_conflicts: zod.boolean().default(false),
    assignable: zod.boolean().default(false),
    negatable: zod.boolean().default(true),
    block_only: zod.boolean().default(false),
    exception_only: zod.boolean().default(false),
    value_optional: zod.boolean().default(false),
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

    if (data.aliases && data.aliases.length !== new Set(data.aliases).size) {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'Aliases must be unique',
        });
    }
}));

export type ModifierDataSchema = zod.infer<typeof modifierDataSchema>;

export const redirectDataSchema = zodToCamelCase(baseCompatibilityDataSchema.extend({
    is_blocking: zod.boolean().default(false),
}).superRefine(baseRefineLogic));

export type RedirectDataSchema = zod.infer<typeof redirectDataSchema>;

// generic schema for compatibility data files
export const baseFileSchema = <T extends BaseCompatibilityDataSchema>(dataSchema: zod.ZodType<T>) => {
    return zod.record(platformSchema, dataSchema);
};

export type BaseFileSchema<T extends BaseCompatibilityDataSchema> = zod.infer<ReturnType<typeof baseFileSchema<T>>>;
