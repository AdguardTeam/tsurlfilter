import { isRedirectResourceCompatibleWithAdg } from '@adguard/scriptlets/validators';
import { type ModifierValue } from '@adguard/agtree';
import { type IAdvancedModifier } from './advanced-modifier';
import { isString } from '../utils/string-utils';

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

    private static getRawRedirect(value: string | ModifierValue): string {
        if (isString(value)) {
            return value;
        }

        if (value.type !== 'Value') {
            throw new Error('Invalid $redirect rule: value must be a value');
        }

        return value.value;
    }

    /**
     * Constructor.
     *
     * @param value Redirect modifier value.
     * @param isAllowlist Is allowlist rule.
     * @param isRedirectingOnlyBlocked Is redirect-rule modifier.
     */
    constructor(value: string | ModifierValue, isAllowlist: boolean, isRedirectingOnlyBlocked = false) {
        const rawRedirect = RedirectModifier.getRawRedirect(value);

        RedirectModifier.validate(rawRedirect, isAllowlist);

        this.redirectTitle = rawRedirect;
        this.isRedirectingOnlyBlocked = isRedirectingOnlyBlocked;
    }

    /**
     * Redirect title.
     *
     * @returns The redirect title.
     */
    getValue(): string {
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
