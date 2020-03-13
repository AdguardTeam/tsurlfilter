// eslint-disable-next-line max-classes-per-file
import * as utils from './utils';

/**
 * Rule advanced modifier interface
 */
export interface IAdvancedModifier {
    /**
     * Modifier value
     */
    getValue(): string;
}

/**
 * Csp modifier class
 */
export class CspModifier implements IAdvancedModifier {
    /**
     * Csp directive
     */
    private readonly cspDirective: string;

    /**
     * Is whitelist rule
     */
    private readonly isWhitelist: boolean;

    /**
     * Constructor
     *
     * @param value
     * @param isWhitelist
     */
    constructor(value: string, isWhitelist: boolean) {
        this.cspDirective = value;
        this.isWhitelist = isWhitelist;

        this.validateCspDirective();
    }

    /**
     * Csp directive
     */
    getValue(): string {
        return this.cspDirective;
    }

    /**
     * Validates CSP rule
     */
    private validateCspDirective(): void {
        /**
         * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/685
         * CSP directive may be empty in case of whitelist rule,
         * it means to disable all $csp rules matching the whitelist rule
         */
        if (!this.isWhitelist && !this.cspDirective) {
            throw new Error('Invalid $CSP rule: CSP directive must not be empty');
        }

        if (this.cspDirective) {
            /**
             * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/685#issue-228287090
             * Forbids report-to and report-uri directives
             */
            const cspDirective = this.cspDirective.toLowerCase();
            if (cspDirective.indexOf('report-') >= 0) {
                throw new Error(`Forbidden CSP directive: ${cspDirective}`);
            }
        }
    }
}

/**
 * Replace modifier class
 */
export class ReplaceModifier implements IAdvancedModifier {
    /**
     * Replace option value
     */
    private readonly replaceOption: string;

    /**
     * Replace option apply func
     */
    private readonly replaceApply: (input: string) => string;

    /**
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        const parsed = ReplaceModifier.parseReplaceOption(value);

        this.replaceOption = parsed.optionText;
        this.replaceApply = parsed.apply;
    }

    /**
     *
     * @param option
     */
    private static parseReplaceOption(option: string): { apply: (input: string) => string; optionText: string } {
        if (!option) {
            return {
                apply: (x: string): string => x,
                optionText: '',
            };
        }

        const parts = utils.splitByDelimiterWithEscapeCharacter(option, '/', '\\', true);

        if (parts.length < 2 || parts.length > 3) {
            throw new Error(`Cannot parse ${option}`);
        }

        let modifiers = (parts[2] || '');
        if (modifiers.indexOf('g') < 0) {
            modifiers += 'g';
        }

        const pattern = new RegExp(parts[0], modifiers);
        const replacement = parts[1];

        const apply = (input: string): string => input.replace(pattern, replacement);

        return {
            apply,
            optionText: option,
        };
    }

    /**
     * Replace content
     */
    getValue(): string {
        return this.replaceOption;
    }

    /**
     * Replace apply function
     */
    getApplyFunc(): (input: string) => string {
        return this.replaceApply;
    }
}
