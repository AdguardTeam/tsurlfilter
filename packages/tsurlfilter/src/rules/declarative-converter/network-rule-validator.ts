import { HTTPMethod } from '../../modifiers/method-modifier';
import { RemoveHeaderModifier } from '../../modifiers/remove-header-modifier';
import { RemoveParamModifier } from '../../modifiers/remove-param-modifier';
import { NetworkRule, NetworkRuleOption } from '../network-rule';

import { UnsupportedModifierError } from './errors/conversion-errors/unsupported-modifier-error';

/**
 * Validator for each {@link NetworkRuleOption}.
 * By default, rule is supported, when all keys other than `name` are not set.
 */
type NetworkOptionValidator = {
    /**
     * Just for correct errors.
     */
    name: string,
    /**
     * If rule supported without conversion to declarative syntax.
     */
    skipConversion?: true,
    /**
     * If rule partially supported with some additional checks.
     */
    customChecks?: ((r: NetworkRule, name: string) => UnsupportedModifierError | null)[],
    /**
     * If rule is not supported at all.
     */
    notSupported?: true,
};

/**
 * All options from {@link NetworkRuleOption}.
 */
type NetworkRuleOptions = keyof typeof NetworkRuleOption;

type ExcludeEnumKey<Key> = Key extends 'NotSet' ? never : Key;
/**
 * All options from {@link NetworkRuleOption} except
 * {@link NetworkRuleOption.NotSet} because it just syntax sugar.
 */
type FilteredNetworkRuleOptions = ExcludeEnumKey<NetworkRuleOptions>;

/**
 * For each {@link NetworkRuleOption} we should have a validator, because
 * there are no public getters of rule's option, so we need to iterate over
 * all existing network option and check each of them.
 */
type NetworkRuleValidators = {
    [K in FilteredNetworkRuleOptions]: NetworkOptionValidator;
};

/**
 * Class for validating network rules.
 */
