import { z as zod } from 'zod';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { preprocessedFilterListValidator, type PreprocessedFilterList } from '@adguard/tsurlfilter';

import { configurationValidator, settingsConfigValidator } from '../../common/configuration';

/**
 * Custom filter list configuration validator for MV3.
 */
export const customFilterMV3Validator = preprocessedFilterListValidator.extend({
    /**
     * Filter identifier.
     */
    filterId: zod.number(),

    /**
     * Filter trusted flag.
     */
    trusted: zod.boolean(),
});

/**
 * Custom filter list type for MV3.
 * This type is inferred from the {@link customFilterMV3Validator} schema.
 */
export type CustomFilterMV3 = zod.infer<typeof customFilterMV3Validator>;

export const settingsConfigMV3 = settingsConfigValidator.extend({
    /**
     * Path to the content script that set GPC Signal.
     * Necessary for `Do Not Track` stealth option.
     * This content script will be dynamically registered and unregistered
     * by the tswebextension when the stealth option is enabled/disabled.
     */
    gpcScriptUrl: zod.string(),

    /**
     * Path to the content script that hide document referrer.
     * Necessary for `Hide Search Queries` stealth option.
     * This content script will be dynamically registered and unregistered
     * by the tswebextension when the stealth option is enabled/disabled.
     */
    hideDocumentReferrerScriptUrl: zod.string(),
});

export type SettingsConfigMV3 = zod.infer<typeof settingsConfigMV3>;

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
     * Enables logging declarative rules, which will increase used memory,
     * because to extract matched source rule text we need to load ruleset
     * in memory.
     */
    declarativeLogEnabled: zod.boolean(),

    /**
     * List of hotfix rules which should applied dynamically.
     */
    quickFixesRules: customFilterMV3Validator.omit({ filterId: true }),

    settings: settingsConfigMV3,

    /**
     * List of rules added by user.
     */
    userrules: customFilterMV3Validator.omit({ filterId: true }),
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
    & Omit<ConfigurationMV3, 'customFilters' | 'allowlist' | 'userrules' | 'quickFixesRules' | 'trustedDomains'>
    & { customFilters: number[] };
