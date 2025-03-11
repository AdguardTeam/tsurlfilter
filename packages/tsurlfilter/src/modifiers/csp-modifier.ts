import { type ModifierValue } from '@adguard/agtree';
import { type IAdvancedModifier } from './advanced-modifier';
import { isString } from '../utils/string-utils';

export const CSP_HEADER_NAME = 'Content-Security-Policy';

/**
 * Csp modifier class.
 */
export class CspModifier implements IAdvancedModifier {
    /**
     * Csp directive.
     *
     * @returns The CSP directive.
     */
    private readonly cspDirective: string;

    /**
     * Is allowlist rule.
     */
    private readonly isAllowlist: boolean;

    private static getRawCspDirective(value: string | ModifierValue): string {
        if (isString(value)) {
            return value;
        }

        if (value.type !== 'Value') {
            throw new Error('Invalid $CSP rule: value must be a string');
        }

        return value.value;
    }

    /**
     * Constructor.
     *
     * @param value Value of the modifier.
     * @param isAllowlist Whether the rule is an allowlist rule or not.
     */
    constructor(value: string | ModifierValue, isAllowlist: boolean) {
        this.cspDirective = CspModifier.getRawCspDirective(value);
        this.isAllowlist = isAllowlist;

        this.validateCspDirective();
    }

    /**
     * Csp directive.
     *
     * @returns The CSP directive.
     */
    getValue(): string {
        return this.cspDirective;
    }

    /**
     * Validates CSP rule.
     */
    private validateCspDirective(): void {
        /**
         * CSP directive may be empty in case of allowlist rule,
         * it means to disable all $csp rules matching the allowlist rule.
         *
         * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/685}
         */
        if (!this.isAllowlist && !this.cspDirective) {
            throw new Error('Invalid $CSP rule: CSP directive must not be empty');
        }

        if (this.cspDirective) {
            /**
             * Forbids report-to and report-uri directives.
             *
             * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/685#issue-228287090}
             */
            const cspDirective = this.cspDirective.toLowerCase();
            if (cspDirective.indexOf('report-') >= 0) {
                throw new Error(`Forbidden CSP directive: ${cspDirective}`);
            }
        }
    }
}
