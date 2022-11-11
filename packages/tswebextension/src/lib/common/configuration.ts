import { z } from 'zod';

/**
 * Stealth mode options schema
 */
export const stealthConfigValidator = z.object({
    /**
     * Is destruct first-party cookies enabled
     */
    selfDestructFirstPartyCookies: z.boolean(),

    /**
     * Cookie maxAge in minutes
     */
    selfDestructFirstPartyCookiesTime: z.number(),

    /**
     * Is destruct third-party cookies enabled
     */
    selfDestructThirdPartyCookies: z.boolean(),

    /**
     * Cookie maxAge in minutes
     */
    selfDestructThirdPartyCookiesTime: z.number(),

    /**
     * Remove referrer for third-party requests
     */
    hideReferrer: z.boolean(),

    /**
     * Hide referrer in case of search engine is referrer
     */
    hideSearchQueries: z.boolean(),

    /**
     * Remove X-Client-Data header
     */
    blockChromeClientData: z.boolean(),

    /**
     * Adding Do-Not-Track (DNT) header
     */
    sendDoNotTrack: z.boolean(),

    /**
     * Is WebRTC blocking enabled
     */
    blockWebRTC: z.boolean(),
}).strict();

export type StealthConfig = z.infer<typeof stealthConfigValidator>;

export const settingsConfigValidator = z.object({
    /**
     * Flag specifying if ads for sites would be blocked or allowed
     */
    allowlistInverted: z.boolean(),

    /**
     * Flag specifying allowlist enable state
     * We don't use allowlist array length condition for calculate enable state,
     * because its not cover case with empty list in inverted mode
     */
    allowlistEnabled: z.boolean(),

    /**
     * Enables css hits counter if true
     */
    collectStats: z.boolean(),

    /**
     * Enables stealth mode if true
     */
    stealthModeEnabled: z.boolean(),

    /**
     * Enables filtering if true
     */
    filteringEnabled: z.boolean(),

    /**
     * Redirect url for $document rules
     */
    documentBlockingPageUrl: z.string().optional(),

    /**
     * Stealth mode options
     */
    stealth: stealthConfigValidator,
});

export type SettingsConfig = z.infer<typeof settingsConfigValidator>;

/**
 * App configuration data schema
 */
export const configurationValidator = z.object({
    /**
     * List of domain names of sites, which should be excluded from blocking
     * or which should be included in blocking depending on the value of
     * allowlistInverted setting value
     */
    allowlist: z.string().array(),

    /**
     * List of domain names of sites, which should be temporary excluded from document blocking
     */
    trustedDomains: z.string().array(),

    /**
     * List of rules added by user
     */
    userrules: z.string().array(),

    /**
     * Flag responsible for logging
     */
    verbose: z.boolean(),

    settings: settingsConfigValidator,

}).strict();

export type Configuration = z.infer<typeof configurationValidator>;

/**
 * Current configuration data, stored in app context
 *
 * We don't save whole {@link Configuration} object,
 * because filter rule strings are heavyweight
 */
export type ConfigurationContext =
    & Omit<Configuration, 'filters' | 'allowlist' | 'userrules' | 'trustedDomains'>
    & { filters: number[] };
