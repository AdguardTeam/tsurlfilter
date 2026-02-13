import { type Modifier } from '../nodes';
import { type ValidationResult, getInvalidValidationResult, getValueRequiredValidationResult } from './helpers';
import { SOURCE_DATA_ERROR_PREFIX, VALIDATION_ERROR_PREFIX } from './constants';
import { isString } from '../utils/type-guards';
import { isKnownValidator, validate } from '../compatibility-tables/validators';
import { ValidationContext, type ValidationIssue } from '../compatibility-tables/validators/types';

/**
 * Formats a list of values as quoted, comma-separated items: `'v1', 'v2'`.
 *
 * @param values Array of string values.
 *
 * @returns Formatted string.
 */
const formatValues = (values: unknown): string => {
    if (!Array.isArray(values)) {
        return '';
    }
    return (values as string[]).map((v) => `'${v}'`).join(', ');
};

/**
 * Checks if a string is enclosed in double quotes.
 *
 * @param s String to check.
 *
 * @returns True if double-quoted.
 */
const isDoubleQuoted = (s: string): boolean => s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"';

/**
 * Checks if an unquoted string is a valid URL.
 *
 * @param s String to check.
 *
 * @returns True if it parses as a URL.
 */
const isValidUrl = (s: string): boolean => {
    try {
        // eslint-disable-next-line no-new
        new URL(s);
        return true;
    } catch {
        return false;
    }
};

