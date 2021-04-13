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
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        this.value = value;
    }

    /**
     * Modifier value
     */
    public getValue(): string {
        return this.value;
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

        if (this.value.startsWith('~')) {
            return RemoveParamModifier.applyInvertedParam(url, this.value.substring(1));
        }

        if (this.value.startsWith('/')) {
            return utils.cleanUrlParamByRegExp(url, SimpleRegex.patternFromString(this.value));
        }

        return utils.cleanUrlParam(url, [this.value]);
    }

    /**
     * Applies exclusion param to url.
     * It removes all query parameters with the name different from param or
     * it removes all query parameters that do not match the regex regular expression.
     *
     * @param url
     * @param param
     */
    private static applyInvertedParam(url: string, param: string): string {
        if (param.startsWith('/')) {
            const regExp = SimpleRegex.patternFromString(param);
            return utils.cleanUrlParamByRegExp(url, regExp, true);
        }

        return utils.cleanUrlParam(url, [param], true);
    }
}
