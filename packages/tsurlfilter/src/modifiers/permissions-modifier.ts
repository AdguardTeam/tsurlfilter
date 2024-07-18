import { type IAdvancedModifier } from './advanced-modifier';

export const PERMISSIONS_POLICY_HEADER_NAME = 'Permissions-Policy';

const COMMA_SEPARATOR = ',';

const PIPE_SEPARATOR = '|';

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
     * Regular expression to apply correct separators.
     * It replaces escaped commas and pipe separators with commas.
     */
    private static readonly RE_SEPARATOR_REPLACE = new RegExp(`(\\\\${COMMA_SEPARATOR}|\\${PIPE_SEPARATOR})`, 'g');

    /**
     * Constructor
     * @param permissionPolicyStr
     * @param isAllowlist
     */
    constructor(permissionPolicyStr: string, isAllowlist: boolean) {
        this.permissionPolicyDirective = permissionPolicyStr
            .replace(PermissionsModifier.RE_SEPARATOR_REPLACE, COMMA_SEPARATOR);

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
    }
}
