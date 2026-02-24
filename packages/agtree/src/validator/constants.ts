/**
 * Prefixes for error messages used in modifier validation.
 */
export const VALIDATION_ERROR_PREFIX = {
    BLOCK_ONLY: 'Only blocking rules may contain the modifier',
    CONFLICTS_WITH: 'Modifier conflicts with',
    EXCEPTION_ONLY: 'Only exception rules may contain the modifier',
    INVALID_CSP_DIRECTIVES: 'Invalid CSP directives for the modifier',
    INVALID_LIST_VALUES: 'Invalid values for the modifier',
    INVALID_NOOP: 'Invalid noop modifier',
    INVALID_PERMISSION_DIRECTIVE: 'Invalid Permissions-Policy directive for the modifier',
    INVALID_PERMISSION_ORIGINS: 'Origins in the value is invalid for the modifier and the directive',
    INVALID_PERMISSION_ORIGIN_QUOTES: 'Double quotes should be used for origins in the value of the modifier',
    INVALID_REFERRER_POLICY_DIRECTIVE: 'Invalid Referrer-Policy directive for the modifier',
    MIXED_NEGATIONS: 'Simultaneous usage of negated and not negated values is forbidden for the modifier',
    NO_CSP_VALUE: 'No CSP value for the modifier and the directive',
    NO_CSP_DIRECTIVE_QUOTE: 'CSP directives should no be quoted for the modifier',
    NO_UNESCAPED_PERMISSION_COMMA: 'Unescaped comma in the value is not allowed for the modifier',
    // TODO: implement later for $scp and $permissions
    // NO_VALUE_ONLY_FOR_EXCEPTION: 'Modifier without value can be used only in exception rules',
    NOT_EXISTENT: 'Non-existent modifier',
    NOT_NEGATABLE_MODIFIER: 'Non-negatable modifier',
    NOT_NEGATABLE_VALUE: 'Values cannot be negated for the modifier',
    NOT_SUPPORTED: '%s does not support the modifier',
    REMOVED: 'Removed and no longer supported modifier',
    VALUE_FORBIDDEN: 'Value is not allowed for the modifier',
    VALUE_INVALID: 'Value is invalid for the modifier',
    VALUE_REQUIRED: 'Value is required for the modifier',
};

/**
 * Prefixes for error messages related to issues in the source YAML files' data.
 */
export const SOURCE_DATA_ERROR_PREFIX = {
    INVALID_VALUE_FORMAT_REGEXP: "Invalid regular expression in 'value_format' for the modifier",
    NO_DEPRECATION_MESSAGE: "Property 'deprecation_message' is required for the 'deprecated' modifier",
    NO_VALUE_FORMAT_FOR_ASSIGNABLE: "Property 'value_format' should be specified for the assignable modifier",
};
