import { z } from 'zod';

const baseConfigurationValidator = z.object({
    /**
     * List of domain names of sites, which should be excluded from blocking
     * or which should be included in blocking depending on the value of
     * allowlistInverted setting value
     */
    allowlist: z.string().array(),

    /**
     * List of rules added by user
     */
    userrules: z.string().array(),

    /**
     * Flag responsible for logging
     */
    verbose: z.boolean(),

    settings: z.object({
        /**
         * Flag specifying if ads for sites would be blocked or allowed
         */
        allowlistInverted: z.boolean(),

        /**
         * Enables css hits counter if true
         */
        collectStats: z.boolean(),

        stealth: z.object({
            blockChromeClientData: z.boolean(),
            hideReferrer: z.boolean(),
            hideSearchQueries: z.boolean(),
            sendDoNotTrack: z.boolean(),
            blockWebRTC: z.boolean(),
            selfDestructThirdPartyCookies: z.boolean(),
            selfDestructThirdPartyCookiesTime: z.number(),
            selfDestructFirstPartyCookies: z.boolean(),
            selfDestructFirstPartyCookiesTime: z.number(),
        }),
    }),

}).strict();

const baseConfigurationValidatorMV2 = z.object({
    /**
     * Specifies filter lists that will be used to filter content.
     * filterId should uniquely identify the filter so that the API user
     * may match it with the source lists in the filtering log callbacks.
     * content is a string with the full filter list content. The API will
     * parse it into a list of individual rules.
     */
    filters: z.object({
        filterId: z.number(),
        content: z.string(),
    }).array(),
}).strict();

export const configurationValidatorMV2 = baseConfigurationValidator
    .merge(baseConfigurationValidatorMV2);

const baseConfigurationValidatorMV3 = z.object({
    /**
     * Specifies filter lists that will be used to filter content.
     * id in filters array should uniquely identify the filter so that the API user
     * may match it with the source lists in the filtering log callbacks.
     */
    filters: z.number().array(),
}).strict();

export const configurationValidatorMV3 = baseConfigurationValidator
    .merge(baseConfigurationValidatorMV3);

export type ConfigurationMV2 = z.infer<typeof configurationValidatorMV2>;
export type ConfigurationMV3 = z.infer<typeof configurationValidatorMV3>;
