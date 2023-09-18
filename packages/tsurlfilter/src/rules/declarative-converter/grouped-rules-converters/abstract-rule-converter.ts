/* eslint-disable jsdoc/require-description-complete-sentence */
/* eslint-disable jsdoc/no-multi-asterisks */
/**
 * @file Describes how to convert one {@link NetworkRule} into one or many
 * {@link DeclarativeRule|declarative rules}.
 *
 *      Heir classes                                           DeclarativeConverter
 *
 *                            │                                         │
 *    *override layer*        │              *protected layer*          │              *private layer*
 *                            │                                         │
 *                            │                                         │
 * Subclasses should define   │    Converts a set of indexed rules      │
 * the logic in this method.  │    into declarative rules while         │
 *                            │    handling errors.                     │
 *  ┌─────────────────────┐   │   ┌───────────────────────────┐         │
 *  │                     │   │   │                           │         │
 *  │  abstract convert() ├───┼──►│  protected convertRules() │         │
 *  │                     │   │   │                           │         │
 *  └─────────────────────┘   │   └─────────────┬─────────────┘         │
 *                            │                 │                       │
 *                            │                 │                       │
 *                            │   ┌─────────────▼─────────────┐         │
 *                            │   │                           │         │
 *                            │   │  protected convertRule()  ├─────────┼───────────────────────┐
 *                            │   │                           │         │                       │
 *                            │   └───────────────────────────┘         │                       │
 *                            │   Transforms a single Network Rule      │     ┌─────────────────▼────────────────────┐
 *                            │   into one or several                   │     │                                      │
 *                            │   declarative rules.                    │  ┌──┤ static checkNetworkRuleConvertible() │
 *                            │                                         │  │  │                                      │
 *                            │                                         │  │  └──────────────────────────────────────┘
 *                            │                                         │  │  Checks if network rule conversion
 *                            │                                         │  │  is supported and if it is needed at all.
 *                            │                                         │  │
 *                            │                                         │  │  ┌──────────────────────────┐
 *                            │                                         │  └──►                          │
 *                            │                                         │     │   private getAction()    │
 *                            │                                         │  ┌──┤                          │
 *                            │                                         │  │  └──────────────────────────┘
 *                            │                                         │  │  Generates the action section
 *                            │                                         │  │  of a declarative rule.
 *                            │                                         │  │
 *                            │                                         │  │  ┌────────────────────────────────────┐
 *                            │                                         │  └──►                                    │
 *                            │                                         │     │     private getRedirectAction()    │
 *                            │                                         │     │  static getModifyHeadersAction()   │
 *                            │                                         │     │ static getAddingCspHeadersAction() │
 *                            │                                         │  ┌──┤                                    │
 *                            │                                         │  │  └────────────────────────────────────┘
 *                            │                                         │  │  Modifier-specific methods. A distinct
 *                            │                                         │  │  section will be created for each modifier.
 *                            │                                         │  │
 *                            │                                         │  │  ┌─────────────────────────┐
 *                            │                                         │  └──►                         │
 *                            │                                         │     │  static getCondition()  │
 *                            │                                         │  ┌──┤                         │
 *                            │                                         │  │  └─────────────────────────┘
 *                            │                                         │  │  Generates the condition section
 *                            │                                         │  │  of a declarative rule.
 *                            │                                         │  │
 *                            │                                         │  │  ┌────────────────────────┐
 *                            │                                         │  └──►                        │
 *                            │                                         │     │  static getPriority()  │
 *                            │                                         │  ┌──┤                        │
 *                            │                                         │  │  └────────────────────────┘
 *                            │                                         │  │  Generates the priority of
 *                            │                                         │  │  a declarative rule.
 *                            │                                         │  │
 *                            │                                         │  │  ┌───────────────────────────────────────┐
 *                            │                                         │  └──►                                       │
 *                            │                                         │     │static checkDeclarativeRuleApplicable()│
 *                            │                                         │  ┌──┤                                       │
 *                            │                                         │  │  └───────────────────────────────────────┘
 *                            │                                         │  │  After conversion, checks if the generated
 *                            │                                         │  │  declarative rule contains any unsupported
 *                            │                                         │  │  values.
 *                            │                                         │  │
 *                            │                                         │  │  ┌─────────────────────────────────────┐
 *                            │                                         │  └──►                                     │
 *                            │                                         │     │ static catchErrorDuringConversion() │
 *                            │               ┌─────────────────────────┼─────┤                                     │
 *                            │               │                         │     └─────────────────────────────────────┘
 *                            │   ┌───────────▼────────────────────┐    │     Handles errors during conversion.
 *                            │   │                                │    │
 *                            │   │ protected groupConvertedRules()│    │
 *                            │   │                                │    │
 *                            │   └────────────────────────────────┘    │
 *                            │                                         │
 *                            │   Groups converted declarative rules    │
 *                            │   using the provided grouper-functions. │
 *                            │                                         │
 *                            │   This method is optional and is not    │
 *                            │   used by all derived classes.          │
 *                            │                                         │
 */
