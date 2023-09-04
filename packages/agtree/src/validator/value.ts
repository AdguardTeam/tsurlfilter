import XRegExp from 'xregexp';

import {
    type Modifier,
    type ListItem,
    type PipeSeparator,
    type AppList,
    type DomainList,
    type MethodList,
    type StealthOptionList,
} from '../parser/common';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { AppListParser } from '../parser/misc/app-list';
import { DomainListParser } from '../parser/misc/domain-list';
import { MethodListParser } from '../parser/misc/method-list';
import { StealthOptionListParser } from '../parser/misc/stealth-option-list';
import { DomainUtils } from '../utils/domain';
import { QuoteType, QuoteUtils } from '../utils/quotes';
import {
    BACKSLASH,
    CLOSE_PARENTHESIS,
    COMMA,
    DOT,
    EQUALS,
    OPEN_PARENTHESIS,
    PIPE_MODIFIER_SEPARATOR,
    SEMICOLON,
    SPACE,
    WILDCARD,
} from '../utils/constants';
import { type ValidationResult, getInvalidValidationResult, getValueRequiredValidationResult } from './helpers';
import {
    ALLOWED_CSP_DIRECTIVES,
    ALLOWED_METHODS,
    ALLOWED_PERMISSION_DIRECTIVES,
    ALLOWED_STEALTH_OPTIONS,
    APP_NAME_ALLOWED_CHARS,
    EMPTY_PERMISSIONS_ALLOWLIST,
    PERMISSIONS_TOKEN_SELF,
    SOURCE_DATA_ERROR_PREFIX,
    VALIDATION_ERROR_PREFIX,
} from './constants';

/**
 * Type of the list of items separated by pipe `|`.
 */
type PipeSeparatedList = AppList | DomainList | MethodList | StealthOptionList;

/**
 * Pre-defined available validators for modifiers with custom `value_format`.
 */
const enum CustomValueFormatValidatorName {
    App = 'pipe_separated_apps',
    Csp = 'csp_value',
    // there are some differences between $domain and $denyallow
    DenyAllow = 'pipe_separated_denyallow_domains',
    Domain = 'pipe_separated_domains',
    Method = 'pipe_separated_methods',
    Permissions = 'permissions_value',
    StealthOption = 'pipe_separated_stealth_options',
}

/**
 * Checks whether the `chunk` of app name (which if splitted by dot `.`) is valid.
 * Only letters, numbers, and underscore `_` are allowed.
 *
 * @param chunk Chunk of app name to check.
 *
 * @returns True if the `chunk` is valid part of app name, false otherwise.
 */
const isValidAppNameChunk = (chunk: string): boolean => {
    // e.g. 'Example..exe'
    if (chunk.length === 0) {
        return false;
    }

    for (let i = 0; i < chunk.length; i += 1) {
        const char = chunk[i];
        if (!APP_NAME_ALLOWED_CHARS.has(char)) {
            return false;
        }
    }

    return true;
};

/**
 * Checks whether the given `value` is valid app name as $app modifier value.
 *
 * @param value App name to check.
 *
 * @returns True if the `value` is valid app name, false otherwise.
 */
const isValidAppModifierValue = (value: string): boolean => {
    // $app modifier does not support wildcard tld
    // https://adguard.app/kb/general/ad-filtering/create-own-filters/#app-modifier
    if (value.includes(WILDCARD)) {
        return false;
    }

    return value
        .split(DOT)
        .every((chunk) => isValidAppNameChunk(chunk));
};

/**
 * Checks whether the given `value` is valid HTTP method as $method modifier value.
 *
 * @param value Method to check.
 *
 * @returns True if the `value` is valid HTTP method, false otherwise.
 */
const isValidMethodModifierValue = (value: string): boolean => {
    return ALLOWED_METHODS.has(value);
};

/**
 * Checks whether the given `value` is valid option as $stealth modifier value.
 *
 * @param value Stealth option to check.
 *
 * @returns True if the `value` is valid stealth option, false otherwise.
 */
const isValidStealthModifierValue = (value: string): boolean => {
    return ALLOWED_STEALTH_OPTIONS.has(value);
};

/**
 * Checks whether the given `rawOrigin` is valid as Permissions Allowlist origin.
 *
 * @see {@link https://w3c.github.io/webappsec-permissions-policy/#allowlists}
 *
 * @param rawOrigin The raw origin.
 *
 * @returns True if the origin is valid, false otherwise.
 */
