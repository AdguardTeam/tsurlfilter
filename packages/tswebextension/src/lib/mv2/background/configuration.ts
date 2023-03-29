import { z } from 'zod';
import { configurationValidator } from '../../common';

/**
 * Filter list configuration validator for MV2.
 */
export const filterMV2Validator = z.object({
    /**
     * Filter identifier.
     */
    filterId: z.number(),

    /**
     * Filter list text content.
     */
    content: z.string(),

    /**
     * Filter trusted flag. If true, js rules from list can be executed.
     */
    trusted: z.boolean(),
});

/**
 * Filter list type for MV2
 * This type is inferred from the {@link filterMV2Validator} schema.
 */
export type FilterMV2 = z.infer<typeof filterMV2Validator>;

/**
 * Configuration validator for MV2.
 */
export const configurationMV2Validator = configurationValidator.extend({
    filters: filterMV2Validator.array(),
});

/**
 * Configuration type for MV2.
 * This type is inferred from the {@link configurationMV2Validator} schema.
 */
export type ConfigurationMV2 = z.infer<typeof configurationMV2Validator>;

/**
 * Configuration context type for MV2.
 * This type is {@link ConfigurationMV2} with an omitted array of rule and domain strings loaded in the filter engine.
 * It is used to reduce memory consumption when storing configuration data in memory.
 */
export type ConfigurationMV2Context =
    & Omit<ConfigurationMV2, 'filters' | 'allowlist' | 'userrules' | 'trustedDomains'>
    & { filters: number[] };
