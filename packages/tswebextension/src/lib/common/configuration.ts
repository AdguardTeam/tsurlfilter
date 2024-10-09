import { z as zod } from 'zod';
import { LogLevel } from '@adguard/logger';

import { filterListChunksValidator, filterListSourceMapValidator } from '@adguard/tsurlfilter';
import { version } from '../../../package.json';

export const TSWEBEXTENSION_VERSION = version;

/**
 * Stealth mode configuration schema.
 */
export const stealthConfigValidator = zod.object({
    /**
     * Should the application set a fixed lifetime from
     * {@link StealthConfig.selfDestructFirstPartyCookiesTime} for first-party
     * cookies.
     */
    selfDestructFirstPartyCookies: zod.boolean(),

    /**
     * Time in minutes to delete first-party cookies.
     */
    selfDestructFirstPartyCookiesTime: zod.number(),

    /**
     * Should the application set a fixed lifetime from
     * {@link StealthConfig.selfDestructThirdPartyCookiesTime} for third-party
     * cookies.
     */
    selfDestructThirdPartyCookies: zod.boolean(),

    /**
     * Time in minutes to delete third-party cookies.
     */
    selfDestructThirdPartyCookiesTime: zod.number(),

    /**
     * Should the application hide the origin referrer in third-party requests
     * by replacing the referrer url with the request url.
     */
    hideReferrer: zod.boolean(),

    /**
     * Should the application hide the original referrer from the search page
     * containing the search query in third-party queries, replacing
     * the referrer url with the request url.
     */
    hideSearchQueries: zod.boolean(),

    /**
     * For Google Chrome, it removes the 'X-Client-Data' header from
     * the requests, which contains information about the browser version
     * and modifications.
     */
    blockChromeClientData: zod.boolean(),

    /**
     * Includes HTTP headers 'DNT' and 'Sec-GPC' in all requests.
     *
     * @see https://en.wikipedia.org/wiki/Do_Not_Track
     * @see https://globalprivacycontrol.org
     */
    sendDoNotTrack: zod.boolean(),

    /**
     * Blocks the possibility of leaking your IP address through WebRTC, even if
     * you use a proxy server or VPN.
     */
    blockWebRTC: zod.boolean(),
}).strict();

/**
 * Stealth mode configuration type.
 * This type is inferred from the {@link stealthConfigValidator} schema.
 */
export type StealthConfig = zod.infer<typeof stealthConfigValidator>;

/**
 * Filter list configuration validator for MV2.
 */
export const basicFilterValidator = zod.object({
    /**
     * Filter list text content.
     */
    content: filterListChunksValidator,

    /**
     * Source map.
     */
    sourceMap: filterListSourceMapValidator.optional(),
});

export type BasicFilterValidator = zod.infer<typeof basicFilterValidator>;

/**
 * Settings configuration schema.
 */
export const settingsConfigValidator = zod.object({
    /**
     * If this flag is true, the application will work ONLY with domains
     * from the {@link Configuration.allowlist},
     * otherwise it will work everywhere EXCLUDING domains from the list.
     */
    allowlistInverted: zod.boolean(),

    /**
     * Flag specifying {@link Configuration.allowlist} enable state.
     * We don't use allowlist array length condition for calculate enable state,
     * because it's not cover case with empty list in inverted mode.
     */
    allowlistEnabled: zod.boolean(),

    /**
     * Enables css hits counter if true.
     */
    collectStats: zod.boolean(),

    /**
     * Enables verbose scriptlets logging if true.
     */
    debugScriptlets: zod.boolean().default(false),

    /**
     * Enables stealth mode if true.
     */
    stealthModeEnabled: zod.boolean(),

    /**
     * Enables filtering if true.
     */
    filteringEnabled: zod.boolean(),

    /**
     * Redirect url for $document rules.
     */
    documentBlockingPageUrl: zod.string().optional(),

    /**
     * Path to the assembled @adguard/assistant module. Necessary for lazy
     * on-demand loading of the assistant.
     */
    assistantUrl: zod.string(),

    /**
     * Stealth mode options.
     */
    stealth: stealthConfigValidator,
});

/**
 * Settings configuration type.
 * This type is inferred from the {@link settingsConfigValidator} schema.
 */
export type SettingsConfig = zod.infer<typeof settingsConfigValidator>;

/**
 * Generic app configuration schema.
 */
export const configurationValidator = zod.object({
    /**
     * List of hostnames or domains of sites, which should be excluded
     * from blocking or which should be included in blocking
     * depending on the value of {@link SettingsConfig.allowlistInverted} setting value.
     */
    allowlist: zod.string().array(),

    /**
     * List of rules added by user.
     */
    userrules: basicFilterValidator,

    /**
     * Flag responsible for logging.
     *
     * @deprecated  Will be removed in the next minor version.
     * Use {@link Configuration.logLevel} instead.
     */
    verbose: zod.boolean().optional(),

    /**
     * Logging level.
     */
    logLevel: zod.enum([LogLevel.Error, LogLevel.Warn, LogLevel.Info, LogLevel.Debug]).optional(),

    settings: settingsConfigValidator,

}).strict();

/**
 * Generic app configuration type.
 * This type is inferred from the {@link configurationValidator} schema.
 */
export type Configuration = zod.infer<typeof configurationValidator>;
