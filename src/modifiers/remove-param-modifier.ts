import * as utils from '../utils/utils';
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
     * @param isWhitelist
     */
    constructor(value: string, isWhitelist: boolean) {
        if (!isWhitelist && !value) {
            throw new Error('Rule removeparam modifier is invalid: removeparam directive must not be empty');
        }

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
        const parts = utils.splitByDelimiterWithEscapeCharacter(this.value, '|', '\\', true);

        const plainParams = parts.filter((x) => !x.startsWith('/'));
        const regexpParams = parts.filter((x) => x.startsWith('/')).map(SimpleRegex.patternFromString);

        let result = utils.cleanUrlParam(url, plainParams);

        regexpParams.forEach((x) => {
            result = utils.cleanUrlParamByRegExp(result, x);
        });

        return result;
    }
}
