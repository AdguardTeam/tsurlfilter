import { SimpleRegex } from '../rules/simple-regex';
import { cleanUrlParamByRegExp } from '../utils/url';

import { type IAdvancedModifier } from './advanced-modifier';

/**
 * Query parameters filtering modifier class.
 * Works with `$removeparam` modifier.
 */
export class RemoveParamModifier implements IAdvancedModifier {
    /**
     * Value of the modifier.
     */
    private readonly value: string;

    /**
     * Is modifier valid for MV3 or not.
     *
     * @returns True if the modifier is valid for MV3, false otherwise.
     */
    private readonly mv3Valid: boolean = true;

    /**
     * RegExp to apply.
     */
    private readonly valueRegExp: RegExp;

    /**
     * Constructor.
     *
     * @param value The value used to initialize the modifier.
     */
    constructor(value: string) {
        this.value = value;

        let rawValue = value;
        // TODO: Seems like negation not using in valueRegExp
        if (value.startsWith('~')) {
            rawValue = value.substring(1);
            this.mv3Valid = false;
        }

        if (rawValue.startsWith('/')) {
            this.valueRegExp = SimpleRegex.patternFromString(rawValue);
            this.mv3Valid = false;
        } else {
            if (rawValue.includes('|')) {
                throw new Error('Unsupported option in $removeparam: multiple values are not allowed');
            }

            // no need to match "&" in the beginning, because we are splitting by "&"
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3076
            this.valueRegExp = new RegExp(`^${SimpleRegex.escapeRegexSpecials(rawValue)}=[^&#]*$`, 'g');
        }
    }

    /**
     * Modifier value.
     *
     * @returns The value of the modifier.
     */
    public getValue(): string {
        return this.value;
    }

    /**
     * Is modifier valid for MV3 or not.
     *
     * @returns True if the modifier is valid for MV3, false otherwise.
     */
    public getMV3Validity(): boolean {
        return this.mv3Valid;
    }

    /**
     * Checks if the given modifier is an instance of RemoveParamModifier.
     *
     * @param m The modifier to check.
     *
     * @returns True if the modifier is an instance of RemoveParamModifier, false otherwise.
     */
    public static isRemoveParamModifier = (m: IAdvancedModifier): m is RemoveParamModifier => {
        return m instanceof RemoveParamModifier;
    };

    /**
     * Removes query parameters from url.
     *
     * @param url The URL from which query parameters should be removed.
     *
     * @returns The URL with the query parameters removed.
     */
    public removeParameters(url: string): string {
        const sepIndex = url.indexOf('?');
        if (sepIndex < 0) {
            return url;
        }

        if (!this.value) {
            return url.substring(0, sepIndex);
        }

        if (sepIndex === url.length - 1) {
            return url;
        }

        if (this.value.startsWith('~')) {
            return cleanUrlParamByRegExp(url, this.valueRegExp, true);
        }

        return cleanUrlParamByRegExp(url, this.valueRegExp);
    }
}
