import { IAdvancedModifier } from './advanced-modifier';

export const CSP_HEADER_NAME = 'Content-Security-Policy';

/**
 * Csp modifier class
 */
export class CspModifier implements IAdvancedModifier {
    /**
     * Csp directive
     */
    private readonly cspDirective: string;

    /**
     * Is allowlist rule
     */
    private readonly isAllowlist: boolean;

    /**
     * Constructor
     *
     * @param value
     * @param isAllowlist
     */
    constructor(value: string, isAllowlist: boolean) {
        this.cspDirective = value;
        this.isAllowlist = isAllowlist;

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
         * CSP directive may be empty in case of allowlist rule,
         * it means to disable all $csp rules matching the allowlist rule
         */
        if (!this.isAllowlist && !this.cspDirective) {
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