const isValidPermissionsOrigin = (rawOrigin: string): boolean => {
    // origins should be quoted by double quote
    const actualQuoteType = QuoteUtils.getStringQuoteType(rawOrigin);
    if (actualQuoteType !== QuoteType.Double) {
        return false;
    }

    const origin = QuoteUtils.removeQuotes(rawOrigin);
    try {
        // validate the origin by URL constructor
        // https://w3c.github.io/webappsec-permissions-policy/#algo-parse-policy-directive
        new URL(origin);
    } catch (e) {
        return false;
    }

    return true;
};

/**
 * Checks whether the given `value` is valid domain as $denyallow modifier value.
 * Important: wildcard tld are not supported, compared to $domain.
 *
 * @param value Value to check.
 *
 * @returns True if the `value` is valid domain and does not contain wildcard `*`, false otherwise.
 */
const isValidDenyAllowModifierValue = (value: string): boolean => {
    // $denyallow modifier does not support wildcard tld
    // https://adguard.app/kb/general/ad-filtering/create-own-filters/#denyallow-modifier
    // but here we are simply checking whether the value contains wildcard `*`, not ends with `.*`
    if (value.includes(WILDCARD)) {
        return false;
    }
    // TODO: add cache for domains validation
    return DomainUtils.isValidDomainOrHostname(value);
};

/**
 * Checks whether the given `value` is valid domain as $domain modifier value.
 *
 * @param value Value to check.
 *
 * @returns True if the `value` is valid domain, false otherwise.
 */
const isValidDomainModifierValue = (value: string): boolean => {
    // TODO: add cache for domains validation
    return DomainUtils.isValidDomainOrHostname(value);
};

/**
 * Checks whether the all list items' exceptions are `false`.
 * Those items which `exception` is `true` is to be specified in the validation result error message.
 *
 * @param modifierName Modifier name.
 * @param listItems List items to check.
 *
 * @returns Validation result.
 */
const customNoNegatedListItemsValidator = (modifierName: string, listItems: ListItem[]): ValidationResult => {
    const negatedValues: string[] = [];

    listItems.forEach((listItem) => {
        if (listItem.exception) {
            negatedValues.push(listItem.value);
        }
    });

    if (negatedValues.length > 0) {
        const valuesToStr = QuoteUtils.quoteAndJoinStrings(negatedValues);
        return getInvalidValidationResult(
            `${VALIDATION_ERROR_PREFIX.NOT_NEGATABLE_VALUE}: '${modifierName}': ${valuesToStr}`,
        );
    }

    return { valid: true };
};

/**
 * Checks whether the all list items' exceptions are consistent,
 * i.e. all items are either negated or not negated.
 *
 * The `exception` value of the first item is used as a reference, and all other items are checked against it.
 * Those items which `exception` is not consistent with the first item
 * is to be specified in the validation result error message.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#method-modifier}
 *
 * @param modifierName Modifier name.
 * @param listItems List items to check.
 *
 * @returns Validation result.
 */
const customConsistentExceptionsValidator = (modifierName: string, listItems: ListItem[]): ValidationResult => {
    const firstException = listItems[0].exception;

    const nonConsistentItemValues: string[] = [];

    listItems.forEach((listItem) => {
        if (listItem.exception !== firstException) {
            nonConsistentItemValues.push(listItem.value);
        }
    });

    if (nonConsistentItemValues.length > 0) {
        const valuesToStr = QuoteUtils.quoteAndJoinStrings(nonConsistentItemValues);
        return getInvalidValidationResult(
            `${VALIDATION_ERROR_PREFIX.MIXED_NEGATIONS}: '${modifierName}': ${valuesToStr}`,
        );
    }

    return { valid: true };
};

/**
 * Checks whether the given `modifier` value is valid.
 * Supposed to validate the value of modifiers which values are lists separated by pipe `|` —
 * $app, $domain, $denyallow, $method.
 *
 * @param modifier Modifier AST node.
 * @param listParser Parser function for parsing modifier value
 * which is supposed to be a list separated by pipe `|`.
 * @param isValidListItem Predicate function for checking of modifier's list item validity,
 * e.g. $denyallow modifier does not support wildcard tld, but $domain does.
 * @param customListValidator Optional; custom validator for specific modifier,
 * e.g. $denyallow modifier does not support negated domains.
 *
 * @returns Result of modifier domains validation.
 */
