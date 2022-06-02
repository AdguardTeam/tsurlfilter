import * as utils from '../utils/url';
import { IAdvancedModifier } from './advanced-modifier';
import { SimpleRegex } from '../rules/simple-regex';

/**
 * Query parameters filtering modifier class
 * Works with '$removeparam' modifier
 */
export class RemoveParamModifier implements IAdvancedModifier {
    /**
     * Value
     */
    private readonly value: string;

    /**
     * Is modifier valid for MV3 or not
     */
    private readonly mv3Valid: boolean = true;

    /**
     * RegExp to apply
     */
    private readonly valueRegExp: RegExp;

    /**
     * Constructor
     *
     * @param value
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

            this.valueRegExp = new RegExp(`((^|&)(${SimpleRegex.escapeRegexSpecials(rawValue)})=[^&#]*)`, 'g');
        }
    }

    /**
     * Modifier value
     */
    public getValue(): string {
        return this.value;
    }

    /**
     * Is modifier valid for MV3 or not
     */
    public getmv3Validity(): boolean {
        return this.mv3Valid;
    }

    /**
     * Removes query parameters from url
     *
     * @param url
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
            return utils.cleanUrlParamByRegExp(url, this.valueRegExp, true);
        }

        return utils.cleanUrlParamByRegExp(url, this.valueRegExp);
    }
}