export class NetworkRuleDeclarativeValidator {
    /**
     * Checks if the $redirect values in the provided network rule
     * are supported for conversion to MV3.
     *
     * @param r Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static checkRemoveParamModifierFn(r: NetworkRule, name: string): UnsupportedModifierError | null {
        const removeParam = r.getAdvancedModifier() as RemoveParamModifier;
        if (!removeParam.getMV3Validity()) {
            // eslint-disable-next-line max-len
            const msg = `Network rule with $removeparam modifier with negation or regexp is not supported: "${r.getText()}"`;

            return new UnsupportedModifierError(msg, r);
        }

        return null;
    }

    /**
     * Checks if the provided rule is an allowlist rule.
     *
     * @param r Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkAllowRulesFn(r: NetworkRule, name: string): UnsupportedModifierError | null {
        if (r.isAllowlist()) {
            const msg = `Network allowlist rule with ${name} modifier is not supported: "${r.getText()}"`;
            return new UnsupportedModifierError(msg, r);
        }

        return null;
    }

    /**
     * Checks if the specified modifier is the only one the rule has.
     *
     * @param r Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    private static checkOnlyOneModifier(r: NetworkRule, name: string): UnsupportedModifierError | null {
        // TODO: Remove small hack with "reparsing" rule to extract only options part.
        const { options } = NetworkRule.parseRuleText(r.getText());
        if (options === name.replace('$', '')) {
            const msg = `Network rule with only one enabled modifier ${name} is not supported: "${r.getText()}"`;
            return new UnsupportedModifierError(msg, r);
        }

        return null;
    }

    /**
     * Checks if the $removeparam values in the provided network rule
     * are supported for conversion to MV3.
     *
     * @param r Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static checkRemoveHeaderModifierFn(r: NetworkRule, name: string): UnsupportedModifierError | null {
        const removeHeader = r.getAdvancedModifier() as RemoveHeaderModifier;
        if (!removeHeader.isValid) {
            return new UnsupportedModifierError(
                // eslint-disable-next-line max-len
                `Network rule with $removeheader modifier containing some of the unsupported headers is not supported: "${r.getText()}"`,
                r,
            );
        }

        return null;
    }

    /**
     * Checks if the $method values in the provided network rule
     * are supported for conversion to MV3.
     *
     * @param r Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static checkMethodModifierFn(r: NetworkRule, name: string): UnsupportedModifierError | null {
        const permittedMethods = r.getPermittedMethods();
        const restrictedMethods = r.getRestrictedMethods();
        if (
            permittedMethods?.some((method) => method === HTTPMethod.TRACE)
                || restrictedMethods?.some((method) => method === HTTPMethod.TRACE)
        ) {
            return new UnsupportedModifierError(
                `Network rule with $method modifier containing 'trace' method is not supported: "${r.getText()}"`,
                r,
            );
        }

        return null;
    }

    /**
     * Checks if rule is a "document"-allowlist and contains all these
     * `$elemhide,content,urlblock,jsinject` modifiers at the same time.
     * If it is - we allow partially convert this rule, because `$content`
     * is not supported in the MV3 at all and `$jsinject` and `$urlblock`
     * are not implemented yet, but we can support at least allowlist-rule
     * with `$elemhide` modifier (not in the DNR, but with tsurlfilter engine).
     *
     * TODO: Change the description when `$jsinject` and `$urlblock`
     * are implemented.
     *
     * @param r Network rule.
     * @param name Modifier's name.
     *
     * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static checkDocumentAllowlistFn = (r: NetworkRule, name: string): UnsupportedModifierError | null => {
        if (r.isFilteringDisabled()) {
            return null;
        }

        return new UnsupportedModifierError(
            `Network rule with "${name}" modifier is not supported: "${r.getText()}"`,
            r,
        );
    };

    /* eslint-disable max-len */
    private static optionsValidators: NetworkRuleValidators = {
        // Supported
        ThirdParty: { name: '$third-party' },
        MatchCase: { name: '$match-case' },
        Important: { name: '$important' },
        To: { name: '$to' },
        Badfilter: { name: '$badfilter' },

        // Supported without conversion.
        Elemhide: { name: '$elemhide', skipConversion: true },
        Generichide: { name: '$generichide', skipConversion: true },
        Specifichide: { name: '$specifichide', skipConversion: true },

        // Partially supported.
        Jsinject: { name: '$jsinject', customChecks: [this.checkDocumentAllowlistFn] },
        Urlblock: { name: '$urlblock', customChecks: [this.checkDocumentAllowlistFn] },
        Content: { name: '$content', customChecks: [this.checkDocumentAllowlistFn] },
        Popup: { name: '$popup', customChecks: [this.checkOnlyOneModifier] },
        Csp: { name: '$csp', customChecks: [this.checkAllowRulesFn] },
        Redirect: { name: '$redirect', customChecks: [this.checkAllowRulesFn] },
        RemoveParam: { name: '$removeparam', customChecks: [this.checkAllowRulesFn, this.checkRemoveParamModifierFn] },
        RemoveHeader: { name: '$removeheader', customChecks: [this.checkAllowRulesFn, this.checkRemoveHeaderModifierFn] },
        Method: { name: '$method', customChecks: [this.checkMethodModifierFn] },

        // Not supported.
        // Not supported yet.
        Cookie: { name: '$cookie', notSupported: true },
        Genericblock: { name: '$genericblock', notSupported: true },
        Stealth: { name: '$stealth', notSupported: true },
        Permissions: { name: '$permissions', notSupported: true },
        // Will not be supported.
        Replace: { name: '$replace', notSupported: true },
        JsonPrune: { name: '$jsonprune', notSupported: true },
        Hls: { name: '$hls', notSupported: true },
        // DNS modifiers.
        Client: { name: '$client', notSupported: true },
        DnsRewrite: { name: '$dnsrewrite', notSupported: true },
        DnsType: { name: '$dnstype', notSupported: true },
        Ctag: { name: '$ctag', notSupported: true },
        // Desktop modifiers only.
        Network: { name: '$network', notSupported: true },
        Extension: { name: '$extension', notSupported: true },
    };
    /* eslint-enable max-len */

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
     * Following specific exceptions are not require conversion, but they
     * are used in the {@link MatchingResult.getCosmeticOption}:
     * $elemhide
     * $generichide;
     * $specifichide;
     *
     * Other:
     * $popup;
     * $csp;
     * $replace;
     * $cookie;
     * $redirect - if the rule is a allowlist;
     * $removeparam - if it contains a negation, or regexp,
     * or the rule is a allowlist;
     * $removeheader - if it contains a title from a prohibited list
     * (see {@link RemoveHeaderModifier.FORBIDDEN_HEADERS});
     * $jsonprune;
     * $method - if the modifier contains 'trace' method,
     * $hls;
     * $permissions.
     *
     * @param rule - Network rule.
     *
     * @throws Error with type {@link UnsupportedModifierError} if the rule is not
     * convertible.
     *
     * @returns Boolean flag - `false` if the rule does not require conversion
     * and `true` if the rule is convertible.
     */
    public static shouldConvertNetworkRule(rule: NetworkRule): boolean {
        // Filter NetworkRuleOption.NotSet because this is syntax sugar and
        // not a real valuable option.
        const options = Object.keys(NetworkRuleOption).filter((key) => key !== 'NotSet');

        // Because we don't have public getter of rule's options, we need
        // to iterate over all existing network options and check each of them.
        for (const option of options) {
            const networkOption = NetworkRuleOption[option as FilteredNetworkRuleOptions];

            if (!rule.isOptionEnabled(networkOption)) {
                continue;
            }

            const validator = this.optionsValidators[option as FilteredNetworkRuleOptions];
            if (!validator) {
                throw new Error(`Validator for option "${option}" is not found`);
            }

            const {
                name,
                customChecks,
                skipConversion,
                notSupported,
            } = validator;

            if (notSupported) {
                const msg = `Unsupported option "${name}" in the rule: "${rule.getText()}"`;
                throw new UnsupportedModifierError(msg, rule);
            }

            if (skipConversion) {
                if (rule.isSingleOptionEnabled(networkOption)) {
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
