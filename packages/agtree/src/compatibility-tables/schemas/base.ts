import zod from 'zod';

import { platformSchema } from './platform';
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

export const baseRefineLogic = (data: zod.infer<typeof baseCompatibilityDataSchema>, ctx: zod.RefinementCtx) => {
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

    if (data.aliases && data.aliases.length !== new Set(data.aliases).size) {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'Aliases must be unique',
        });
    }
};

// generic schema for compatibility data files
export const baseFileSchema = <T extends BaseCompatibilityDataSchema>(dataSchema: zod.ZodType<T>) => {
    return zod.record(platformSchema, dataSchema);
};

export type BaseFileSchema<T extends BaseCompatibilityDataSchema> = zod.infer<ReturnType<typeof baseFileSchema<T>>>;
