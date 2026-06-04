import { NEGATION_MARKER } from '@adguard/agtree';

import { MASK_REGEX_RULE } from '../constants';
import { UnsupportedModifierError } from '../errors/conversion-errors/unsupported-modifier-error';

import { OPTION_NAMES } from './option-names';
import { type Rule } from './rule';

/**
 * Validator for a single modifier.
 * By default, rule is supported when all keys other than `name` are not set.
 */
type OptionValidator = {
    /**
     * Just for correct errors.
     */
    name: string;

    /**
     * If rule contains only this modifier - its conversion can be skipped.
     */
    skipConversion?: true;

    /**
     * If rule is partially supported with some additional checks.
     */
    customChecks?: ((rule: Rule, name: string) => UnsupportedModifierError | null)[];

    /**
     * If rule is not supported at all.
     */
    notSupported?: true;
};

/**
 * Class for validating network rules against DNR (declarative network request) constraints.
 * Ported from tsurlfilter's `RuleDeclarativeValidator`.
 */
export class RuleDeclarativeValidator {
    /**
     * Checks if the $removeparam value in the provided network rule
     * is supported for conversion to MV3.
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkRemoveParamModifierFn(
        rule: Rule,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        name: string,
    ): UnsupportedModifierError | null {
        const value = rule.advancedModifierValue ?? '';

        // $removeparam with negation (~) or regex (/) is not MV3-compatible
        if (value.startsWith(NEGATION_MARKER) || value.startsWith(MASK_REGEX_RULE)) {
            return new UnsupportedModifierError(
                'Network rule with $removeparam modifier with negation or regexp is not supported',
                rule,
            );
        }

        return null;
    }

    /**
     * Checks if the provided rule is an allowlist rule.
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkAllowRulesFn(rule: Rule, name: string): UnsupportedModifierError | null {
        if (rule.allowlist) {
            return new UnsupportedModifierError(
                `Network allowlist rule with ${name} modifier is not supported`,
                rule,
            );
        }

        return null;
    }

    /**
     * Checks if the specified modifier is included in rule explicitly.
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkHasModifierExplicitlyFn(rule: Rule, name: string): UnsupportedModifierError | null {
        let nameToCheck = name;

        // Remove leading dollar sign, if any
        if (nameToCheck.startsWith('$')) {
            nameToCheck = nameToCheck.slice(1);
        }

        if (rule.node.modifiers?.children.some((m) => m.name.value === nameToCheck)) {
            return new UnsupportedModifierError(
                `Network rule with explicitly enabled ${name} modifier is not supported`,
                rule,
            );
        }

        return null;
    }

    /**
     * Checks if the $removeheader value in the provided network rule
     * is supported for conversion to MV3.
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkRemoveHeaderModifierFn(
        rule: Rule,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        name: string,
    ): UnsupportedModifierError | null {
        const value = rule.advancedModifierValue;

        // $removeheader without a value is valid
        if (!value) {
            return null;
        }

        // Check if the header resolves to a valid (non-forbidden) name
        const hasValidResponseHeader = rule.getApplicableHeaderName(false) !== null;
        const hasValidRequestHeader = rule.getApplicableHeaderName(true) !== null;

        if (!hasValidResponseHeader && !hasValidRequestHeader) {
            return new UnsupportedModifierError(
                'Network rule with $removeheader modifier contains some of the unsupported headers',
                rule,
            );
        }

        return null;
    }

    /**
     * Checks if the $method values in the provided network rule
     * are supported for conversion to MV3.
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkMethodModifierFn(
        rule: Rule,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        name: string,
    ): UnsupportedModifierError | null {
        const { permittedMethods, restrictedMethods } = rule;

        if (
            permittedMethods?.some((method) => (method as string) === 'trace')
            || restrictedMethods?.some((method) => (method as string) === 'trace')
        ) {
            return new UnsupportedModifierError(
                "Network rule with $method modifier containing 'trace' method is not supported",
                rule,
            );
        }

        return null;
    }

    /**
     * Checks if the $cookie values in the provided network rule
     * are supported for conversion to MV3.
     * Only $cookie without parameters is supported.
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkCookieModifierFn = (
        rule: Rule,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        name: string,
    ): UnsupportedModifierError | null => {
        const value = rule.advancedModifierValue;

        // $cookie with additional parameters is not supported
        if (value !== null && value !== '') {
            const msg = 'The use of additional parameters in $cookie (apart from $cookie itself) is not supported';

            return new UnsupportedModifierError(msg, rule);
        }

        return null;
    };

    /**
     * Checks if rule is a "document"-allowlist and contains all these
     * `$elemhide,content,urlblock,jsinject` modifiers at the same time.
     * If it is - we allow partial conversion of this rule, because `$content`
     * is not supported in MV3 at all and `$jsinject` and `$urlblock`
     * are not implemented yet, but we can support at least allowlist-rule
     * with `$elemhide` modifier (not in the DNR, but with tsurlfilter engine).
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static checkDocumentAllowlistFn = (
        rule: Rule,
        name: string,
    ): UnsupportedModifierError | null => {
        if (rule.isFilteringDisabled()) {
            return null;
        }

        return new UnsupportedModifierError(
            `Network rule with "${name}" modifier is not supported`,
            rule,
        );
    };

    /**
     * Checks if the $header values in the provided network rule
     * are supported for conversion to MV3.
     * DNR does not support regex patterns in HeaderInfo.values field.
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkHeaderModifierFn = (
        rule: Rule,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        name: string,
    ): UnsupportedModifierError | null => {
        const { headerMatcher } = rule;

        if (!headerMatcher) {
            return null;
        }

        // Check if value is a RegExp - not supported in DNR HeaderInfo
        if (headerMatcher.isRegExp) {
            return new UnsupportedModifierError(
                'Declarative network rules with $header modifier cannot contain regex values',
                rule,
            );
        }

        return null;
    };

    /**
     * The $redirect-rule support will be possible to implement after browsers add this feature:
     * https://github.com/w3c/webextensions/issues/493.
     *
     * @param rule Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkRedirectModifierFn = (
        rule: Rule,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        name: string,
    ): UnsupportedModifierError | null => {
        const isRedirectRule = rule.isModifierEnabled(OPTION_NAMES.REDIRECT)
            && rule.isRedirectRuleModifier;

        if (!isRedirectRule) {
            return null;
        }

        return new UnsupportedModifierError(
            'Network rule with $redirect-rule modifier is not supported',
            rule,
        );
    };

    /**
     * Maps each canonical modifier name to its validation configuration.
     */
    private static optionsValidators: Record<string, OptionValidator> = {
        // Supported
        [OPTION_NAMES.THIRD_PARTY]: { name: '$third-party' },
        [OPTION_NAMES.MATCH_CASE]: { name: '$match-case' },
        [OPTION_NAMES.IMPORTANT]: { name: '$important' },
        [OPTION_NAMES.TO]: { name: '$to' },
        [OPTION_NAMES.BADFILTER]: { name: '$badfilter' },
        [OPTION_NAMES.PERMISSIONS]: { name: '$permissions' },

        // Supported without conversion.
        [OPTION_NAMES.ELEMHIDE]: { name: '$elemhide', skipConversion: true },
        [OPTION_NAMES.GENERICHIDE]: { name: '$generichide', skipConversion: true },
        [OPTION_NAMES.SPECIFICHIDE]: { name: '$specifichide', skipConversion: true },

        // Partially supported.
        [OPTION_NAMES.JSINJECT]: {
            name: '$jsinject',
            customChecks: [RuleDeclarativeValidator.checkDocumentAllowlistFn],
        },
        [OPTION_NAMES.URLBLOCK]: {
            name: '$urlblock',
            customChecks: [RuleDeclarativeValidator.checkDocumentAllowlistFn],
        },
        [OPTION_NAMES.CONTENT]: {
            name: '$content',
            customChecks: [RuleDeclarativeValidator.checkDocumentAllowlistFn],
        },
        // $popup is not supported in MV3, but rule with $all modifier includes $popup, so we should skip it.
        [OPTION_NAMES.POPUP]: {
            name: '$popup',
            customChecks: [RuleDeclarativeValidator.checkHasModifierExplicitlyFn],
        },
        [OPTION_NAMES.CSP]: {
            name: '$csp',
            customChecks: [RuleDeclarativeValidator.checkAllowRulesFn],
        },
        [OPTION_NAMES.REDIRECT]: {
            // $redirect and $redirect-rule modifiers are falling under this option
            name: '$redirect',
            customChecks: [
                RuleDeclarativeValidator.checkAllowRulesFn,
                RuleDeclarativeValidator.checkRedirectModifierFn,
            ],
        },
        [OPTION_NAMES.REMOVEPARAM]: {
            name: '$removeparam',
            customChecks: [
                RuleDeclarativeValidator.checkAllowRulesFn,
                RuleDeclarativeValidator.checkRemoveParamModifierFn,
            ],
        },
        [OPTION_NAMES.REMOVEHEADER]: {
            name: '$removeheader',
            customChecks: [
                RuleDeclarativeValidator.checkAllowRulesFn,
                RuleDeclarativeValidator.checkRemoveHeaderModifierFn,
            ],
        },
        [OPTION_NAMES.COOKIE]: {
            name: '$cookie',
            customChecks: [
                RuleDeclarativeValidator.checkAllowRulesFn,
                RuleDeclarativeValidator.checkCookieModifierFn,
            ],
        },
        [OPTION_NAMES.METHOD]: {
            name: '$method',
            customChecks: [RuleDeclarativeValidator.checkMethodModifierFn],
        },
        [OPTION_NAMES.HEADER]: {
            name: '$header',
            customChecks: [RuleDeclarativeValidator.checkHeaderModifierFn],
        },
        [OPTION_NAMES.URLTRANSFORM]: {
            name: '$urltransform',
        },

        // Not supported yet.
        [OPTION_NAMES.GENERICBLOCK]: { name: '$genericblock', notSupported: true },
        [OPTION_NAMES.STEALTH]: { name: '$stealth', notSupported: true },
        // Will not be supported.
        [OPTION_NAMES.REPLACE]: { name: '$replace', notSupported: true },
        [OPTION_NAMES.JSONPRUNE]: { name: '$jsonprune', notSupported: true },
        [OPTION_NAMES.HLS]: { name: '$hls', notSupported: true },
        // DNS modifiers.
        [OPTION_NAMES.CLIENT]: { name: '$client', notSupported: true },
        [OPTION_NAMES.DNSREWRITE]: { name: '$dnsrewrite', notSupported: true },
        [OPTION_NAMES.DNSTYPE]: { name: '$dnstype', notSupported: true },
        [OPTION_NAMES.CTAG]: { name: '$ctag', notSupported: true },
        // Desktop modifiers only.
        [OPTION_NAMES.NETWORK]: { name: '$network', notSupported: true },
        [OPTION_NAMES.EXTENSION]: { name: '$extension', notSupported: true },
    };

