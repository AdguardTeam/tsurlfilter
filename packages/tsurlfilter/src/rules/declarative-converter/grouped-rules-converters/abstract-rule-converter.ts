/* eslint-disable jsdoc/require-description-complete-sentence */
/* eslint-disable jsdoc/no-multi-asterisks */
/**
 * @file Describes how to convert one {@link NetworkRule} into one or many
 * {@link DeclarativeRule|declarative rules}.
 *
 *      Heir classes                                        DeclarativeRuleConverter
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
 *                            │   declarative rules.                    │  ┌──┤ static shouldConvertNetworkRule()    │
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
/* eslint-enable jsdoc/require-description-complete-sentence */
/* eslint-enable jsdoc/no-multi-asterisks */

import punycode from 'punycode/punycode.js';
import { getRedirectFilename } from '@adguard/scriptlets/redirects';
import { RuleGenerator } from '@adguard/agtree/generator';

import { type NetworkRule, NetworkRuleOption } from '../../network-rule';
import { type RemoveParamModifier } from '../../../modifiers/remove-param-modifier';
import { type RequestType } from '../../../request-type';
import {
    DECLARATIVE_REQUEST_METHOD_MAP,
    DECLARATIVE_RESOURCE_TYPES_MAP,
    type DeclarativeRule,
    DomainType,
    HeaderOperation,
    type ModifyHeaderInfo,
    type Redirect,
    type RequestMethod,
    ResourceType,
    type RuleAction,
    type RuleActionHeaders,
    RuleActionType,
    type RuleCondition,
    type SupportedHttpMethod,
} from '../declarative-rule';
import {
    type ConversionError,
    EmptyResourcesError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
} from '../errors/conversion-errors';
import { type ConvertedRules } from '../converted-result';
import type { IRule } from '../../rule';
import { ResourcesPathError } from '../errors/converter-options-errors';
import { type RedirectModifier } from '../../../modifiers/redirect-modifier';
import { type RemoveHeaderModifier } from '../../../modifiers/remove-header-modifier';
import { CSP_HEADER_NAME } from '../../../modifiers/csp-modifier';
import { HTTPMethod } from '../../../modifiers/method-modifier';
import { PERMISSIONS_POLICY_HEADER_NAME } from '../../../modifiers/permissions-modifier';
import { SimpleRegex } from '../../simple-regex';
import { type IndexedNetworkRuleWithHash } from '../network-indexed-rule-with-hash';
import { NetworkRuleDeclarativeValidator } from '../network-rule-validator';
import { EmptyDomainsError } from '../errors/conversion-errors/empty-domains-error';
import { re2Validator } from '../re2-regexp/re2-validator';
import { getErrorMessage } from '../../../common/error';
import { type NetworkRuleWithNode } from '../network-rule-with-node';

