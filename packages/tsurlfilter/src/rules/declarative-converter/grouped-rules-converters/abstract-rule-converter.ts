/**
 * @file Describes how to convert one {@link NetworkRule} into one or many
 * {@link DeclarativeRule|declarative rules} .
 */

import punycode from 'punycode/';
import { redirects } from '@adguard/scriptlets';

import { NetworkRule, NetworkRuleOption } from '../../network-rule';
import { RemoveParamModifier } from '../../../modifiers/remove-param-modifier';
import { RequestType } from '../../../request-type';
import {
    ResourceType,
    DeclarativeRule,
    RuleAction,
    RuleActionType,
    RuleCondition,
    DomainType,
    Redirect,
} from '../declarative-rule';
import {
    TooComplexRegexpError,
    UnsupportedModifierError,
    EmptyResourcesError,
    UnsupportedRegexpError,
} from '../errors/conversion-errors';
import { ConvertedRules } from '../converted-result';
import { IndexedRule } from '../../rule';
import { ResourcesPathError } from '../errors/converter-options-errors';
import { RedirectModifier } from '../../../modifiers/redirect-modifier';

/**
 * Map request types to declarative types.
 */
const DECLARATIVE_RESOURCE_TYPES_MAP = {
    [ResourceType.MainFrame]: RequestType.Document,
    [ResourceType.SubFrame]: RequestType.SubDocument,
    [ResourceType.Stylesheet]: RequestType.Stylesheet,
    [ResourceType.Script]: RequestType.Script,
    [ResourceType.Image]: RequestType.Image,
    [ResourceType.Font]: RequestType.Font,
    [ResourceType.Object]: RequestType.Object,
    [ResourceType.XmlHttpRequest]: RequestType.XmlHttpRequest,
    [ResourceType.Ping]: RequestType.Ping,
    // TODO: what should match this resource type?
    // [ResourceType.CSP_REPORT]: RequestType.Document,
    [ResourceType.Media]: RequestType.Media,
    [ResourceType.WebSocket]: RequestType.WebSocket,
    [ResourceType.Other]: RequestType.Other,
};

/**
 * Rule priority. Defaults to 1. When specified, should be >= 1. The higher the
 * number, the higher the priority.
 */
export enum DeclarativeRulePriority {
    DocumentException = 4,
    ImportantException = 3,
    Important = 2,
    /**
     * Base exception has default priority level because MV3 matching algorithm
     * has following order of decreasing precedence:
     * 1. "allow"
     * 2. "allowAllRequests"
     * 3. "block"
     * 4. "upgradeScheme"
     * 5. "redirect".
     *
     * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#matching-algorithm}
     */
    Exception = 1,
}

/**
 * Abstract rule converter class.
 * Contains the generic logic for converting a {@link NetworkRule}
 * into a {@link DeclarativeRule}.
 */
export abstract class DeclarativeRuleConverter {
    /**
     * String path to web accessible resources,
     * relative to the extension root dir.
     * Should start with leading slash '/'.
     */
    protected webAccessibleResourcesPath?: string;

    /**
     * Creates an instance of DeclarativeRuleConverter.
     *
     * @param webAccessibleResourcesPath Path to web accessible resources.
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;
    }

    /**
     * Gets resource type matching request type.
     *
     * @param requestTypes Request type.
     *
     * @returns List of resource types.
     */
    private static getResourceTypes(requestTypes: RequestType): ResourceType[] {
        return Object.entries(DECLARATIVE_RESOURCE_TYPES_MAP)
            // Skips the first element
            .filter(([, requestType]) => (requestTypes & requestType) === requestType)
            .map(([resourceTypeKey]) => resourceTypeKey) as ResourceType[];
    }

    /**
     * Checks if the string contains only ASCII characters.
     *
     * @param str String to test.
     *
     * @returns True if string contains only ASCII characters.
     */
    private static isASCII(str: string): boolean {
        // eslint-disable-next-line no-control-regex
        return /^[\x00-\x7F]+$/.test(str);
    }

    /**
     * Converts to punycode if string contains non ASCII characters.
     *
     * @param str String to convert.
     *
     * @returns A transformed string containing only ASCII characters or
     * the original string.
     */
    private static prepareASCII(str: string): string {
        return DeclarativeRuleConverter.isASCII(str)
            ? str
            : punycode.toASCII(str);
    }