    /**
     * Checks if a network rule can be converted to a declarative format or not.
     * We skip the following modifiers:
     *
     * All specific exceptions:
     * $genericblock;
     * $jsinject;
     * $urlblock;
     * $content;
     * $extension;
     * $stealth;
     *
     * Following specific exceptions are not required to be converted, but they
     * are used in the cosmetic filtering:
     * $elemhide;
     * $generichide;
     * $specifichide;
     *
     * Other:
     * $header;
     * $popup;
     * $csp;
     * $replace;
     * $cookie - if modifier is not empty and contains any parameters;
     * $redirect - if the rule is allowlist;
     * $removeparam - if it contains a negation, or regexp,
     * or the rule is allowlist;
     * $removeheader - if it contains a title from a prohibited list
     * (see FORBIDDEN_HEADERS in Rule);
     * $jsonprune;
     * $method - if the modifier contains 'trace' method;
     * $hls;
     * $permissions.
     *
     * @param rule Network rule.
     *
     * @returns Boolean flag - `false` if the rule does not require conversion
     * and `true` if the rule is convertible.
     *
     * @throws Error with type {@link UnsupportedModifierError} if the rule is not convertible.
     */
    public static shouldConvertRule(rule: Rule): boolean {
        for (const modifier of rule.enabledModifiers) {
            const validator = this.optionsValidators[modifier];
            if (!validator) {
                continue;
            }

            const {
                name,
                customChecks,
                skipConversion,
                notSupported,
            } = validator;

            if (notSupported) {
                throw new UnsupportedModifierError(
                    `Unsupported option "${name}"`,
                    rule,
                );
            }

            if (skipConversion) {
                if (rule.isSingleModifierEnabled(modifier)) {
                    return false;
                }
                continue;
            }

            if (customChecks) {
                for (let j = 0; j < customChecks.length; j += 1) {
                    const err = customChecks[j](rule, name);
                    if (err !== null) {
                        throw err;
                    }
                }
            }
        }

        return true;
    }
}
