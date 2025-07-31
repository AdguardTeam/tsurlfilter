import { logger } from '../utils/logger';

/**
 * Array of all stealth options available, even those which are not supported by browser extension.
 */
enum UniversalStealthOption {
    HideSearchQueries = 'searchqueries',
    DoNotTrack = 'donottrack',
    ThirdPartyCookies = '3p-cookie',
    FirstPartyCookies = '1p-cookie',
    ThirdPartyCache = '3p-cache',
    ThirdPartyAuth = '3p-auth',
    WebRTC = 'webrtc',
    Push = 'push',
    Location = 'location',
    Flash = 'flash',
    Java = 'java',
    HideReferrer = 'referrer',
    UserAgent = 'useragent',
    IP = 'ip',
    XClientData = 'xclientdata',
    DPI = 'dpi',
}

/**
 * List of stealth options, supported by browser extension, which can be disabled by $stealth modifier.
 *
 * Following stealth options are initialized on the engine start
 * and can't be disabled via $stealth modifier:
 * - `Block trackers` and `Remove tracking parameters`, as they are applied by a specific
 *   rule lists, initialized on app start;
 * - `Disabling WebRTC`, as it is not being applied on per-request basis.
 */
export enum StealthOptionName {
    HideSearchQueries = 'searchqueries',
    DoNotTrack = 'donottrack',
    HideReferrer = 'referrer',
    XClientData = 'xclientdata',
    FirstPartyCookies = '1p-cookie',
    ThirdPartyCookies = '3p-cookie',
}

const StealthModifierOptions = new Set(Object.values(StealthOptionName));
const UniversalStealthOptions = new Set(Object.values(UniversalStealthOption));

const StealthOption = {
    NotSet: 0,
    [StealthOptionName.HideSearchQueries]: 1,
    [StealthOptionName.DoNotTrack]: 1 << 1,
    [StealthOptionName.HideReferrer]: 1 << 2,
    [StealthOptionName.XClientData]: 1 << 3,
    [StealthOptionName.FirstPartyCookies]: 1 << 4,
    [StealthOptionName.ThirdPartyCookies]: 1 << 5,
} as const;

/**
 * Id to create stealth mode rule lists with,
 * e.g cookie rules for `Self-destructing third-party/first-party cookies` options.
 * It is also used to identify such rules when disabling on per-rule basis.
 */
export const STEALTH_MODE_FILTER_ID = -1;

/**
 * Stealth modifier class.
 * Rules with $stealth modifier will disable specified stealth options for matched requests.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#stealth-modifier}
 */
export class StealthModifier {
    /**
     * Pipe separator.
     */
    private readonly PIPE_SEPARATOR = '|';

    /**
     * Options.
     */
    public readonly options = StealthOption.NotSet;

    /**
     * Parses the options string and creates a new stealth modifier instance.
     *
     * @param optionsStr Options string.
     *
     * @throws SyntaxError on inverted stealth options, which are not supported.
     */
    constructor(optionsStr: string) {
        if (optionsStr.trim().length === 0) {
            return;
        }

        // This prevents parsing invalid syntax as rule without supported options
        if (optionsStr.includes(',')) {
            throw new SyntaxError(`Invalid separator of stealth options used: "${optionsStr}"`);
        }

        const tokens = optionsStr.split(this.PIPE_SEPARATOR);

        for (let i = 0; i < tokens.length; i += 1) {
            const optionName = tokens[i].trim();
            if (optionName === '') {
                continue;
            }

            if (optionName.startsWith('~')) {
                throw new SyntaxError(`Inverted $stealth modifier values are not allowed: "${optionsStr}"`);
            }

            if (!StealthModifier.isValidStealthOption(optionName)) {
                throw new SyntaxError(`Invalid $stealth option in modifier value: "${optionsStr}"`);
            }

            // Skip options which are not supported by browser extension
            if (!StealthModifier.isSupportedStealthOption(optionName)) {
                continue;
            }

            const option = StealthOption[optionName];

            if (this.options & option) {
                // TODO: Change log level to 'warn' after AG-42379
                logger.trace(`[tsurl.StealthModifier.constructor]: duplicate $stealth modifier value "${optionName}" in "${optionsStr}"`);
            }

            this.options |= option;
        }

        if (this.options === StealthOption.NotSet) {
            // TODO: Change log level to 'warn' after AG-42379
            logger.trace(`[tsurl.StealthModifier.constructor]: $stealth modifier does not contain any options supported by browser extension: "${optionsStr}"`);
        }
    }

    /**
     * Checks if the given string is a valid $stealth option, supported by browser extension.
     *
     * @param option Option name.
     *
     * @returns True if the given string is a valid $stealth option.
     */
    private static isSupportedStealthOption = (
        option: string,
    ): option is StealthOptionName => StealthModifierOptions.has(option as StealthOptionName);

    /**
     * Checks if the given string is a valid $stealth option.
     *
     * @param option Option name.
     *
     * @returns True if the given string is a valid $stealth option.
     */
    private static isValidStealthOption = (
        option: string,
    ): option is UniversalStealthOption => UniversalStealthOptions.has(option as UniversalStealthOption);

    /**
     * Checks if this stealth modifier has values.
     *
     * @returns True if this stealth modifier has at least one value.
     */
    public hasValues(): boolean {
        return this.options !== StealthOption.NotSet;
    }

    /**
     * Checks if this stealth modifier is disabling the given stealth option.
     *
     * @param optionName Stealth option name.
     *
     * @returns True if this stealth modifier is disabling the given stealth option.
     */
    public hasStealthOption(optionName: StealthOptionName): boolean {
        const option = StealthOption[optionName];
        return !!(option && this.options & option);
    }
}
