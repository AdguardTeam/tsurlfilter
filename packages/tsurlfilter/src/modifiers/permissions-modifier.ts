import { type ModifierValue } from '@adguard/agtree';
import { type IAdvancedModifier } from './advanced-modifier';
import { isString } from '../utils/string-utils';

export const PERMISSIONS_POLICY_HEADER_NAME = 'Permissions-Policy';

const COMMA_SEPARATOR = ',';

const PIPE_SEPARATOR = '|';

/**
 * Permissions modifier class.
 * Allows setting permission policies, effectively blocking specific page functionality.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#permissions-modifier}
 */
export class PermissionsModifier implements IAdvancedModifier {
    /**
     * Permission Policy directive.
     */
    private readonly permissionPolicyDirective: string;

    /**
     * Regular expression to apply correct separators.
     * It replaces escaped commas and pipe separators with commas.
     */
    private static readonly RE_SEPARATOR_REPLACE = new RegExp(`(\\\\${COMMA_SEPARATOR}|\\${PIPE_SEPARATOR})`, 'g');

    private static getRawPermissionPolicyDirective(value: string | ModifierValue): string {
        if (isString(value)) {
            return value;
        }

        if (value.type !== 'Value') {
            throw new Error('Invalid $permissions rule: value must be a value');
        }

        return value.value;
    }

    /**
     * Constructor.
     *
     * @param permissionPolicy The permission policy string to be set.
     * @param isAllowlist Indicates if the permission policy is for an allowlist.
     */
    constructor(permissionPolicy: string | ModifierValue, isAllowlist: boolean) {
        const rawPermissionPolicy = PermissionsModifier.getRawPermissionPolicyDirective(permissionPolicy);

        this.permissionPolicyDirective = rawPermissionPolicy
            .replace(PermissionsModifier.RE_SEPARATOR_REPLACE, COMMA_SEPARATOR);

        PermissionsModifier.validatePermissionPolicyDirective(this.permissionPolicyDirective, isAllowlist);
    }

    /**
     * Returns permission policy allowlist string.
     *
     * @returns Permission policy allowlist string.
     */
    public getValue(): string {
        return this.permissionPolicyDirective;
    }

    /**
     * Validates permission policy directive.
     *
     * @param directive The permission policy directive to validate.
     * @param isAllowlist Indicates if the directive is for an allowlist.
     *
     * @throws SyntaxError on invalid permission policy directive.
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
