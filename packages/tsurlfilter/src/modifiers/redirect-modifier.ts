import { isRedirectResourceCompatibleWithAdg } from '@adguard/scriptlets/validators';

import { type IAdvancedModifier } from './advanced-modifier';

/**
 * Redirect modifier class.
 */
export class RedirectModifier implements IAdvancedModifier {
    /**
     * Redirect title.
     */
    private readonly redirectTitle: string;

    /**
     * Is redirecting only blocked requests
     * See $redirect-rule options.
     */
    readonly isRedirectingOnlyBlocked: boolean = false;

    /**
     * Constructor.
     *
     * @param value Redirect modifier value.
     * @param isAllowlist Is allowlist rule.
     * @param isRedirectingOnlyBlocked Is redirect-rule modifier.
     */
    constructor(value: string, isAllowlist: boolean, isRedirectingOnlyBlocked = false) {
        RedirectModifier.validate(value, isAllowlist);

        this.redirectTitle = value;
        this.isRedirectingOnlyBlocked = isRedirectingOnlyBlocked;
    }

    /**
     * Redirect title.
     *
     * @returns The redirect title.
     */
    public getValue(): string {
        return this.redirectTitle;
    }

    /**
     * Validates redirect rule.
     *
     * @param redirectTitle The title of the redirect.
     * @param isAllowlist Indicates if the rule is an allowlist rule.
     */
    private static validate(redirectTitle: string, isAllowlist: boolean): void {
        if (isAllowlist && !redirectTitle) {
            return;
        }

        if (!redirectTitle) {
            throw new SyntaxError('Invalid $redirect rule, redirect value must not be empty');
        }

        if (!isRedirectResourceCompatibleWithAdg(redirectTitle)) {
            throw new SyntaxError('$redirect modifier is invalid');
        }
    }
}