const validateListItemsModifier = (
    modifier: Modifier,
    listParser: (raw: string, separator?: PipeSeparator) => PipeSeparatedList,
    isValidListItem: (listItem: string) => boolean,
    customListValidator?: (modifierName: string, list: ListItem[]) => ValidationResult,
): ValidationResult => {
    const modifierName = modifier.modifier.value;
    const defaultInvalidValueResult = getValueRequiredValidationResult(modifierName);

    if (!modifier.value?.value) {
        return defaultInvalidValueResult;
    }

    let theList: PipeSeparatedList;
    try {
        theList = listParser(modifier.value.value, PIPE_MODIFIER_SEPARATOR);
    } catch (e: unknown) {
        if (e instanceof AdblockSyntaxError) {
            return {
                valid: false,
                error: e.message,
            };
        }
        return defaultInvalidValueResult;
    }

    const invalidListItems: string[] = [];
    theList.children.forEach((item) => {
        // different validators are used for $denyallow and $domain modifiers
        // because of different requirements and restrictions
        if (!isValidListItem(item.value)) {
            invalidListItems.push(item.value);
        }
    });

    if (invalidListItems.length > 0) {
        const itemsToStr = QuoteUtils.quoteAndJoinStrings(invalidListItems);
        return getInvalidValidationResult(
            `${VALIDATION_ERROR_PREFIX.INVALID_LIST_VALUES}: '${modifierName}': ${itemsToStr}`,
        );
    }

    // IMPORTANT: run custom validator after all other checks
    // Some lists should be fully checked, not just the list items:
    // e.g. Safari does not support allowed and disallowed domains for $domain in the same list
    // or   domains cannot be negated for $denyallow modifier
    if (customListValidator) {
        return customListValidator(modifierName, theList.children);
    }

    return { valid: true };
};

/**
 * Validates 'pipe_separated_apps' custom value format.
 * Used for $app modifier.
 *
 * @param modifier Modifier AST node.
 *
 * @returns Validation result.
 */
const validatePipeSeparatedApps = (modifier: Modifier): ValidationResult => {
    return validateListItemsModifier(
        modifier,
        (raw: string) => AppListParser.parse(raw),
        isValidAppModifierValue,
    );
};

/**
 * Validates 'pipe_separated_denyallow_domains' custom value format.
 * Used for $denyallow modifier.
 *
 * @param modifier Modifier AST node.
 *
 * @returns Validation result.
 */
const validatePipeSeparatedDenyAllowDomains = (modifier: Modifier): ValidationResult => {
    return validateListItemsModifier(
        modifier,
        DomainListParser.parse,
        isValidDenyAllowModifierValue,
        customNoNegatedListItemsValidator,
    );
};

/**
 * Validates 'pipe_separated_domains' custom value format.
 * Used for $domains modifier.
 *
 * @param modifier Modifier AST node.
 *
 * @returns Validation result.
 */
const validatePipeSeparatedDomains = (modifier: Modifier): ValidationResult => {
    return validateListItemsModifier(
        modifier,
        DomainListParser.parse,
        isValidDomainModifierValue,
    );
};

/**
 * Validates 'pipe_separated_methods' custom value format.
 * Used for $method modifier.
 *
 * @param modifier Modifier AST node.
 *
 * @returns Validation result.
 */
const validatePipeSeparatedMethods = (modifier: Modifier): ValidationResult => {
    return validateListItemsModifier(
        modifier,
        (raw: string) => MethodListParser.parse(raw),
        isValidMethodModifierValue,
        customConsistentExceptionsValidator,
    );
};

/**
 * Validates 'pipe_separated_stealth_options' custom value format.
 * Used for $stealth modifier.
 *
 * @param modifier Modifier AST node.
 *
 * @returns Validation result.
 */
const validatePipeSeparatedStealthOptions = (modifier: Modifier): ValidationResult => {
    return validateListItemsModifier(
        modifier,
        (raw: string) => StealthOptionListParser.parse(raw),
        isValidStealthModifierValue,
        customNoNegatedListItemsValidator,
    );
};

/**
 * Validates `csp_value` custom value format.
 * Used for $csp modifier.
 *
 * @param modifier Modifier AST node.
 *
 * @returns Validation result.
 */
