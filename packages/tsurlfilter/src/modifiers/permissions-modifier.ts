import { IAdvancedModifier } from './advanced-modifier';

export const PERMISSIONS_POLICY_HEADER_NAME = 'Permissions-Policy';

/**
 * Permissions modifier class.
 * Allows setting permission policies, effectively blocking specific page functionality.
 *
 * Learn more about it here:
 * https://adguard.com/kb/general/ad-filtering/create-own-filters/#permissions-modifier
 */
export class PermissionsModifier implements IAdvancedModifier {
    /**
     * Permission Policy directive
     */
    private readonly permissionPolicyDirective: string;

    /**
     * Constructor
     * @param permissionPolicyStr
     * @param isAllowlist
     */
    constructor(permissionPolicyStr: string, isAllowlist: boolean) {
        this.permissionPolicyDirective = permissionPolicyStr;
        PermissionsModifier.validatePermissionPolicyDirective(this.permissionPolicyDirective, isAllowlist);
    }

    /**
     * Returns permission policy allowlist string
     * @returns permission policy allowlist string
     */
    public getValue(): string {
        return this.permissionPolicyDirective;
    }

    /**
     * Validates permission policy directive
     * @throws SyntaxError on invalid permission policy directive
     */
    public static validatePermissionPolicyDirective(directive: string, isAllowlist: boolean): void {
        /**
         * $permissions modifier value may be empty only in case of allowlist rule,
         * it means to disable all $permissions rules matching the rule pattern.
        */
        if (!isAllowlist && !directive) {
            throw new SyntaxError('Invalid $permissions rule: permissions directive must not be empty');
        }

        if (isAllowlist && directive) {
            throw new SyntaxError(`Allowlist $permissions rule should not have directive specified: "${directive}"`);
        }
    }
}