    /**
     * Converts a list of strings into strings containing only ASCII characters.
     *
     * @param strings List of strings.
     *
     * @returns List of string containing only ASCII characters.
     */
    private static toASCII(strings: string[]): string[] {
        return strings.map((s) => {
            return DeclarativeRuleConverter.prepareASCII(s);
        });
    }

    /**
     * Rule priority. Defaults to 1. When specified, should be >= 1.
     *
     * Document exceptions > allowlist + $important > $important >
     * allowlist > basic rules.
     *
     * @param rule Network rule.
     *
     * @returns Priority of the rule or null.
     */
    private static getPriority(rule: NetworkRule): number | null {
        if (rule.isDocumentAllowlistRule()) {
            return DeclarativeRulePriority.DocumentException;
        }

        const isImportant = rule.isOptionEnabled(NetworkRuleOption.Important);
        const isAllowlist = rule.isAllowlist();

        if (isImportant) {
            return isAllowlist
                ? DeclarativeRulePriority.ImportantException
                : DeclarativeRulePriority.Important;
        }

        if (isAllowlist) {
            return DeclarativeRulePriority.Exception;
        }

        return null;
    }

    /**
     * Rule redirect action.
     *
     * @param rule Network rule.
     *
     * @throws Error {@link ResourcesPathError} when a network rule has
     * a $redirect modifier and no path to web-accessible resources
     * is specified.
     *
     * @returns Redirect, which describes where and how the request
     * should be redirected.
     */
    private getRedirectAction(rule: NetworkRule): Redirect {
        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
            const resourcesPath = this.webAccessibleResourcesPath;
            if (!resourcesPath) {
                const ruleText = rule.getText();
                const msg = `Empty web accessible resources path: ${ruleText}`;
                throw new ResourcesPathError(msg);
            }
            const advancedModifier = rule.getAdvancedModifier();
            const redirectTo = advancedModifier as RedirectModifier;
            const filename = redirects.getRedirectFilename(redirectTo.getValue());

            return { extensionPath: `${resourcesPath}/${filename}` };
        }

        if (rule.isOptionEnabled(NetworkRuleOption.RemoveParam)) {
            const advancedModifier = rule.getAdvancedModifier();
            const removeParamModifier = advancedModifier as RemoveParamModifier;
            const value = removeParamModifier.getValue();

            if (value === '') {
                return { transform: { query: '' } };
            }

            return {
                transform: {
                    queryTransform: {
                        removeParams: DeclarativeRuleConverter.toASCII([value]),
                    },
                },
            };
        }

