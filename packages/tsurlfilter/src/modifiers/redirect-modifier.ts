import scriptlets from '@adguard/scriptlets';
import { type IAdvancedModifier } from './advanced-modifier';

/**
 * Redirect modifier class
 */
export class RedirectModifier implements IAdvancedModifier {
    /**
     * Value
     */
    private readonly redirectTitle: string;

    /**
     * Is redirecting only blocked requests
     * See $redirect-rule options
     */
    readonly isRedirectingOnlyBlocked: boolean = false;

    /**
     * Constructor
     *
     * @param value
     * @param ruleText
     * @param isAllowlist
     * @param isRedirectingOnlyBlocked is redirect-rule modifier
     */
    constructor(value: string, isAllowlist: boolean, isRedirectingOnlyBlocked = false) {
        RedirectModifier.validate(value, isAllowlist);

        this.redirectTitle = value;
        this.isRedirectingOnlyBlocked = isRedirectingOnlyBlocked;
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
     * @param isAllowlist
     */
    private static validate(redirectTitle: string, isAllowlist: boolean): void {
        if (isAllowlist && !redirectTitle) {
            return;
        }

        if (!redirectTitle) {
            throw new SyntaxError('Invalid $redirect rule, redirect value must not be empty');
        }

        const { redirects } = scriptlets;
        if (!redirects.isRedirectResourceCompatibleWithAdg(redirectTitle)) {
            throw new SyntaxError('$redirect modifier is invalid');
        }
    }
}
