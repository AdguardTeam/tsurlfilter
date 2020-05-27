import Scriptlets from 'scriptlets';
import { IAdvancedModifier } from './advanced-modifier';

/**
 * Redirect modifier class
 */
export class RedirectModifier implements IAdvancedModifier {
    /**
     * Value
     */
    private readonly redirectTitle: string;

    /**
     * Constructor
     *
     * @param value
     * @param ruleText
     */
    constructor(value: string, ruleText: string) {
        RedirectModifier.validate(ruleText, value);

        this.redirectTitle = value;
    }

    /**
     * Redirect title
     */
    getValue(): string {
        return this.redirectTitle;
    }

    /**
     * Validates redirect rule
     *
     * @param ruleText
     * @param redirectTitle
     */
    private static validate(ruleText: string, redirectTitle: string): void {
        if (!redirectTitle) {
            throw new Error(`Invalid $redirect rule: Redirect value must not be empty: ${ruleText}`);
        }

        const { redirects } = Scriptlets;
        if (!redirects.isAdgRedirectRule(ruleText) || !redirects.isValidAdgRedirectRule(ruleText)) {
            throw new Error(`Rule redirect modifier is invalid: ${ruleText}`);
        }
    }
}