/**
 * Contains the generic logic for converting a {@link NetworkRule}
 * into a {@link DeclarativeRule}.
 *
 * Descendant classes must override the {@link DeclarativeRuleConverter.convert} method,
 * where some logic must be defined for each rule type.
 *
 * Also descendant classes can use {@link DeclarativeRuleConverter.convertRules},
 * {@link DeclarativeRuleConverter.convertRule}
 * and {@link DeclarativeRuleConverter.groupConvertedRules} methods, which contains
 * the general logic of transformation and grouping of rules.
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
     * Converts to ASCII characters only if `str` contains non-ASCII characters.
     *
     * @param str String to convert.
     *
     * @returns A transformed string containing only ASCII characters or
     * the original string.
     *
     * @throws Error if conversion into ASCII fails.
     */
    private static prepareASCII(str: string): string {
        let res = str;

        try {
            if (!DeclarativeRuleConverter.isASCII(res)) {
                // for cyrillic domains we need to convert them by isASCII()
                res = punycode.toASCII(res);
            }
            // after toASCII() some characters can be still non-ASCII
            // e.g. `abc“@` with non-ASCII `“`
            if (!DeclarativeRuleConverter.isASCII(res)) {
                res = punycode.encode(res);
            }
        } catch (e: unknown) {
            throw new Error(`Error converting to ASCII: "${str}" due to ${getErrorMessage(e)}`);
        }

        return res;
    }

    /**
     * Removes slashes from the beginning and end of the string.
     * We do that because regexFilter does not support them.
     *
     * @param str String to remove slashes.
     * @returns String without slashes.
     */
    private static removeSlashes(str: string): string {
        if (str.startsWith('/') && str.endsWith('/')) {
            return str.substring(1, str.length - 1);
        }
        return str;
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
                throw new ResourcesPathError('Empty web accessible resources path');
            }
            const advancedModifier = rule.getAdvancedModifier();
            const redirectTo = advancedModifier as RedirectModifier;
            const filename = getRedirectFilename(redirectTo.getValue());

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
                        /**
                         * In case if param is encoded URI we need to decode it first:
                         * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3014.
                         */
                        removeParams: [decodeURIComponent(value)],
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
                const regexFilter = DeclarativeRuleConverter.removeSlashes(pattern);
                condition.regexFilter = DeclarativeRuleConverter.prepareASCII(regexFilter);
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

            /**
             * By default, we do not block the requests that
             * are loaded in the browser tab ("main_frame").
             */
            if (!condition.excludedResourceTypes.includes(ResourceType.MainFrame)) {
                condition.excludedResourceTypes.push(ResourceType.MainFrame);
            }
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

        // By default, this option is false, so there is no need to specify it everywhere.
        // We do it only if it is true.
        if (rule.isOptionEnabled(NetworkRuleOption.MatchCase)) {
            condition.isUrlFilterCaseSensitive = rule.isOptionEnabled(NetworkRuleOption.MatchCase);
        }

        /**
         * Adds the main_frame resource type to the resourceTypes if the popup modifier is enabled.
         * Popup rules apply only to document requests, so adding main_frame ensures the rules are correctly applied.
         */
        if (rule.isOptionEnabled(NetworkRuleOption.Popup)) {
            condition.resourceTypes = condition.resourceTypes || [];
            if (!condition.resourceTypes.includes(ResourceType.MainFrame)) {
                condition.resourceTypes.push(ResourceType.MainFrame);
            }
        }

        const emptyResourceTypes = !condition.resourceTypes && !condition.excludedResourceTypes;

        if (emptyResourceTypes) {
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
                || rule.isOptionEnabled(NetworkRuleOption.Cookie)
                || rule.isOptionEnabled(NetworkRuleOption.To)
                || rule.isOptionEnabled(NetworkRuleOption.Method);

            /**
             * $permissions and $removeparam modifiers must be applied only
             * to `document` content-type ('main_frame' and 'sub_frame')
             * if they don't have resource types.
             */
            const shouldMatchOnlyDocument = rule.isOptionEnabled(NetworkRuleOption.RemoveParam)
                || rule.isOptionEnabled(NetworkRuleOption.Permissions);

            if (shouldMatchAllResourcesTypes) {
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
            } else if (shouldMatchOnlyDocument) {
                condition.resourceTypes = [ResourceType.MainFrame, ResourceType.SubFrame];
            }
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
     * @param id Rule identifier.
     * @param rule Network rule.
     *
     * @throws An {@link UnsupportedModifierError} if the network rule
     * contains an unsupported modifier
     * OR an {@link EmptyResourcesError} if there is empty resources in the rule
     * OR an {@link UnsupportedRegexpError} if regexp is not supported in
     * the RE2 syntax.
     * OR a {@link ResourcesPathError} when specified an empty
     * path to the web accessible resources.
     *
     * @returns A list of declarative rules.
     */
    protected async convertRule(
        id: number,
        rule: NetworkRuleWithNode,
    ): Promise<DeclarativeRule[]> {
        // If the rule is not convertible - method will throw an error.
        const shouldConvert = NetworkRuleDeclarativeValidator.shouldConvertNetworkRule(rule);

        // The rule does not require conversion.
        if (!shouldConvert) {
            return [];
        }

        const declarativeRule: DeclarativeRule = {
            id,
            action: this.getAction(rule.rule),
            condition: DeclarativeRuleConverter.getCondition(rule.rule),
        };

        const priority = DeclarativeRuleConverter.getPriority(rule.rule);
        if (priority) {
            declarativeRule.priority = priority;
        }

        const conversionErr = await DeclarativeRuleConverter.checkDeclarativeRuleApplicable(
            rule,
            declarativeRule,
        );
        if (conversionErr) {
            throw conversionErr;
        }

        return [declarativeRule];
    }

    /**
     * Verifies whether the converted declarative rule passes the regular expression (regexp) validation.
     *
     * Additionally, it checks whether the rule contains resource types.
     *
     * Note: some complex regexps are not allowed,
     * e.g. back references, possessive quantifiers, negative lookaheads.
     *
     * @see {@link https://github.com/google/re2/wiki/Syntax}.
     *
     * @param networkRule The original network rule.
     * @param declarativeRule The converted declarative rule.
     *
     * @returns Different errors:
     * - {@link EmptyResourcesError} if the rule has empty resources,
     * - {@link UnsupportedRegexpError} if the regexp is not supported
     * by RE2 syntax (@see {@link https://github.com/google/re2/wiki/Syntax}),
     * - {@link EmptyDomainsError} if the declarative rule has empty domains
     * while the original rule has non-empty domains.
     */
    private static async checkDeclarativeRuleApplicable(
        networkRule: NetworkRuleWithNode,
        declarativeRule: DeclarativeRule,
    ): Promise<ConversionError | null> {
        const { regexFilter, resourceTypes } = declarativeRule.condition;

        if (resourceTypes?.length === 0) {
            return new EmptyResourcesError('Conversion resourceTypes is empty', networkRule, declarativeRule);
        }

        const permittedDomains = networkRule.rule.getPermittedDomains();
        if (permittedDomains && permittedDomains.length > 0) {
            const { initiatorDomains } = declarativeRule.condition;
            if (!initiatorDomains || initiatorDomains.length === 0) {
                const ruleText = RuleGenerator.generate(networkRule.node);
                const msg = `Conversion initiatorDomains is empty, but original rule's domains not: "${ruleText}"`;
                return new EmptyDomainsError(msg, networkRule, declarativeRule);
            }
        }

        // More complex regex than allowed as part of the "regexFilter" key.
        if (regexFilter) {
            try {
                await re2Validator.isRegexSupported(regexFilter);
            } catch (e) {
                const ruleText = RuleGenerator.generate(networkRule.node);
                const msg = `Regex is unsupported: "${ruleText}"`;
                return new UnsupportedRegexpError(
                    msg,
                    networkRule,
                    declarativeRule,
                    getErrorMessage(e),
                );
            }
        }

        return null;
    }

    /**
     * Checks the captured conversion error, if it is one of the expected
     * conversion errors - returns it, otherwise adds information about
     * the original rule, packages it into a new error and returns it.
     *
     * @param rule An error was caught while converting this rule.
     * @param index Index of {@link IndexedNetworkRuleWithHash}.
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
            || e instanceof UnsupportedModifierError
            || e instanceof UnsupportedRegexpError
            || e instanceof EmptyDomainsError
        ) {
            return e;
        }

        const msg = `Non-categorized error during a conversion rule (index - ${index}, id - ${id})`;
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
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     * Since we use hash of the rule text to generate ID, we need to ensure that
     * the ID is unique for the whole ruleset (especially when we convert
     * several filters into one ruleset).
     *
     * @returns Transformed declarative rules with their sources
     * and caught conversion errors.
     */
    protected async convertRules(
        filterId: number,
        rules: IndexedNetworkRuleWithHash[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        const res: ConvertedRules = {
            declarativeRules: [],
            errors: [],
            sourceMapValues: [],
        };

        await Promise.all(rules.map(async (r: IndexedNetworkRuleWithHash) => {
            const { rule, index } = r;

            const id = DeclarativeRuleConverter.generateUniqueId(r, usedIds);

            let converted: DeclarativeRule[] = [];

            try {
                converted = await this.convertRule(
                    id,
                    rule,
                );
            } catch (e) {
                const err = DeclarativeRuleConverter.catchErrorDuringConversion(rule.rule, index, id, e);
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
        }));

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
     * Creates unique ID for rule via adding salt to the hash of the rule if
     * found duplicate ID.
     *
     * @param r Indexed network rule with hash.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Unique ID for the rule.
     */
    private static generateUniqueId(r: IndexedNetworkRuleWithHash, usedIds: Set<number>): number {
        let id = r.getRuleTextHash();

        // While the ID is already used, we add salt to the hash of the rule.
        let salt = 0;
        while (usedIds.has(id)) {
            salt += 1;
            id = r.getRuleTextHash(salt);
        }

        usedIds.add(id);

        return id;
    }

    /**
     * Converts provided bunch of indexed rules to declarative rules
     * via generating source map for it and catching errors of conversations.
     *
     * @param filterId Filter id.
     * @param rules Indexed network rules with hashes.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Object of {@link ConvertedRules} which containing declarative
     * rules, source rule identifiers, errors and counter of regexp rules.
     */
    abstract convert(
        filterId: number,
        rules: IndexedNetworkRuleWithHash[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules>;
}
