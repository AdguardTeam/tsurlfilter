import { z } from 'zod';

const configurationValidator = z.object({
    /**
     * An array of filters identifiers.
     * You can look for possible filters identifiers in the filters metadata file:
     * https://filters.adtidy.org/extension/chromium/filters.json
     */
    filters: z.number().array(),
    /**
     * An absolute path to a file, containing filters metadata.
     * Once started, AdGuard will periodically check filters updates by downloading this file.
     *
     * Example: https://path.to/filters/metadata.json
     */
    filtersMetadataUrl: z.string(),
    /**
     * URL mask used for fetching filters rules.
     * {filter_id} parameter will be replaced with an actual filter identifier.
     *
     * Example: https://path.to/filters/{filter_id}.txt
     */
    filtersRulesUrlMask: z.string(),
    /**
     * An array of domains, for which AdGuard won't work.
     */
    allowList: z.optional(z.string().array()),
    /**
      * If it is true, Adguard will work for domains from the allowlist only.
      * All other domains will be ignored.
      */
    isAllowlistInverted: z.optional(z.boolean()),
    /**
      * An array of custom filtering rules.
      * Filtering rules syntax is described here:
      * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters
      *
      * These custom rules might be created by a user via AdGuard Assistant UI.
      */
    rules: z.optional(z.string().array()),
}).strict();

export type Configuration = z.infer<typeof configurationValidator>;

export const validateConfiguration = (configuration: unknown): void => {
    configurationValidator.parse(configuration);   
};