        return {};
    }

    /**
     * Rule action.
     *
     * @param rule Network rule.
     *
     * @throws Error {@link ResourcesPathError} when specified an empty
     * path to the web accessible resources.
     *
     * @returns The action of a rule that describes what should be done
     * with the request.
     */
    private getAction(rule: NetworkRule): RuleAction {
        // TODO: RuleActionType
        //  - 'upgradeScheme' = 'upgradeScheme',
        //  - 'modifyHeaders' = 'modifyHeaders',

        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)
         || rule.isOptionEnabled(NetworkRuleOption.RemoveParam)
        ) {
            return {
                type: RuleActionType.REDIRECT,
                redirect: this.getRedirectAction(rule),
            };
        }

        if (rule.isAllowlist()) {
            if (rule.isDocumentLevelAllowlistRule() || rule.isDocumentAllowlistRule()) {
                return { type: RuleActionType.ALLOW_ALL_REQUESTS };
            }

            return { type: RuleActionType.ALLOW };
        }

        return { type: RuleActionType.BLOCK };
    }

    /**
     * Rule condition.
     *
     * @param rule Network rule.
     *
     * @returns A rule condition that describes to which request the declarative
     * rule should be applied.
     */
    private static getCondition(rule: NetworkRule): RuleCondition {
        const condition: RuleCondition = {};

        const pattern = rule.getPattern();
        if (pattern) {
            // set regexFilter
            if (rule.isRegexRule()) {
                condition.regexFilter = DeclarativeRuleConverter.prepareASCII(pattern);
            } else {
                // A pattern beginning with ||* is not allowed. Use * instead.
                const patternWithoutVerticals = pattern.startsWith('||*')
                    ? pattern.substring(2)
                    : pattern;
                condition.urlFilter = DeclarativeRuleConverter.prepareASCII(patternWithoutVerticals);
            }
        }

        // set domainType
        if (rule.isOptionEnabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.ThirdParty;
        } else if (rule.isOptionDisabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.FirstParty;
        }

        // set initiatorDomains
        const permittedDomains = rule.getPermittedDomains();
        if (permittedDomains && permittedDomains.length > 0) {
            condition.initiatorDomains = this.toASCII(permittedDomains);
        }

        // set excludedInitiatorDomains
        const excludedDomains = rule.getRestrictedDomains();
        if (excludedDomains && excludedDomains.length > 0) {
            condition.excludedInitiatorDomains = this.toASCII(excludedDomains);
        }

        // set excludedRequestDomains
        const denyAllowDomains = rule.getDenyAllowDomains();
        if (denyAllowDomains && denyAllowDomains.length > 0) {
            condition.excludedRequestDomains = this.toASCII(denyAllowDomains);
        }

        // set excludedResourceTypes
        const restrictedRequestTypes = rule.getRestrictedRequestTypes();
        const hasExcludedResourceTypes = restrictedRequestTypes !== 0;
        if (hasExcludedResourceTypes) {
            condition.excludedResourceTypes = this.getResourceTypes(restrictedRequestTypes);
        }

        // set resourceTypes
        const permittedRequestTypes = rule.getPermittedRequestTypes();
        if (!hasExcludedResourceTypes && permittedRequestTypes !== 0) {
            condition.resourceTypes = this.getResourceTypes(permittedRequestTypes);
        }

        // set isUrlFilterCaseSensitive
        condition.isUrlFilterCaseSensitive = rule.isOptionEnabled(NetworkRuleOption.MatchCase);

        return condition;
    }

    /**
     * Converts the network rule into an array of declarative rules.
     *
     * Method to use only in class heirs.
     *
     * @protected
     *
     * @param rule Network rule.
     * @param id Rule identifier.
     *
     * @throws An {@link UnsupportedModifierError} if the network rule
     * contains an unsupported modifier
     * OR a {@link TooComplexRegexpError} if regexp is too complex
     * OR an {@link EmptyResourcesError} if there is empty resources in the rule
     * OR an {@link UnsupportedRegexpError} if regexp is not supported in
     * the RE2 syntax.
     * OR a {@link ResourcesPathError} when specified an empty
     * path to the web accessible resources.
     *
     * @returns A list of declarative rules.
     */
    protected convertRule(
        rule: NetworkRule,
        id: number,
    ): DeclarativeRule[] {
        const unsupportedErr = DeclarativeRuleConverter.checkNetworkRuleApplicable(rule);
        if (unsupportedErr) {
            throw unsupportedErr;
        }

        const declarativeRule: DeclarativeRule = {
            id,
            action: this.getAction(rule),
            condition: DeclarativeRuleConverter.getCondition(rule),
        };

        const priority = DeclarativeRuleConverter.getPriority(rule);
        if (priority) {
            declarativeRule.priority = priority;
        }

        const conversionErr = DeclarativeRuleConverter.checkDeclarativeRuleApplicable(
            rule,
            declarativeRule,
        );
        if (conversionErr) {
            throw conversionErr;
        }

        return [declarativeRule];
    }

    /**
     * Checks if a network rule can be converted to a declarative format or not.
     * We skip the following modifiers:
     * $removeparam - if it contains a negation, or regexp,
     * or the rule is a allowlist;
     * $elemhide;
     * $jsinject;
     * $cookie;
     * $csp;
     * $replace;
     * $generichide;
     * $stealth;
     * $mp4.
     *
     * @param rule - Network rule.
     *
     * @returns UnsupportedModifierError if not applicable OR null.
     */
    private static checkNetworkRuleApplicable(rule: NetworkRule): UnsupportedModifierError | null {
        const checkRemoveParamModifierFn = (r: NetworkRule): UnsupportedModifierError | null => {
            // TODO: Check Rule.requestDomains, maybe we can use them for
            // generate allowrule for $removeparam
            if (r.isAllowlist()) {
                const msg = 'Network allowlist rule with $removeparam modifier '
                + `is not supported: "${rule.getText()}"`;

                return new UnsupportedModifierError(msg, r);
            }

            const removeParam = r.getAdvancedModifier() as RemoveParamModifier;
            if (!removeParam.getMV3Validity()) {
                const msg = 'Network rule with $removeparam modifier with '
                + `negation or regexp is not supported: "${r.getText()}"`;

                return new UnsupportedModifierError(msg, r);
            }

            return null;
        };

        const unsupportedOptions = [
            {
                option: NetworkRuleOption.RemoveParam,
                name: '$removeparam',
                customCheck: checkRemoveParamModifierFn,
            },
            { option: NetworkRuleOption.Elemhide, name: '$elemhide' },
            { option: NetworkRuleOption.Jsinject, name: '$jsinject' },
            { option: NetworkRuleOption.Cookie, name: '$cookie' },
            { option: NetworkRuleOption.Csp, name: '$csp' },
            { option: NetworkRuleOption.Replace, name: '$replace' },
            { option: NetworkRuleOption.Generichide, name: '$generichide' },
            { option: NetworkRuleOption.Stealth, name: '$stealth' },
            { option: NetworkRuleOption.Mp4, name: '$mp4' },
        ];

        for (let i = 0; i < unsupportedOptions.length; i += 1) {
            const { option, name, customCheck } = unsupportedOptions[i];
            if (!rule.isSingleOptionEnabled(option)) {
                continue;
            }

            if (customCheck) {
                const err = customCheck(rule);
                if (!err) {
                    continue;
                }

                return err;
            }

            const msg = `Unsupported option "${name}" found in the rule: "${rule.getText()}"`;
            return new UnsupportedModifierError(msg, rule);
        }

        return null;
    }

    /**
     * Checks if the converted declarative rule passes the regexp validation
     * (too complex regexps are not allowed also back reference,
     * possessive and negative lookahead are not supported)
     * and if it contains resource types.
     *
     * @param networkRule Network rule.
     * @param declarativeRule Declarative rule.
     *
     * @returns Error {@link TooComplexRegexpError} if regexp is too complex
     * OR Error {@link EmptyResourcesError} if there is empty resources
     * in the rule
     * OR Error {@link UnsupportedRegexpError} if regexp is not supported
     * in the RE2 syntax @see https://github.com/google/re2/wiki/Syntax
     * OR null.
     */
    private static checkDeclarativeRuleApplicable(
        networkRule: NetworkRule,
        declarativeRule: DeclarativeRule,
    ): TooComplexRegexpError | EmptyResourcesError | UnsupportedRegexpError | null {
        const { regexFilter, resourceTypes } = declarativeRule.condition;

        if (resourceTypes?.length === 0) {
            const ruleText = networkRule.getText();
            const msg = `Conversion resourceTypes is empty: "${ruleText}"`;
            return new EmptyResourcesError(msg, networkRule, declarativeRule);
        }

        // More complex regex than allowed as part of the "regexFilter" key.
        if (regexFilter?.match(/\|/g)) {
            const regexArr = regexFilter.split('|');
            // TODO: Find how exactly the complexity of a rule is calculated.
            // The values maxGroups & maxGroupLength are obtained by testing.
            const maxGroups = 15;
            const maxGroupLength = 31;
            if (regexArr.length > maxGroups
                || regexArr.some((i) => i.length > maxGroupLength)
            ) {
                const ruleText = networkRule.getText();
                const msg = `More complex regex than allowed: "${ruleText}"`;
                return new TooComplexRegexpError(
                    msg,
                    networkRule,
                    declarativeRule,
                );
            }
        }

        // Back reference, possessive and negative lookahead are not supported
        // See more: https://github.com/google/re2/wiki/Syntax
        if (regexFilter?.match(/\\[1-9]|(?<!\\)\?|{\S+}/g)) {
            const msg = `Invalid regex in the: "${networkRule.getText()}"`;
            return new UnsupportedRegexpError(
                msg,
                networkRule,
                declarativeRule,
            );
        }

        return null;
    }

    /**
     * Converts provided bunch of indexed rules to declarative rules
     * via generating source map for it and catching errors of conversations.
     *
     * @param filterId Filter id.
     * @param rules Indexed rules.
     * @param offsetId Offset for the IDs of the converted rules.
     */
    abstract convertRules(
        filterId: number,
        rules: IndexedRule[],
        offsetId: number,
    ): ConvertedRules;
}