const formatPermissionsOriginError = (prefix: string, modifierName: string, modifierValue: string): string => {
    // Split by escaped commas to get individual permissions
    const permissions = modifierValue.split('\\,');
    const isQuoteError = prefix === VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES;

    for (const perm of permissions) {
        const trimmed = perm.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) {
            continue;
        }
        const directive = trimmed.slice(0, eqIdx);
        const allowlist = trimmed.slice(eqIdx + 1);

        const extractFailingOrigins = (inner: string): string[] => {
            const chunks = inner.split(/\s+/).filter((s) => s.length > 0);
            const failing: string[] = [];
            for (const chunk of chunks) {
                if (chunk.toLowerCase() === 'self') {
                    continue;
                }
                if (isQuoteError) {
                    // For quote errors: collect origins that are NOT double-quoted
                    if (!isDoubleQuoted(chunk)) {
                        failing.push(chunk.replace(/^["']|["']$/g, ''));
                    }
                } else {
                    // For URL errors: collect double-quoted origins with invalid URLs
                    const unquoted = chunk.replace(/^["']|["']$/g, '');
                    if (!isValidUrl(unquoted)) {
                        failing.push(unquoted);
                    }
                }
            }
            return failing;
        };

        // Extract items from parenthesized allowlist
        let origins: string[] = [];
        if (allowlist.startsWith('(') && allowlist.endsWith(')')) {
            origins = extractFailingOrigins(allowlist.slice(1, -1));
        } else if (allowlist.startsWith('(')) {
            origins = extractFailingOrigins(allowlist.slice(1));
        }

        if (origins.length > 0) {
            // For quote errors, only report the first problematic origin (matching old behavior)
            const reportOrigins = isQuoteError ? origins.slice(0, 1) : origins;
            const formatted = reportOrigins.map((o) => `'${o}'`).join(', ');
            return `${prefix}: '${modifierName}': '${directive}': ${formatted}`;
        }
    }
    return `${prefix}: '${modifierName}'`;
};

/**
 * Formats a permissions sub-validator error into the legacy error string.
 *
 * @param message Internal error message from the permissions validator.
 * @param modifierName Modifier name.
 * @param modifierValue Raw modifier value string.
 *
 * @returns Formatted error string.
 */
const formatPermissionsError = (message: string, modifierName: string, modifierValue: string): string => {
    if (message === 'Invalid permission directive') {
        // Extract the directive name from the value (before '=')
        const directive = modifierValue.split('\\,').pop()?.trim().split('=')[0] ?? '';
        return `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_DIRECTIVE}: '${modifierName}': '${directive}'`;
    }
    if (message === 'Double quotes should be used for origins') {
        return formatPermissionsOriginError(
            VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES,
            modifierName,
            modifierValue,
        );
    }
    if (message === 'Invalid origin URL') {
        return formatPermissionsOriginError(
            VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGINS,
            modifierName,
            modifierValue,
        );
    }
    if (message === 'Unescaped comma in permission') {
        // Get the failing permission chunk
        const failingPermission = modifierValue.split('\\,').pop()?.trim() ?? modifierValue;
        return `${VALIDATION_ERROR_PREFIX.NO_UNESCAPED_PERMISSION_COMMA}: '${modifierName}': '${failingPermission}'`;
    }
    if (message === 'Invalid allowlist format' || message === 'Empty permission') {
        return `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}'`;
    }

    return `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}'`;
};

/**
 * Converts a structured validation issue from a sub-validator
 * into the human-readable error string expected by the legacy API.
 *
 * @param issue Validation issue from the sub-validator.
 * @param modifierName Modifier name for context.
 * @param modifierValue Raw modifier value string.
 *
 * @returns Formatted error string.
 */
const formatIssueAsError = (issue: ValidationIssue, modifierName: string, modifierValue: string): string => {
    const { messageId, data } = issue;

    // Parse errors: the actual parser error message is in data.message
    if (messageId.endsWith('_PARSE_ERROR') && data?.message) {
        return String(data.message);
    }

    // Invalid list values: INVALID_*_VALUES with data.values
    if (messageId.startsWith('INVALID_') && messageId.endsWith('_VALUES') && data?.values) {
        return `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: '${modifierName}': ${formatValues(data.values)}`;
    }

    // Negated values: NEGATED_*_VALUES with data.values
    if (messageId.startsWith('NEGATED_') && messageId.endsWith('_VALUES') && data?.values) {
        return `${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_VALUE}: '${modifierName}': ${formatValues(data.values)}`;
    }

    // Mixed method negations
    if (messageId === 'MIXED_METHOD_NEGATIONS' && data?.values) {
        return `${VALIDATION_ERROR_PREFIX.MIXED_NEGATIONS}: '${modifierName}': ${formatValues(data.values)}`;
    }

    // CSP-specific errors
    if (messageId === 'INVALID_CSP_DIRECTIVES' && data?.directives) {
        const dirs = (data.directives as string[]).map((d) => `"${d}"`).join(', ');
        return `${VALIDATION_ERROR_PREFIX.INVALID_CSP_DIRECTIVES}: '${modifierName}': ${dirs}`;
    }
    if (messageId === 'CSP_DIRECTIVE_QUOTED' && data?.directive) {
        return `${VALIDATION_ERROR_PREFIX.NO_CSP_DIRECTIVE_QUOTE}: '${modifierName}': '${data.directive}'`;
    }
    if (messageId === 'CSP_DIRECTIVE_NO_VALUE' && data?.directive) {
        return `${VALIDATION_ERROR_PREFIX.NO_CSP_VALUE}: '${modifierName}': '${data.directive}'`;
    }
    if (messageId === 'EMPTY_CSP_VALUE' || messageId === 'EMPTY_CSP_DIRECTIVE' || messageId === 'NO_CSP_DIRECTIVES') {
        return `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}': "${modifierValue}"`;
    }

    // Referrer policy
    if (messageId === 'INVALID_REFERRER_POLICY_DIRECTIVE') {
        return `${VALIDATION_ERROR_PREFIX.INVALID_REFERRER_POLICY_DIRECTIVE}: '${modifierName}': '${modifierValue}'`;
    }

    // Permissions errors
    if (messageId === 'INVALID_PERMISSIONS_VALUE' && data?.message) {
        return formatPermissionsError(String(data.message), modifierName, modifierValue);
    }

    // Fallback: generic "value is invalid"
    return `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}'`;
};

/**
 * Checks whether the value for given `modifier` is valid.
 *
 * @param modifier Modifier AST node.
 * @param valueFormat Value format for the modifier.
 * @param valueFormatFlags Optional; RegExp flags for the value format.
 *
 * @returns Validation result.
 */
export const validateValue = (
    modifier: Modifier,
    valueFormat: string,
    valueFormatFlags?: string | null,
): ValidationResult => {
    const modifierName = modifier.name.value;
    const modifierValue = modifier.value?.value;

    if (isKnownValidator(valueFormat)) {
        const ctx = new ValidationContext();
        validate(valueFormat, modifierValue ?? '', ctx);

        if (!ctx.valid && ctx.issues) {
            const error = formatIssueAsError(ctx.issues[0], modifierName, modifierValue ?? '');
            return getInvalidValidationResult(error);
        }

        return { valid: true };
    }

    if (!modifierValue) {
        return getValueRequiredValidationResult(modifierName);
    }

    let regExp: RegExp;
    try {
        if (isString(valueFormatFlags)) {
            regExp = new RegExp(valueFormat, valueFormatFlags);
        } else {
            regExp = new RegExp(valueFormat);
        }
    } catch (e) {
        throw new Error(`${SOURCE_DATA_ERROR_PREFIX.INVALID_VALUE_FORMAT_REGEXP}: '${modifierName}'`);
    }

    const isValid = regExp.test(modifierValue);
    if (!isValid) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}'`);
    }

    return { valid: true };
};
