import { splitByDelimiterWithEscapeCharacter } from '../utils/utils';
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

        const parts = splitByDelimiterWithEscapeCharacter(this.value, '|', '\\', true);

        const invertedParams = parts.filter((x) => x.startsWith('~'));
        if (invertedParams.length > 0) {
            if (invertedParams.length !== 1) {
                // Remove all query if more than one inverted param is presented
                return url.substring(0, sepIndex);
            }

            return RemoveParamModifier.applyInvertedParam(url, invertedParams[0].substring(1));
        }

        const plainParams = parts.filter((x) => !x.startsWith('/'));
        const regexpParams = parts.filter((x) => x.startsWith('/')).map(SimpleRegex.patternFromString);

        let result = utils.cleanUrlParam(url, plainParams);

        regexpParams.forEach((x) => {
            result = utils.cleanUrlParamByRegExp(result, x);
        });

        return result;
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
