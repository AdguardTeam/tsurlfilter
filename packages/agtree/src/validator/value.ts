import XRegExp from 'xregexp';

import {
    type Modifier,
    type ListItem,
    type PipeSeparator,
    type AppList,
    type DomainList,
    type MethodList,
} from '../parser/common';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { AppListParser } from '../parser/misc/app-list';
import { DomainListParser } from '../parser/misc/domain-list';
import { MethodListParser } from '../parser/misc/method-list';
import { DomainUtils } from '../utils/domain';
import { QuoteUtils } from '../utils/quotes';
import { DOT, PIPE_MODIFIER_SEPARATOR, WILDCARD } from '../utils/constants';
import { type ValidationResult, getInvalidValidationResult, getValueRequiredValidationResult } from './helpers';
import {
    ALLOWED_METHODS,
    APP_NAME_ALLOWED_CHARS,
    SOURCE_DATA_ERROR_PREFIX,
    VALIDATION_ERROR_PREFIX,
} from './constants';

/**
 * Pre-defined available validators for modifiers with custom `value_format`.
 */
const enum CustomValueFormatValidatorName {
    App = 'pipe_separated_apps',
    // there are some differences between $domain and $denyallow
    DenyAllow = 'pipe_separated_denyallow_domains',
    Domain = 'pipe_separated_domains',
    Method = 'pipe_separated_methods',
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
    listParser: (raw: string, separator?: PipeSeparator) => AppList | DomainList | MethodList,
    isValidListItem: (domain: string) => boolean,
    customListValidator?: (modifierName: string, list: ListItem[]) => ValidationResult,
): ValidationResult => {
    const modifierName = modifier.modifier.value;
    const defaultInvalidValueResult = getValueRequiredValidationResult(modifierName);

    if (!modifier.value?.value) {
        return defaultInvalidValueResult;
    }

    let theList: AppList | DomainList | MethodList;
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
 * Map of all available pre-defined validators for modifiers with custom `value_format`.
 */
const CUSTOM_VALUE_FORMAT_MAP = {
    [CustomValueFormatValidatorName.App]: validatePipeSeparatedApps,
    [CustomValueFormatValidatorName.DenyAllow]: validatePipeSeparatedDenyAllowDomains,
    [CustomValueFormatValidatorName.Domain]: validatePipeSeparatedDomains,
    [CustomValueFormatValidatorName.Method]: validatePipeSeparatedMethods,
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
    const defaultInvalidValueResult = getValueRequiredValidationResult(modifierName);

    if (!modifier.value?.value) {
        return defaultInvalidValueResult;
    }

    let xRegExp;
    try {
        xRegExp = XRegExp(valueFormat);
    } catch (e) {
        throw new Error(`${SOURCE_DATA_ERROR_PREFIX.INVALID_VALUE_FORMAT_REGEXP}: '${modifierName}'`);
    }

    const isValid = xRegExp.test(modifier.value?.value);
    if (!isValid) {
        return defaultInvalidValueResult;
    }

    return { valid: true };
};