const validateCspValue = (modifier: Modifier): ValidationResult => {
    const modifierName = modifier.modifier.value;
    if (!modifier.value?.value) {
        return getValueRequiredValidationResult(modifierName);
    }

    // $csp modifier value may contain multiple directives
    // e.g. "csp=child-src 'none'; frame-src 'self' *; worker-src 'none'"
    const policyDirectives = modifier.value.value
        .split(SEMICOLON)
        // rule with $csp modifier may end with semicolon
        // e.g. "$csp=sandbox allow-same-origin;"
        // TODO: add predicate helper for `(i) => !!i`
        .filter((i) => !!i);

    const invalidValueValidationResult = getInvalidValidationResult(
        `${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}': "${modifier.value.value}"`,
    );

    if (policyDirectives.length === 0) {
        return invalidValueValidationResult;
    }

    const invalidDirectives: string[] = [];

    for (let i = 0; i < policyDirectives.length; i += 1) {
        const policyDirective = policyDirectives[i].trim();
        if (!policyDirective) {
            return invalidValueValidationResult;
        }

        const chunks = policyDirective.split(SPACE);
        const [directive, ...valueChunks] = chunks;

        // e.g. "csp=child-src 'none'; ; worker-src 'none'"
        // validator it here          ↑
        if (!directive) {
            return invalidValueValidationResult;
        }

        if (!ALLOWED_CSP_DIRECTIVES.has(directive)) {
            // e.g. "csp='child-src' 'none'"
            if (ALLOWED_CSP_DIRECTIVES.has(QuoteUtils.removeQuotes(directive))) {
                return getInvalidValidationResult(
                    `${VALIDATION_ERROR_PREFIX.NO_CSP_DIRECTIVE_QUOTE}: '${modifierName}': ${directive}`,
                );
            }

            invalidDirectives.push(directive);
            continue;
        }

        if (valueChunks.length === 0) {
            return getInvalidValidationResult(
                `${VALIDATION_ERROR_PREFIX.NO_CSP_VALUE}: '${modifierName}': '${directive}'`,
            );
        }
    }

    if (invalidDirectives.length > 0) {
        const directivesToStr = QuoteUtils.quoteAndJoinStrings(invalidDirectives, QuoteType.Double);
        return getInvalidValidationResult(
            `${VALIDATION_ERROR_PREFIX.INVALID_CSP_DIRECTIVES}: '${modifierName}': ${directivesToStr}`,
        );
    }

    return { valid: true };
};

/**
 * Validates permission allowlist origins in the value of $permissions modifier.
 *
 * @see {@link https://w3c.github.io/webappsec-permissions-policy/#allowlists}
 *
 * @param allowlistChunks Array of allowlist chunks.
 * @param directive Permission directive name.
 * @param modifierName Modifier name.
 *
 * @returns Validation result.
 */
const validatePermissionAllowlistOrigins = (
    allowlistChunks: string[],
    directive: string,
    modifierName: string,
): ValidationResult => {
    const invalidOrigins: string[] = [];

    for (let i = 0; i < allowlistChunks.length; i += 1) {
        const chunk = allowlistChunks[i].trim();
        // skip few spaces between origins (they were splitted by space)
        // e.g. 'geolocation=("https://example.com"  "https://*.example.com")'
        if (chunk.length === 0) {
            continue;
        }
        /**
         * 'self' should be checked case-insensitively
         *
         * @see {@link https://w3c.github.io/webappsec-permissions-policy/#algo-parse-policy-directive}
         *
         * @example 'geolocation=(self)'
         */
        if (chunk.toLowerCase() === PERMISSIONS_TOKEN_SELF) {
            continue;
        }
        if (QuoteUtils.getStringQuoteType(chunk) !== QuoteType.Double) {
            return getInvalidValidationResult(
                // eslint-disable-next-line max-len
                `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGIN_QUOTES}: '${modifierName}': '${directive}': '${QuoteUtils.removeQuotes(chunk)}'`,
            );
        }
        if (!isValidPermissionsOrigin(chunk)) {
            invalidOrigins.push(chunk);
        }
    }

    if (invalidOrigins.length > 0) {
        const originsToStr = QuoteUtils.quoteAndJoinStrings(invalidOrigins);
        return getInvalidValidationResult(
            // eslint-disable-next-line max-len
            `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_ORIGINS}: '${modifierName}': '${directive}': ${originsToStr}`,
        );
    }

    return { valid: true };
};

/**
 * Validates permission allowlist in the modifier value.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy#allowlists}
 * @see {@link https://w3c.github.io/webappsec-permissions-policy/#allowlists}
 *
 * @param allowlist Allowlist value.
 * @param directive Permission directive name.
 * @param modifierName Modifier name.
 *
 * @returns Validation result.
 */
const validatePermissionAllowlist = (
    allowlist: string,
    directive: string,
    modifierName: string,
): ValidationResult => {
    // `*` is one of available permissions tokens
    // e.g. 'fullscreen=*'
    // https://w3c.github.io/webappsec-permissions-policy/#structured-header-serialization
    if (allowlist === WILDCARD
        // e.g. 'autoplay=()'
        || allowlist === EMPTY_PERMISSIONS_ALLOWLIST) {
        return { valid: true };
    }

    if (!(allowlist.startsWith(OPEN_PARENTHESIS) && allowlist.endsWith(CLOSE_PARENTHESIS))) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}'`);
    }

    const allowlistChunks = allowlist.slice(1, -1).split(SPACE);
    return validatePermissionAllowlistOrigins(allowlistChunks, directive, modifierName);
};

