import { type ModifierValue, type StealthOptionList, StealthOptionListParser } from '@adguard/agtree';
import { logger } from '../utils/logger';
import { isString } from '../utils/string-utils';

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
    public readonly options = StealthOption.NotSet;

    private static getStealthOptionListNode = (stealthOptions: string | ModifierValue): StealthOptionList => {
        if (isString(stealthOptions)) {
            if (!stealthOptions) {
                throw new Error('Stealth list cannot be empty');
            }

            return StealthOptionListParser.parse(stealthOptions);
        }

        if (stealthOptions.type !== 'StealthOptionList') {
            throw new Error('Unsupported modifier value type');
        }

        return stealthOptions;
    };

    /**
     * Parses the options string and creates a new stealth modifier instance.
     *
     * @param stealthOptions Options string.
     *
     * @throws SyntaxError on inverted stealth options, which are not supported.
     */
    constructor(stealthOptions: string | ModifierValue) {
        const stealthOptionListNode = StealthModifier.getStealthOptionListNode(stealthOptions);

        let options = StealthOption.NotSet;

        stealthOptionListNode.children.forEach((option) => {
            if (option.value === '') {
                return;
            }

            if (option.exception) {
                throw new SyntaxError(`Inverted stealth options are not allowed: "${stealthOptionListNode}"`);
            }

            if (!StealthModifier.isValidStealthOption(option.value)) {
                throw new SyntaxError(`Invalid stealth option in modifier value: "${stealthOptionListNode}"`);
            }

            if (!StealthModifier.isSupportedStealthOption(option.value)) {
                return;
            }

            const stealthOption = StealthOption[option.value as StealthOptionName];

            if (this.options & stealthOption) {
                logger.debug(`Duplicate stealth modifier value "${option.value}" in "${stealthOptionListNode}"`);
            }

            options |= stealthOption;
        });

        this.options = options;

        if (this.options === StealthOption.NotSet) {
            // eslint-disable-next-line max-len
            const msg = `$stealth modifier does not contain any options supported by browser extension: "${stealthOptionListNode}"`;
            logger.debug(msg);
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
