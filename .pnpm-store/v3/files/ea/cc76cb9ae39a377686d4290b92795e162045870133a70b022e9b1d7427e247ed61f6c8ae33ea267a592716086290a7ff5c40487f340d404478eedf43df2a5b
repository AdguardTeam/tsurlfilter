import { ErrorStatusCodes } from './../common/constants';
import * as utils from '../utils/url';
import { IAdvancedModifier } from './advanced-modifier';
import { SimpleRegex } from '../rules/simple-regex';
import { SEPARATOR } from '../common/constants';

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
     * Value list
     */
    private readonly valueList: string[] = [];

    /**
     * RegExp to apply
     */
    private readonly valueRegExp: RegExp;

    /**
     * MV3 error code
     */
    private readonly errorMv3: ErrorStatusCodes | undefined;

    /**
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        this.value = value;

        let rawValue = value;
        if (value.startsWith('~')) {
            rawValue = value.substring(1);
            this.errorMv3 = ErrorStatusCodes.RemoveparamInversionIsNotSupported;
        }

        if (rawValue.startsWith('/')) {
            this.valueRegExp = SimpleRegex.patternFromString(rawValue);
            this.errorMv3 = ErrorStatusCodes.RemoveparamRegexpIsNotSupported;
        } else {
            this.valueRegExp = new RegExp(`((^|&)(${SimpleRegex.escapeRegexSpecials(rawValue)})=[^&#]*)`, 'g');
        }

        if (!this.errorMv3 && rawValue.length !== 0) {
            this.valueList = rawValue.split(SEPARATOR);

            if (this.valueList.some((param) => param.startsWith('~'))) {
                this.errorMv3 = ErrorStatusCodes.RemoveparamInversionIsNotSupported;
            }
        }
    }

    /**
     * Modifier value
     */
    public getValue(): string {
        return this.value;
    }

    /**
     * Modifier value list
     */
    public getValueList(): string[] {
        return this.valueList;
    }

    /**
     * MV3 error code
     */
    public getErrorMv3(): ErrorStatusCodes | undefined {
        return this.errorMv3;
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
