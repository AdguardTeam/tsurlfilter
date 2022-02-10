import { z } from 'zod';

export const configurationValidator = z.object({
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

export type Configuration = z.infer<typeof configurationValidator>;