/* eslint-enable */

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
    HeaderOperation,
    RuleActionHeaders,
    ModifyHeaderInfo,
    DECLARATIVE_RESOURCE_TYPES_MAP,
    DECLARATIVE_REQUEST_METHOD_MAP,
    SupportedHttpMethod,
    RequestMethod,
} from '../declarative-rule';
import {
    TooComplexRegexpError,
    UnsupportedModifierError,
    EmptyResourcesError,
    UnsupportedRegexpError,
} from '../errors/conversion-errors';
import { ConvertedRules } from '../converted-result';
import { IRule, IndexedRule } from '../../rule';
import { ResourcesPathError } from '../errors/converter-options-errors';
import { RedirectModifier } from '../../../modifiers/redirect-modifier';
import { RemoveHeaderModifier } from '../../../modifiers/remove-header-modifier';
import { CSP_HEADER_NAME } from '../../../modifiers/csp-modifier';
import { CookieModifier } from '../../../modifiers/cookie-modifier';
import { HTTPMethod } from '../../../modifiers/method-modifier';
import { PERMISSIONS_POLICY_HEADER_NAME } from '../../../modifiers/permissions-modifier';
import { SimpleRegex } from '../../simple-regex';

/**
 * Contains the generic logic for converting a {@link NetworkRule}
 * into a {@link DeclarativeRule}.
 *
 * Descendant classes must override the {@link convert} method,
 * where some logic must be defined for each rule type.
 *
 * Also descendant classes can use {@link convertRules}, {@link convertRule} and
 * {@link groupConvertedRules} methods, which contains the general logic of
 * transformation and grouping of rules.
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
     * Converts list of tsurlfilter {@link HTTPMethod|methods} to declarative
     * supported http {@link RequestMethod|methods} via excluding 'trace' method.
     *
     * @param methods List of {@link HTTPMethod|methods}.
     *
     * @returns List of {@link RequestMethod|methods}.
     */
    private static mapHttpMethodToDeclarativeHttpMethod(methods: HTTPMethod[]): RequestMethod[] {
        return methods
            // Filters unsupported `trace` method
            .filter((m): m is SupportedHttpMethod => m !== HTTPMethod.TRACE)
            // Map tsurlfilter http method to supported declarative http method
            .map((m) => DECLARATIVE_REQUEST_METHOD_MAP[m]);
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
     * Checks if network rule can be converted to {@link RuleActionType.ALLOW_ALL_REQUESTS}.
     *
     * @param rule Network rule.
     *
     * @returns Is rule compatible with {@link RuleActionType.ALLOW_ALL_REQUESTS}.
     */
    private static isCompatibleWithAllowAllRequests(rule: NetworkRule): boolean {
        const types = DeclarativeRuleConverter.getResourceTypes(rule.getPermittedRequestTypes());

        const allowedRequestTypes = [ResourceType.MainFrame, ResourceType.SubFrame];

        // If found resource type which is incompatible with allowAllRequest field
        if (types.some((type) => !allowedRequestTypes.includes(type))) {
            return false;
        }

        return true;
    }

    /**
     * Rule priority.
     *
     * @see {@link NetworkRule.getPriorityWeight}
     * @see {@link NetworkRule.priorityWeight}
     * @see {@link NetworkRule.calculatePriorityWeight}
     * @see {@link https://adguard.com/kb/en/general/ad-filtering/create-own-filters/#rule-priorities}
     *
     * @param rule Network rule.
     *
     * @returns Priority of the rule or null.
     */
    private static getPriority(rule: NetworkRule): number | null {
        return rule.getPriorityWeight();
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
     * Returns rule modify headers action.
     *
     * @param rule Network rule.
     *
     * @returns Modify headers action, which describes which headers should
     * be changed: added, set or deleted.
     */
    private static getModifyHeadersAction(rule: NetworkRule): RuleActionHeaders | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)) {
            return null;
        }

        const removeHeaderModifier = rule.getAdvancedModifier() as RemoveHeaderModifier;

        const removeRequestHeader = removeHeaderModifier.getApplicableHeaderName(true);
        if (removeRequestHeader) {
            return {
                requestHeaders: [{
                    header: removeRequestHeader,
                    operation: HeaderOperation.Remove,
                }],
            };
        }

        const removeResponseHeader = removeHeaderModifier.getApplicableHeaderName(false);
        if (removeResponseHeader) {
            return {
                responseHeaders: [{
                    header: removeResponseHeader,
                    operation: HeaderOperation.Remove,
                }],
            };
        }

        return null;
    }

    /**
     * Returns rule modify headers action with removing Cookie headers from response and request.
     *
     * @param rule Network rule.
     *
     * @returns Add headers action, which describes which headers should be added.
     */
    private static getRemovingCookieHeadersAction(
        rule: NetworkRule,
    ): Pick<RuleAction, 'requestHeaders' | 'responseHeaders'> | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.Cookie)) {
            return null;
        }

        return {
            responseHeaders: [{
                operation: HeaderOperation.Remove,
                header: 'Set-Cookie',
            }],
            requestHeaders: [{
                operation: HeaderOperation.Remove,
                header: 'Cookie',
            }],
        };
    }

    /**
     * Returns rule modify headers action with adding CSP headers to response.
     *
     * @param rule Network rule.
     *
     * @returns Add headers action, which describes what headers should be added.
     */
    private static getAddingCspHeadersAction(rule: NetworkRule): ModifyHeaderInfo | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.Csp)) {
            return null;
        }

        const cspHeaderValue = rule.getAdvancedModifierValue();
        if (cspHeaderValue) {
            return {
                operation: HeaderOperation.Append,
                header: CSP_HEADER_NAME,
                value: cspHeaderValue,
            };
        }

        return null;
    }

    /**
     * Returns rule modify headers action with adding Permissions headers to response.
     *
     * @param rule Network rule.
     *
     * @returns Add headers action, which describes what headers should be added.
     */
    private static getAddingPermissionsHeadersAction(rule: NetworkRule): ModifyHeaderInfo | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.Permissions)) {
            return null;
        }

        const permissionsHeaderValue = rule.getAdvancedModifierValue();
        if (permissionsHeaderValue) {
            return {
                operation: HeaderOperation.Append,
                header: PERMISSIONS_POLICY_HEADER_NAME,
                value: permissionsHeaderValue,
            };
        }

        return null;
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
        if (rule.isAllowlist()) {
            if (rule.isFilteringDisabled() && DeclarativeRuleConverter.isCompatibleWithAllowAllRequests(rule)) {
                return { type: RuleActionType.ALLOW_ALL_REQUESTS };
            }

            return { type: RuleActionType.ALLOW };
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)
            || rule.isOptionEnabled(NetworkRuleOption.RemoveParam)) {
            return {
                type: RuleActionType.REDIRECT,
                redirect: this.getRedirectAction(rule),
            };
        }

        if (rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)) {
            const modifyHeadersAction = DeclarativeRuleConverter.getModifyHeadersAction(rule);

            if (modifyHeadersAction?.requestHeaders) {
                return {
                    type: RuleActionType.MODIFY_HEADERS,
                    requestHeaders: modifyHeadersAction.requestHeaders,
                };
            }

            if (modifyHeadersAction?.responseHeaders) {
                return {
                    type: RuleActionType.MODIFY_HEADERS,
                    responseHeaders: modifyHeadersAction.responseHeaders,
                };
            }
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Csp)) {
            const headersAction = DeclarativeRuleConverter.getAddingCspHeadersAction(rule);
            if (headersAction) {
                return {
                    type: RuleActionType.MODIFY_HEADERS,
                    responseHeaders: [headersAction],
                };
            }
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Permissions)) {
            const headersAction = DeclarativeRuleConverter.getAddingPermissionsHeadersAction(rule);
            if (headersAction) {
                return {
                    type: RuleActionType.MODIFY_HEADERS,
                    responseHeaders: [headersAction],
                };
            }
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Cookie)) {
            const removeCookieHeaders = DeclarativeRuleConverter.getRemovingCookieHeadersAction(rule);
            if (removeCookieHeaders) {
                const { responseHeaders, requestHeaders } = removeCookieHeaders;

                return {
                    type: RuleActionType.MODIFY_HEADERS,
                    responseHeaders,
                    requestHeaders,
                };
            }
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
        const permittedDomains = rule.getPermittedDomains()?.filter((d) => {
            // Wildcard and regex domains are not supported by declarative converter
            return !d.includes(SimpleRegex.MASK_ANY_CHARACTER) && !SimpleRegex.isRegexPattern(d);
        });
        if (permittedDomains && permittedDomains.length > 0) {
            condition.initiatorDomains = this.toASCII(permittedDomains);
        }

        // set excludedInitiatorDomains
        const excludedDomains = rule.getRestrictedDomains();
        if (excludedDomains && excludedDomains.length > 0) {
            condition.excludedInitiatorDomains = this.toASCII(excludedDomains);
        }

        const permittedToDomains = rule.getPermittedToDomains();
        if (permittedToDomains && permittedToDomains.length > 0) {
            condition.requestDomains = this.toASCII(permittedToDomains);
        }

        // Can be specified $to or $denyallow, but not together.
        const denyAllowDomains = rule.getDenyAllowDomains();
        const restrictedToDomains = rule.getRestrictedToDomains();

        if (denyAllowDomains && denyAllowDomains.length !== 0) {
            condition.excludedRequestDomains = this.toASCII(denyAllowDomains);
        } else if (restrictedToDomains && restrictedToDomains.length !== 0) {
            condition.excludedRequestDomains = this.toASCII(restrictedToDomains);
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

        const permittedMethods = rule.getPermittedMethods();
        if (permittedMethods && permittedMethods.length !== 0) {
            condition.requestMethods = this.mapHttpMethodToDeclarativeHttpMethod(permittedMethods);
        }

        const restrictedMethods = rule.getRestrictedMethods();
        if (restrictedMethods && restrictedMethods.length !== 0) {
            condition.excludedRequestMethods = this.mapHttpMethodToDeclarativeHttpMethod(restrictedMethods);
        }

        // set isUrlFilterCaseSensitive
        condition.isUrlFilterCaseSensitive = rule.isOptionEnabled(NetworkRuleOption.MatchCase);

        /**
         * Here we need to set 'main_frame' to apply to document requests
         * as well (because by default it applies to all requests except
         * document).
         * And if we specify 'main_frame', then we also need to specify all
         * other types, so that it works not only for document requests, but
         * also for all other types of requests.
         */
        const shouldMatchAllResourcesTypes = rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)
            || rule.isOptionEnabled(NetworkRuleOption.Csp)
            || rule.isOptionEnabled(NetworkRuleOption.Permissions)
            || rule.isOptionEnabled(NetworkRuleOption.Cookie)
            || rule.isOptionEnabled(NetworkRuleOption.To)
            || rule.isOptionEnabled(NetworkRuleOption.Method);

        const emptyResourceTypes = !condition.resourceTypes && !condition.excludedResourceTypes;

        if (shouldMatchAllResourcesTypes && emptyResourceTypes) {
            condition.resourceTypes = [
                ResourceType.MainFrame,
                ResourceType.SubFrame,
                ResourceType.Stylesheet,
                ResourceType.Script,
                ResourceType.Image,
                ResourceType.Font,
                ResourceType.Object,
                ResourceType.XmlHttpRequest,
                ResourceType.Ping,
                ResourceType.Media,
                ResourceType.WebSocket,
                ResourceType.Other,
            ];
        }

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
        // If the rule is not convertible - method will throw an error.
        const shouldConvert = DeclarativeRuleConverter.checkNetworkRuleConvertible(rule);

        // The rule does not require conversion.
        if (!shouldConvert) {
            return [];
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
     * TODO: Move this method to separate static class, because it accumulates
     * a lot of logic tied to different types of rules and the method gets
     * really puffy.
     *
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
     * $hls.
     *
     * @param rule - Network rule.
     *
     * @throws Error with type {@link UnsupportedModifierError} if the rule is not
     * convertible.
     *
     * @returns Boolean flag - `false` if the rule does not require conversion
     * and `true` if the rule is convertible.
     */
    private static checkNetworkRuleConvertible(rule: NetworkRule): boolean {
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
        const checkRemoveParamModifierFn = (r: NetworkRule, name: string): UnsupportedModifierError | null => {
            const removeParam = r.getAdvancedModifier() as RemoveParamModifier;
            if (!removeParam.getMV3Validity()) {
                // eslint-disable-next-line max-len
                const msg = `Network rule with $removeparam modifier with negation or regexp is not supported: "${r.getText()}"`;

                return new UnsupportedModifierError(msg, r);
            }

            return null;
        };

        /**
         * Checks if the provided rule is an allowlist rule.
         *
         * @param r Network rule.
         * @param name Modifier's name.
         *
         * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
         */
        const checkAllowRulesFn = (r: NetworkRule, name: string): UnsupportedModifierError | null => {
            if (r.isAllowlist()) {
                const msg = `Network allowlist rule with ${name} modifier is not supported: "${rule.getText()}"`;
                return new UnsupportedModifierError(msg, r);
            }

            return null;
        };

        /**
         * Checks if the specified modifier is the only one the rule has.
         *
         * @param r Network rule.
         * @param name Modifier's name.
         *
         * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
         */
        const checkOnlyOneModifier = (r: NetworkRule, name: string): UnsupportedModifierError | null => {
            // TODO: Remove small hack with "reparsing" rule to extract only options part.
            const { options } = NetworkRule.parseRuleText(r.getText());
            if (options === name.replace('$', '')) {
                const msg = `Network rule with only one enabled modifier ${name} is not supported: "${rule.getText()}"`;
                return new UnsupportedModifierError(msg, r);
            }

            return null;
        };

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
        const checkRemoveHeaderModifierFn = (r: NetworkRule, name: string): UnsupportedModifierError | null => {
            const removeHeader = r.getAdvancedModifier() as RemoveHeaderModifier;
            if (!removeHeader.isValid) {
                return new UnsupportedModifierError(
                    // eslint-disable-next-line max-len
                    `Network rule with $removeheader modifier contains some of the unsupported headers: "${r.getText()}"`,
                    r,
                );
            }

            return null;
        };

        /**
         * Checks if the $cookie values in the provided network rule
         * are supported for conversion to MV3.
         *
         * @param r Network rule.
         * @param name Modifier's name.
         *
         * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
         */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const checkCookieModifierFn = (r: NetworkRule, name: string): UnsupportedModifierError | null => {
            const cookie = r.getAdvancedModifier() as CookieModifier;
            if (!cookie.isEmpty()) {
                // eslint-disable-next-line max-len
                const msg = `The use of additional parameters in $cookie (apart from $cookie itself) is not supported: "${r.getText()}"`;

                return new UnsupportedModifierError(msg, r);
            }

            return null;
        };

        /**
         * Checks if the $method values in the provided network rule
         * are supported for conversion to MV3.
         *
         * @param r Network rule.
         * @param name Modifier's name.
         * @returns Error {@link UnsupportedModifierError} or null if rule is supported.
         */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const checkMethodModifierFn = (r: NetworkRule, name: string): UnsupportedModifierError | null => {
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
        };

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
        const checkDocumentAllowlistFn = (r: NetworkRule, name: string): UnsupportedModifierError | null => {
            if (rule.isFilteringDisabled()) {
                return null;
            }

            return new UnsupportedModifierError(
                `Network rule with "${name}" modifier is not supported: "${r.getText()}"`,
                r,
            );
        };

        const unsupportedOptions = [
            /* Specific exceptions */
            { option: NetworkRuleOption.Elemhide, name: '$elemhide', skipConversion: true },
            { option: NetworkRuleOption.Generichide, name: '$generichide', skipConversion: true },
            { option: NetworkRuleOption.Specifichide, name: '$specifichide', skipConversion: true },
            { option: NetworkRuleOption.Genericblock, name: '$genericblock' },
            {
                option: NetworkRuleOption.Jsinject,
                name: '$jsinject',
                customChecks: [checkDocumentAllowlistFn],
            },
            {
                option: NetworkRuleOption.Urlblock,
                name: '$urlblock',
                customChecks: [checkDocumentAllowlistFn],
            },
            {
                option: NetworkRuleOption.Content,
                name: '$content',
                customChecks: [checkDocumentAllowlistFn],
            },
            { option: NetworkRuleOption.Extension, name: '$extension' },
            { option: NetworkRuleOption.Stealth, name: '$stealth' },
            /* Specific exceptions */
            {
                option: NetworkRuleOption.Popup,
                name: '$popup',
                customChecks: [checkOnlyOneModifier],
            },
            {
                option: NetworkRuleOption.Csp,
                name: '$csp',
                customChecks: [checkAllowRulesFn],
            },
            { option: NetworkRuleOption.Replace, name: '$replace' },
            {
                option: NetworkRuleOption.Cookie,
                name: '$cookie',
                customChecks: [checkAllowRulesFn, checkCookieModifierFn],
            },
            {
                option: NetworkRuleOption.Redirect,
                name: '$redirect',
                customChecks: [checkAllowRulesFn],
            },
            {
                option: NetworkRuleOption.RemoveParam,
                name: '$removeparam',
                customChecks: [checkAllowRulesFn, checkRemoveParamModifierFn],
            },
            {
                option: NetworkRuleOption.RemoveHeader,
                name: '$removeheader',
                customChecks: [checkAllowRulesFn, checkRemoveHeaderModifierFn],
            },
            {
                option: NetworkRuleOption.Method,
                name: '$method',
                customChecks: [checkMethodModifierFn],
            },
            { option: NetworkRuleOption.JsonPrune, name: '$jsonprune' },
            { option: NetworkRuleOption.Hls, name: '$hls' },
        ];

        for (let i = 0; i < unsupportedOptions.length; i += 1) {
            const {
                option,
                name,
                customChecks,
                skipConversion,
            } = unsupportedOptions[i];

            if (!rule.isOptionEnabled(option)) {
                continue;
            }

            if (skipConversion) {
                if (rule.isSingleOptionEnabled(option)) {
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
            } else {
                const msg = `Unsupported option "${name}" found in the rule: "${rule.getText()}"`;
                throw new UnsupportedModifierError(msg, rule);
            }
        }

        return true;
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
            // TODO: Fix these values based on Chrome Errors
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
     * Checks the captured conversion error, if it is one of the expected
     * conversion errors - returns it, otherwise adds information about
     * the original rule, packages it into a new error and returns it.
     *
     * @param rule An error was caught while converting this rule.
     * @param index Index of {@link IndexedRule}.
     * @param id Identifier of the desired declarative rule.
     * @param e Captured error.
     *
     * @returns Initial error or new packaged error.
     */
    private static catchErrorDuringConversion(
        rule: IRule,
        index: number,
        id: number,
        e: unknown,
    ): Error {
        if (e instanceof EmptyResourcesError
            || e instanceof TooComplexRegexpError
            || e instanceof UnsupportedModifierError
            || e instanceof UnsupportedRegexpError
        ) {
            return e;
        }

        const msg = `Non-categorized error during a conversion rule: ${rule.getText()} (index - ${index}, id - ${id})`;
        return e instanceof Error
            ? new Error(msg, { cause: e })
            : new Error(msg);
    }

    /**
     * Converts the provided set of indexed rules into declarative rules,
     * collecting source rule identifiers for declarative rules
     * and catching conversion errors.
     *
     * @param filterId An identifier for the filter.
     * @param rules Indexed rules.
     * @param offsetId Offset for the IDs of the converted rules.
     *
     * @returns Transformed declarative rules with their sources
     * and caught conversion errors.
     */
    protected convertRules(
        filterId: number,
        rules: IndexedRule[],
        offsetId: number,
    ): ConvertedRules {
        const res: ConvertedRules = {
            declarativeRules: [],
            errors: [],
            sourceMapValues: [],
        };

        rules.forEach(({ rule, index }: IndexedRule) => {
            const id = offsetId + index;
            let converted: DeclarativeRule[] = [];

            try {
                converted = this.convertRule(
                    rule as NetworkRule,
                    id,
                );
            } catch (e) {
                const err = DeclarativeRuleConverter.catchErrorDuringConversion(rule, index, id, e);
                res.errors.push(err);
                return;
            }

            // For each converted declarative rule save it's source.
            converted.forEach((dRule) => {
                res.sourceMapValues.push({
                    declarativeRuleId: dRule.id,
                    sourceRuleIndex: index,
                    filterId,
                });
                res.declarativeRules.push(dRule);
            });
        });

        return res;
    }

    /**
     * This function groups similar rules among those already converted into
     * declarative rules. If a similar rule is found, it combines the two
     * declarative rules into one.
     *
     * @param converted An instance of {@link ConvertedRules} that includes
     * converted declarative rules, recorded errors, and a hash mapping
     * declarative rule IDs to corresponding source test rule IDs.
     * @param createRuleTemplate A function that stores the template of
     * a declarative rule. This template is used to compare different
     * declarative rules.
     * @param combineRulePair A function that attempts to find a similar
     * declarative rule by comparing rule templates. If a match is found,
     * it merges the two declarative rules into one and returns combined rule.
     *
     * @returns Object with grouped similar declarative rules.
     */
    // eslint-disable-next-line class-methods-use-this
    protected groupConvertedRules(
        converted: ConvertedRules,
        createRuleTemplate: (rule: DeclarativeRule) => string,
        combineRulePair: (sourceRule: DeclarativeRule, ruleToMerge: DeclarativeRule) => DeclarativeRule,
    ): ConvertedRules {
        const rulesTemplates = new Map<string, DeclarativeRule>();

        const saveRuleTemplate = (rule: DeclarativeRule): void => {
            const template = createRuleTemplate(rule);
            rulesTemplates.set(template, rule);
        };

        const result: ConvertedRules = {
            declarativeRules: [],
            sourceMapValues: [],
            errors: converted.errors,
        };

        const { sourceMapValues, declarativeRules } = converted;

        declarativeRules.forEach((dRule) => {
            // Trying to find a declarative rule for siblings.
            const template = createRuleTemplate(dRule);
            const siblingDeclarativeRule = rulesTemplates.get(template);

            // Finds the source rule identifier.
            const source = sourceMapValues.find((s) => s.declarativeRuleId === dRule.id);
            if (source === undefined) {
                result.errors.push(new Error(`Cannot find source for converted rule "${dRule}"`));
                return;
            }

            // If a similar rule is found, the function combines the two
            // declarative rules into one and returns the resulting combined rule.
            if (siblingDeclarativeRule) {
                const combinedRule = combineRulePair(siblingDeclarativeRule, dRule);
                // Updates template.
                saveRuleTemplate(combinedRule);

                // Updates the declarative rule identified for the merged rule.
                result.sourceMapValues.push({
                    ...source,
                    declarativeRuleId: combinedRule.id,
                });
            } else {
                // If not found - saves the template part of the declarative
                // rule to compare it with next values.
                saveRuleTemplate(dRule);

                // Keeps the source unchanged because the current rule
                // has not been merged.
                result.sourceMapValues.push(source);
            }
        });

        result.declarativeRules = Array.from(rulesTemplates.values());

        return result;
    }

    /**
     * Converts provided bunch of indexed rules to declarative rules
     * via generating source map for it and catching errors of conversations.
     *
     * @param filterId Filter id.
     * @param rules Indexed rules.
     * @param offsetId Offset for the IDs of the converted rules.
     *
     * @returns Object of {@link ConvertedRules} which containing declarative
     * rules, source rule identifiers, errors and counter of regexp rules.
     */
    abstract convert(
        filterId: number,
        rules: IndexedRule[],
        offsetId: number,
    ): ConvertedRules;
}
