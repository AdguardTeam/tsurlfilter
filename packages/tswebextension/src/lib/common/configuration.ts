import { z } from 'zod';

/**
 * Stealth mode configuration schema.
 */
export const stealthConfigValidator = z.object({
    /**
     * Should the application set a fixed lifetime from
     * {@link StealthConfig.selfDestructFirstPartyCookiesTime} for first-party
     * cookies.
     */
    selfDestructFirstPartyCookies: z.boolean(),

    /**
     * Time in minutes to delete first-party cookies.
     */
    selfDestructFirstPartyCookiesTime: z.number(),

    /**
     * Should the application set a fixed lifetime from
     * {@link StealthConfig.selfDestructThirdPartyCookiesTime} for third-party
     * cookies.
     */
    selfDestructThirdPartyCookies: z.boolean(),

    /**
     * Time in minutes to delete third-party cookies.
     */
    selfDestructThirdPartyCookiesTime: z.number(),

    /**
     * Should the application hide the origin referrer in third-party requests
     * by replacing the referrer url with the request url.
     */
    hideReferrer: z.boolean(),

    /**
     * Should the application hide the original referrer from the search page
     * containing the search query in third-party queries, replacing
     * the referrer url with the request url.
     */
    hideSearchQueries: z.boolean(),

    /**
     * For Google Chrome, it removes the 'X-Client-Data' header from
     * the requests, which contains information about the browser version
     * and modifications.
     */
    blockChromeClientData: z.boolean(),

    /**
     * Includes HTTP headers 'DNT' and 'Sec-GPC' in all requests.
     *
     * @see https://en.wikipedia.org/wiki/Do_Not_Track
     * @see https://globalprivacycontrol.org
     */
    sendDoNotTrack: z.boolean(),

    /**
     * Blocks the possibility of leaking your IP address through WebRTC, even if
     * you use a proxy server or VPN.
     */
    blockWebRTC: z.boolean(),
}).strict();

/**
 * Stealth mode configuration type.
 * This type is inferred from the {@link stealthConfigValidator} schema.
 */
export type StealthConfig = z.infer<typeof stealthConfigValidator>;

/**
 * Settings configuration schema.
 */
export const settingsConfigValidator = z.object({
    /**
     * If this flag is true, the application will work ONLY with domains
     * from the {@link Configuration.allowlist},
     * otherwise it will work everywhere EXCLUDING domains from the list.
     */
    allowlistInverted: z.boolean(),

    /**
     * Flag specifying {@link Configuration.allowlist} enable state.
     * We don't use allowlist array length condition for calculate enable state,
     * because it's not cover case with empty list in inverted mode.
     */
    allowlistEnabled: z.boolean(),

    /**
     * Enables css hits counter if true.
     */
    collectStats: z.boolean(),

    /**
     * Enables stealth mode if true.
     */
    stealthModeEnabled: z.boolean(),

    /**
     * Enables filtering if true.
     */
    filteringEnabled: z.boolean(),

    /**
     * Redirect url for $document rules.
     */
    documentBlockingPageUrl: z.string().optional(),

    /**
     * Path to the assembled @adguard/assistant module. Necessary for lazy
     * on-demand loading of the assistant.
     */
    assistantUrl: z.string(),

    /**
     * Stealth mode options.
     */
    stealth: stealthConfigValidator,
});

/**
 * Settings configuration type.
 * This type is inferred from the {@link settingsConfigValidator} schema.
 */
export type SettingsConfig = z.infer<typeof settingsConfigValidator>;

/**
 * Generic app configuration schema.
 */
export const configurationValidator = z.object({
    /**
     * List of hostnames or domains of sites, which should be excluded
     * from blocking or which should be included in blocking
     * depending on the value of {@link SettingsConfig.allowlistInverted} setting value.
     */
    allowlist: z.string().array(),

    /**
     * List of domain names of sites, which should be temporary excluded from document blocking.
     */
    trustedDomains: z.string().array(),

    /**
     * List of rules added by user.
     */
    userrules: z.string().array(),

    /**
     * Flag responsible for logging.
     */
    verbose: z.boolean(),

    settings: settingsConfigValidator,

}).strict();

/**
 * Generic app configuration type.
 * This type is inferred from the {@link configurationValidator} schema.
 */
export type Configuration = z.infer<typeof configurationValidator>;
