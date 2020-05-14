import Scriptlets from 'scriptlets';
import { IAdvancedModifier } from './advanced-modifier';

/**
 * Redirect modifier class
 */
export class RedirectModifier implements IAdvancedModifier {
    /**
     * Value
     */
    private readonly redirectValue: string;

    /**
     * Constructor
     *
     * @param value
     * @param ruleText
     */
    constructor(value: string, ruleText: string) {
        this.redirectValue = value;

        this.validate(ruleText);

        // function RedirectOption(option) {
        //     const getRedirectUrl = () => adguard.rules.RedirectFilterService.buildRedirectUrl(option);
        //     return { getRedirectUrl, redirectTitle: option };
        // }
    }

    /**
     * Redirect value
     */
    getValue(): string {
        return this.redirectValue;
    }

    /**
     * Validates redirect rule
     *
     * @param ruleText
     */
    private validate(ruleText: string): void {
        if (!this.redirectValue) {
            throw new Error(`Invalid $redirect rule: Redirect value must not be empty: ${ruleText}`);
        }

        const { redirects } = Scriptlets;
        if (!redirects.isAdgRedirectRule(ruleText) || !redirects.isValidAdgRedirectRule(ruleText)) {
            throw new Error(`Rule redirect modifier is invalid: ${ruleText}`);
        }
    }
}
