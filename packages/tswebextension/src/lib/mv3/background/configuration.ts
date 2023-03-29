import { z as zod } from 'zod';

import { configurationValidator } from '../../common';

/**
 * Custom filter list configuration validator for MV3.
 */
export const customFilterMV3Validator = zod.object({
    /**
     * Filter identifier.
     */
    filterId: zod.number(),

    /**
     * Filter text content.
     */
    content: zod.string(),
});

/**
 * Custom filter list type for MV3.
 * This type is inferred from the {@link customFilterMV3Validator} schema.
 */
export type CustomFilterMV3 = zod.infer<typeof customFilterMV3Validator>;

/**
 * Configuration validator for MV3.
 */
export const configurationMV3Validator = configurationValidator.extend({
    /**
     * List of static filters ids.
     * The content for these filters will be loaded by the tswebextension
     * from the "filtersPath" provided when needed.
     */
    staticFiltersIds: zod.number().array(),

    /**
     * List of custom filters that can be added/edited/deleted by the user.
     */
    customFilters: customFilterMV3Validator.array(),

    /**
     * Path to directory with filters' text rules.
     */
    filtersPath: zod.string(),

    /**
     * Path to directory with converted rule sets.
     * Note: it's better to convert filters with tsurlfilter.convertFilters.
     */
    ruleSetsPath: zod.string(),

    /**
     * Enables filtering log if true.
     */
    // TODO: use settings.collectStats instead?
    filteringLogEnabled: zod.boolean(),
});

/**
 * Configuration type for MV3.
 * This type is inferred from the {@link configurationMV3Validator} schema.
 */
export type ConfigurationMV3 = zod.infer<typeof configurationMV3Validator>;

/**
 * Configuration context type for MV3.
 * This type is {@link ConfigurationMV3} with an omitted array of rule and domain strings loaded in the filter engine.
 * It is used to reduce memory consumption when storing configuration data in memory.
 */
export type ConfigurationMV3Context =
    & Omit<ConfigurationMV3, 'customFilters' | 'allowlist' | 'userrules' | 'trustedDomains'>
    & { customFilters: number[] };