/**
 * Validates single permission in the modifier value.
 *
 * @param permission Single permission value.
 * @param modifierName Modifier name.
 * @param modifierValue Modifier value.
 *
 * @returns Validation result.
 */
const validateSinglePermission = (
    permission: string,
    modifierName: string,
    modifierValue: string,
): ValidationResult => {
    // empty permission in the rule
    // e.g. 'permissions=storage-access=()\\, \\, camera=()'
    // the validator is here                 ↑
    if (!permission) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}'`);
    }

    if (permission.includes(COMMA)) {
        return getInvalidValidationResult(
            `${VALIDATION_ERROR_PREFIX.NO_UNESCAPED_PERMISSION_COMMA}: '${modifierName}': '${modifierValue}'`,
        );
    }

    const [directive, allowlist] = permission.split(EQUALS);
    if (!ALLOWED_PERMISSION_DIRECTIVES.has(directive)) {
        return getInvalidValidationResult(
            `${VALIDATION_ERROR_PREFIX.INVALID_PERMISSION_DIRECTIVE}: '${modifierName}': '${directive}'`,
        );
    }

    return validatePermissionAllowlist(allowlist, directive, modifierName);
};

/**
 * Validates `permissions_value` custom value format.
 * Used for $permissions modifier.
 *
 * @param modifier Modifier AST node.
 *
 * @returns Validation result.
 */
const validatePermissions = (modifier: Modifier): ValidationResult => {
    if (!modifier.value?.value) {
        return getValueRequiredValidationResult(modifier.modifier.value);
    }

    const modifierName = modifier.modifier.value;
    const modifierValue = modifier.value.value;

    // multiple permissions may be separated by escaped commas
    const permissions = modifier.value.value.split(`${BACKSLASH}${COMMA}`);

    for (let i = 0; i < permissions.length; i += 1) {
        const permission = permissions[i].trim();

        const singlePermissionValidationResult = validateSinglePermission(permission, modifierName, modifierValue);
        if (!singlePermissionValidationResult.valid) {
            return singlePermissionValidationResult;
        }
    }

    return { valid: true };
};

/**
 * Map of all available pre-defined validators for modifiers with custom `value_format`.
 */
const CUSTOM_VALUE_FORMAT_MAP = {
    [CustomValueFormatValidatorName.App]: validatePipeSeparatedApps,
    [CustomValueFormatValidatorName.Csp]: validateCspValue,
    [CustomValueFormatValidatorName.DenyAllow]: validatePipeSeparatedDenyAllowDomains,
    [CustomValueFormatValidatorName.Domain]: validatePipeSeparatedDomains,
    [CustomValueFormatValidatorName.Method]: validatePipeSeparatedMethods,
    [CustomValueFormatValidatorName.Permissions]: validatePermissions,
    [CustomValueFormatValidatorName.StealthOption]: validatePipeSeparatedStealthOptions,
};

/**
 * Returns whether the given `valueFormat` is a valid custom value format validator name.
 *
 * @param valueFormat Value format for the modifier.
 *
 * @returns True if `valueFormat` is a supported pre-defined value format validator name, false otherwise.
 */
const isCustomValueFormatValidator = (valueFormat: string): valueFormat is CustomValueFormatValidatorName => {
    return Object.keys(CUSTOM_VALUE_FORMAT_MAP).includes(valueFormat);
};

/**
 * Checks whether the value for given `modifier` is valid.
 *
 * @param modifier Modifier AST node.
 * @param valueFormat Value format for the modifier.
 *
 * @returns Validation result.
 */
export const validateValue = (modifier: Modifier, valueFormat: string): ValidationResult => {
    if (isCustomValueFormatValidator(valueFormat)) {
        const validator = CUSTOM_VALUE_FORMAT_MAP[valueFormat];
        return validator(modifier);
    }

    const modifierName = modifier.modifier.value;

    if (!modifier.value?.value) {
        return getValueRequiredValidationResult(modifierName);
    }

    let xRegExp;
    try {
        xRegExp = XRegExp(valueFormat);
    } catch (e) {
        throw new Error(`${SOURCE_DATA_ERROR_PREFIX.INVALID_VALUE_FORMAT_REGEXP}: '${modifierName}'`);
    }

    const isValid = xRegExp.test(modifier.value?.value);
    if (!isValid) {
        return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.VALUE_INVALID}: '${modifierName}'`);
    }

    return { valid: true };
};
