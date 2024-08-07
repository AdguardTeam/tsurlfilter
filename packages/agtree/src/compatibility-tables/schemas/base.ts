/**
 * @file Base compatibility data schema, which is commonly used in compatibility tables.
 */

import zod from 'zod';

import { platformSchema } from './platform';
import { zodToCamelCase } from '../utils/zod-camelcase';

/**
 * Zod schema for boolean values. Accepts both boolean and string values.
 */
export const booleanSchema = zod.union([
    zod.string().transform((val) => val.trim().toLowerCase() === 'true'),
    zod.boolean(),
]);

/**
 * Zod schema for non-empty string values.
 */
export const nonEmptyStringSchema = zod
    .string()
    .transform((val) => val.trim())
    .pipe(zod.string().min(1));

/**
 * Zod schema for base compatibility data.
 * Here we use snake_case properties because the compatibility data is stored in YAML files.
 */
export const baseCompatibilityDataSchema = zod.object({
    /**
     * Name of the actual entity.
     */
    name: nonEmptyStringSchema,

    /**
     * List of aliases for the entity (if any).
     */
    aliases: zod.array(nonEmptyStringSchema).nullable().default(null),

    /**
     * Short description of the actual entity.
     * If not specified or it's value is `null`, then the description is not available.
     */
    description: nonEmptyStringSchema.nullable().default(null),

    /**
     * Link to the documentation. If not specified or it's value is `null`, then the documentation is not available.
     */
    docs: nonEmptyStringSchema.nullable().default(null),

    /**
     * The version of the adblocker in which the entity was added.
     * For AdGuard resources, the version of the library is specified.
     */
    version_added: nonEmptyStringSchema.nullable().default(null),

    /**
     * The version of the adblocker when the entity was removed.
     */
    version_removed: nonEmptyStringSchema.nullable().default(null),

    /**
     * Describes whether the entity is deprecated.
     */
    deprecated: booleanSchema.default(false),

    /**
     * Message that describes why the entity is deprecated.
     * If not specified or it's value is `null`, then the message is not available.
     * It's value is omitted if the entity is not marked as deprecated.
     */
    deprecation_message: nonEmptyStringSchema.nullable().default(null),

    /**
     * Describes whether the entity is removed; for *already removed* features.
     */
    removed: booleanSchema.default(false),

    /**
     * Message that describes why the entity is removed.
     * If not specified or it's value is `null`, then the message is not available.
     * It's value is omitted if the entity is not marked as deprecated.
     */
    removal_message: nonEmptyStringSchema.nullable().default(null),
});

/**
 * Zod schema for base compatibility data with camelCase properties.
 */
export const baseCompatibilityDataSchemaCamelCase = zodToCamelCase(baseCompatibilityDataSchema);

/**
 * Type of the base compatibility data schema.
 */
export type BaseCompatibilityDataSchema = zod.infer<typeof baseCompatibilityDataSchemaCamelCase>;

/**
 * Refinement logic for base compatibility data.
 *
 * @param data Base compatibility data.
 * @param ctx Refinement context.
 */
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

/**
 * Creates a base file schema.
 *
 * @param dataSchema Data schema.
 *
 * @returns Base file schema.
 */
export const baseFileSchema = <T extends BaseCompatibilityDataSchema>(dataSchema: zod.ZodType<T>) => {
    return zod.record(zod.any(), zod.any()).transform((val) => {
        const result = val;

        // Note: js-yaml will leave `define` key in the object, but we don't need it,
        // and since we're using a strict schema, we need to remove it.
        if ('define' in result) {
            delete result.define;
        }

        return result;
    }).pipe(
        zod.record(platformSchema, dataSchema),
    );
};

/**
 * Type of the base file schema.
 */
export type BaseFileSchema<T extends BaseCompatibilityDataSchema> = zod.infer<ReturnType<typeof baseFileSchema<T>>>;
