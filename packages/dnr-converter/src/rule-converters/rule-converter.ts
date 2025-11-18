/* eslint-disable jsdoc/require-description-complete-sentence */
/* eslint-disable jsdoc/no-multi-asterisks */
/* eslint-disable max-len */
/**
 * @file Describes how to convert one {@link NetworkRule} into one or many {@link DeclarativeRule}.
 *
 *      Heir classes                                        DeclarativeRuleConverter
 *
 *                            │                                         │
 *    *override layer*        │              *protected layer*          │              *private layer*
 *                            │                                         │
 *                            │                                         │
 * Subclasses should define   │    Converts a set of {@link NetworkRule}│
 * the logic in this method.  │    into {@link DeclarativeRule} while   │
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
 *                            │   Transforms a single                   │                       │
 *                            │   {@link NetworkRule} into one.         │     ┌─────────────────▼────────────────────┐
 *                            │   or several {@link DeclarativeRule}    │     │                                      │
 *                            │                                         │  ┌──┤ static shouldConvertNetworkRule()    │
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
 *                            │                                         │  │  ┌──────────────────────────────────────────┐
 *                            │                                         │  └──►                                          │
 *                            │                                         │     │         private getRedirectAction()      │
 *                            │                                         │     │   static getRemoveParamRedirectAction()  │
 *                            │                                         │     │      static getModifyHeadersAction()     │
 *                            │                                         │     │     static getAddingCspHeadersAction()   │
 *                            │                                         │  ┌──┤                                          │
 *                            │                                         │  │  └──────────────────────────────────────────┘
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
 *                            │                                         │  │  ┌────────────────────────────────────┐
 *                            │                                         │  └──►                                    │
 *                            │                                         │     │  public NetworkRule.getPriority()  │
 *                            │                                         │  ┌──┤                                    │
 *                            │                                         │  │  └────────────────────────────────────┘
 *                            │                                         │  │  Generates the priority of
 *                            │                                         │  │  a declarative rule.
 *                            │                                         │  │
 *                            │                                         │  │  ┌───────────────────────────────────────┐
 *                            │                                         │  └──►                                       │
 *                            │                                         │     │     static checkRuleApplication()     │
 *                            │                                         │  ┌──┤                                       │
 *                            │                                         │  │  └───────────────────────────────────────┘
 *                            │                                         │  │  After conversion, checks if the generated
 *                            │                                         │  │  declarative rule contains any unsupported
 *                            │                                         │  │  values.
 *                            │                                         │  │
 *                            │                                         │  │  ┌─────────────────────────────────────┐
 *                            │                                         │  └──►                                     │
 *                            │                                         │     │    static catchConversionError()    │
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
/* eslint-enable max-len */
import { RuleGenerator } from '@adguard/agtree/generator';
import { getRedirectFilename } from '@adguard/scriptlets/redirects';

import { CSP_HEADER_NAME, MASK_ANY_CHARACTER, PERMISSIONS_POLICY_HEADER_NAME } from '../constants';
import {
    type DeclarativeRule,
    DomainType,
    HeaderOperation,
    type ModifyHeaderInfo,
    type Redirect,
    ResourceType,
    type RuleAction,
    type RuleActionHeaders,
    RuleActionType,
    type RuleCondition,
} from '../declarative-rule';
import {
    type ConversionError,
    EmptyDomainsError,
    EmptyResourcesError,
    isConversionError,
    UnsupportedRegexpError,
} from '../errors/conversion-errors';
import { ResourcesPathError } from '../errors/converter-options-errors';
import { type NetworkRule, NetworkRuleOption } from '../network-rule';
import { re2Validator } from '../re2-regexp/re2-validator';
import { getErrorMessage } from '../utils/error';
import {
    isRegexPattern,
    prepareASCII,
    removeSlashes,
    toASCII,
} from '../utils/string';

import { type ConvertedRules } from './converted-rules';

/**
 * @typedef {import('../errors/conversion-errors').UnsupportedModifierError} UnsupportedModifierError
 */

/**
 * Contains the generic logic for converting a {@link NetworkRule} into a {@link DeclarativeRule}.
 *
 * Descendant classes must override the {@link RuleConverter.convert}
 * method, where some logic must be defined for each rule type.
 *
 * Also descendant classes can use {@link RuleConverter.convertRules},
 * {@link RuleConverter.convertRule} and {@link RuleConverter.groupConvertedRules}
 * methods, which contains the general logic of transformation and grouping of rules.
 */
export abstract class RuleConverter {
    /**
     * Resource types that are compatible with {@link RuleActionType.AllowAllRequests}.
     */
    private static readonly ALLOW_ALL_REQUEST_COMPATIBLE_RESOURCE_TYPES: Set<ResourceType> = new Set([
        ResourceType.MainFrame,
        ResourceType.SubFrame,
    ]);

    /**
     * String path to web accessible resources, relative to the extension root dir.
     * Should start with leading slash and end without trailing slash (`'/'`).
     */
    protected webAccessibleResourcesPath?: string;

    /**
     * Constructor of {@link RuleConverter}.
     *
     * @param webAccessibleResourcesPath Path to web accessible resources.
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;
    }

    /**
     * Checks if {@link NetworkRule} can be converted to {@link RuleActionType.AllowAllRequests}.
     *
     * @param rule {@link NetworkRule} to check.
     *
     * @returns Is rule compatible with {@link RuleActionType.AllowAllRequests}.
     */
    private static isCompatibleWithAllowAllRequests(rule: NetworkRule): boolean {
        const types = rule.getPermittedResourceTypes();

        if (types.some((type) => !RuleConverter.ALLOW_ALL_REQUEST_COMPATIBLE_RESOURCE_TYPES.has(type))) {
            return false;
        }

        return true;
    }

    /**
     * Retrieves the redirect action for the provided {@link NetworkRule}.
     *
     * @param rule {@link NetworkRule} to get action for.
     *
     * @returns Redirect action, which describes where and how the request should be redirected.
     *
     * @throws Error {@link ResourcesPathError} when a network rule has
     * a `$redirect` modifier and no path to web-accessible resources is specified.
     */
    private getRedirectAction(rule: NetworkRule): Redirect | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
            return null;
        }

        const value = rule.getAdvancedModifierValue();
        if (!value) {
            return null;
        }

        const resourcesPath = this.webAccessibleResourcesPath;
        if (!resourcesPath) {
            throw new ResourcesPathError('Empty web accessible resources path');
        }

        const filename = getRedirectFilename(value);
        return {
            extensionPath: `${resourcesPath}/${filename}`,
        };
    }

    /**
     * Retrieves the remove param redirect action for the provided {@link NetworkRule}.
     *
     * @param rule {@link NetworkRule} to get action for.
     *
     * @returns Redirect action, which describes where and how the request should be redirected.
     */
    private static getRemoveParamRedirectAction(rule: NetworkRule): Redirect | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.RemoveParam)) {
            return null;
        }

        const value = rule.getAdvancedModifierValue();
        if (value === null) {
            return null;
        }

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

    /**
     * Returns rule modify headers action.
     *
     * @param rule {@link NetworkRule} to get action for.
     *
     * @returns Modify headers action, which describes which
     * headers should be changed: added, set or deleted.
     */
    private static getModifyHeadersAction(rule: NetworkRule): RuleActionHeaders | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)) {
            return null;
        }

        const removeRequestHeader = rule.getApplicableHeaderName(true);
        if (removeRequestHeader) {
            return {
                requestHeaders: [{
                    header: removeRequestHeader,
                    operation: HeaderOperation.Remove,
                }],
            };
        }

        const removeResponseHeader = rule.getApplicableHeaderName(false);
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
     * @param rule {@link NetworkRule} to get action for.
     *
     * @returns Add headers action, which describes which headers should be added.
     */
    private static getRemovingCookieHeadersAction(rule: NetworkRule): RuleActionHeaders | null {
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
     * @param rule {@link NetworkRule} to get action for.
     *
     * @returns Add headers action, which describes what headers should be added.
     */
    private static getAddingCspHeadersAction(rule: NetworkRule): ModifyHeaderInfo | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.Csp)) {
            return null;
        }

        const cspHeaderValue = rule.getAdvancedModifierValue();
        if (!cspHeaderValue) {
            return null;
        }

        return {
            operation: HeaderOperation.Append,
            header: CSP_HEADER_NAME,
            value: cspHeaderValue,
        };
    }

    /**
     * Returns rule modify headers action with adding Permissions headers to response.
     *
     * @param rule {@link NetworkRule} to get action for.
     *
     * @returns Add headers action, which describes what headers should be added.
     */
    private static getAddingPermissionsHeadersAction(rule: NetworkRule): ModifyHeaderInfo | null {
        if (!rule.isOptionEnabled(NetworkRuleOption.Permissions)) {
            return null;
        }

        const permissionsHeaderValue = rule.getAdvancedModifierValue();
        if (!permissionsHeaderValue) {
            return null;
        }

        return {
            operation: HeaderOperation.Append,
            header: PERMISSIONS_POLICY_HEADER_NAME,
            value: permissionsHeaderValue,
        };
    }

    /**
     * Retrieves the action for the provided {@link NetworkRule}.
     *
     * @param rule {@link NetworkRule} to get action for.
     *
     * @returns The action of a rule that describes what should be done with the request.
     *
     * @throws Error {@link ResourcesPathError} when specified an empty path to the web accessible resources.
     */
    private getAction(rule: NetworkRule): RuleAction {
        if (rule.isAllowlist()) {
            if (rule.isFilteringDisabled() && RuleConverter.isCompatibleWithAllowAllRequests(rule)) {
                return { type: RuleActionType.AllowAllRequests };
            }

            return { type: RuleActionType.Allow };
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
            const redirectAction = this.getRedirectAction(rule);
            if (redirectAction) {
                return {
                    type: RuleActionType.Redirect,
                    redirect: redirectAction,
                };
            }
        }

        if (rule.isOptionEnabled(NetworkRuleOption.RemoveParam)) {
            const removeParamRedirectAction = RuleConverter.getRemoveParamRedirectAction(rule);
            if (removeParamRedirectAction) {
                return {
                    type: RuleActionType.Redirect,
                    redirect: removeParamRedirectAction,
                };
            }
        }

        if (rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)) {
            const modifyHeadersAction = RuleConverter.getModifyHeadersAction(rule);

            if (modifyHeadersAction?.requestHeaders) {
                return {
                    type: RuleActionType.ModifyHeaders,
                    requestHeaders: modifyHeadersAction.requestHeaders,
                };
            }

            if (modifyHeadersAction?.responseHeaders) {
                return {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: modifyHeadersAction.responseHeaders,
                };
            }
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Csp)) {
            const headersAction = RuleConverter.getAddingCspHeadersAction(rule);
            if (headersAction) {
                return {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [headersAction],
                };
            }
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Permissions)) {
            const headersAction = RuleConverter.getAddingPermissionsHeadersAction(rule);
            if (headersAction) {
                return {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [headersAction],
                };
            }
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Cookie)) {
            const removeCookieHeaders = RuleConverter.getRemovingCookieHeadersAction(rule);
            if (removeCookieHeaders) {
                const { responseHeaders, requestHeaders } = removeCookieHeaders;

                return {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders,
                    requestHeaders,
                };
            }
        }

        return { type: RuleActionType.Block };
    }

    /**
     * Retrieves the condition for the provided {@link NetworkRule}.
     *
     * @param rule {@link NetworkRule} to get condition for.
     *
     * @returns A rule condition that describes to which request the declarative rule should be applied.
     */
    private static getCondition(rule: NetworkRule): RuleCondition {
        const condition: RuleCondition = {};

        // set `urlFilter` or `regexFilter` depending on the pattern type
        const pattern = rule.getPattern();
        if (pattern) {
            if (rule.isRegexRule()) {
                condition.regexFilter = prepareASCII(removeSlashes(pattern));
            } else {
                // A pattern beginning with ||* is not allowed. Use * instead.
                const patternWithoutVerticals = pattern.startsWith('||*')
                    ? pattern.substring(2)
                    : pattern;
                condition.urlFilter = prepareASCII(patternWithoutVerticals);
            }
        }

        // set `domainType`
        if (rule.isOptionEnabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.ThirdParty;
        } else if (rule.isOptionDisabled(NetworkRuleOption.ThirdParty)) {
            condition.domainType = DomainType.FirstParty;
        }

        // set `initiatorDomains`
        const permittedDomains = rule.getPermittedDomains()?.filter((domain) => (
            !domain.includes(MASK_ANY_CHARACTER)
            && !isRegexPattern(domain)
        ));
        if (permittedDomains && permittedDomains.length > 0) {
            condition.initiatorDomains = toASCII(permittedDomains);
        }

        // set `excludedInitiatorDomains`
        const excludedDomains = rule.getRestrictedDomains();
        if (excludedDomains && excludedDomains.length > 0) {
            condition.excludedInitiatorDomains = toASCII(excludedDomains);
        }

        // set `requestDomains`
        const permittedToDomains = rule.getPermittedToDomains();
        if (permittedToDomains && permittedToDomains.length > 0) {
            condition.requestDomains = toASCII(permittedToDomains);
        }

        // Can be specified `$to` or `$denyallow`, but not together.
        const denyAllowDomains = rule.getDenyAllowDomains();
        const restrictedToDomains = rule.getRestrictedToDomains();

        // set `excludedRequestDomains`
        if (denyAllowDomains && denyAllowDomains.length !== 0) {
            condition.excludedRequestDomains = toASCII(denyAllowDomains);
        } else if (restrictedToDomains && restrictedToDomains.length !== 0) {
            condition.excludedRequestDomains = toASCII(restrictedToDomains);
        }

        // set `excludedResourceTypes`
        const restrictedResourceTypes = rule.getRestrictedResourceTypes();
        const hasExcludedResourceTypes = restrictedResourceTypes.length !== 0;
        if (hasExcludedResourceTypes) {
            // Deep copy to drop reference linking
            condition.excludedResourceTypes = JSON.parse(JSON.stringify(restrictedResourceTypes)) as ResourceType[];

            /**
             * By default, we do not block the requests that
             * are loaded in the browser tab ({@link ResourceType.MainFrame}).
             */
            if (!condition.excludedResourceTypes.includes(ResourceType.MainFrame)) {
                condition.excludedResourceTypes.push(ResourceType.MainFrame);
            }
        }

        // set `resourceTypes`
        const permittedResourceTypes = rule.getPermittedResourceTypes();
        if (!hasExcludedResourceTypes && permittedResourceTypes.length !== 0) {
            condition.resourceTypes = permittedResourceTypes;
        }

        // set `requestMethods`
        const permittedMethods = rule.getPermittedMethods();
        if (permittedMethods && permittedMethods.length !== 0) {
            condition.requestMethods = permittedMethods;
        }

        // set `excludedRequestMethods`
        const restrictedMethods = rule.getRestrictedMethods();
        if (restrictedMethods && restrictedMethods.length !== 0) {
            condition.excludedRequestMethods = restrictedMethods;
        }

        /**
         * Set `isUrlFilterCaseSensitive` if the `$match-case` modifier is specified,
         * because by default this option is false, so no need to specify it everywhere.
         */
        if (rule.isOptionEnabled(NetworkRuleOption.MatchCase)) {
            condition.isUrlFilterCaseSensitive = true;
        }

        /**
         * Adds the {@link ResourceType.MainFrame} to the `resourceTypes`
         * if the popup modifier is enabled. Popup rules apply only
         * to document requests, so adding {@link ResourceType.MainFrame}
         * ensures the rules are correctly applied.
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
             * Here we need to set {@link ResourceType.MainFrame} to apply to document requests
             * as well (because by default it applies to all requests except document).
             * And if we specify {@link ResourceType.MainFrame}, then we also need to specify all
             * other types, so that it works not only for document requests, but
             * also for all other types of requests.
             */
            const shouldMatchAllResourcesTypes = rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)
                || rule.isOptionEnabled(NetworkRuleOption.Csp)
                || rule.isOptionEnabled(NetworkRuleOption.Cookie)
                || rule.isOptionEnabled(NetworkRuleOption.To)
                || rule.isOptionEnabled(NetworkRuleOption.Method);

            /**
             * `$permissions` and `$removeparam` modifiers must be applied only to `document` content-type
             * ({@link ResourceType.MainFrame} and {@link ResourceType.SubFrame}) if they don't have resource types.
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
     * Converts the {@link NetworkRule} into a {@link DeclarativeRule}.
     *
     * @param id Rule ID.
     * @param rule {@link NetworkRule} to convert.
     *
     * @returns Converted {@link DeclarativeRule}.
     *
     * @throws An {@link UnsupportedModifierError} if the network rule contains an unsupported modifier
     * OR an {@link EmptyResourcesError} if there is empty resources in the rule
     * OR an {@link UnsupportedRegexpError} if regexp is not supported in the RE2 syntax.
     * OR a {@link ResourcesPathError} when specified an empty path to the web accessible resources.
     */
    protected async convertRule(
        id: number,
        rule: NetworkRule,
    ): Promise<DeclarativeRule> {
        // Build declarative rule
        const declarativeRule: DeclarativeRule = {
            id,
            action: this.getAction(rule),
            condition: RuleConverter.getCondition(rule),
        };

        // Set calculated priority
        declarativeRule.priority = rule.getPriority();

        // Validate created declarative rule and throw error if not valid
        const conversionErr = await RuleConverter.checkRuleApplication(rule, declarativeRule);
        if (conversionErr) {
            throw conversionErr;
        }

        return declarativeRule;
    }

    /**
     * Verifies whether the converted {@link DeclarativeRule}:
     * - has non-empty resource types,
     * - has non-empty initiator domains if the original rule has permitted domains,
     * - has supported regexp syntax in the `regexFilter` key.
     *
     * Note: some complex regexps are not allowed, e.g. back references,
     * possessive quantifiers, negative lookaheads.
     *
     * @see {@link https://github.com/google/re2/wiki/Syntax}.
     *
     * @param rule The original {@link NetworkRule}.
     * @param declarativeRule The converted {@link DeclarativeRule}.
     *
     * @returns Different errors:
     * - {@link EmptyResourcesError} if the rule has empty resources,
     * - {@link UnsupportedRegexpError} if the regexp is not supported
     *   by RE2 syntax (See {@link https://github.com/google/re2/wiki/Syntax | syntax}),
     * - {@link EmptyDomainsError} if the declarative rule has empty domains
     *   while the original rule has non-empty domains.
     */
    private static async checkRuleApplication(
        rule: NetworkRule,
        declarativeRule: DeclarativeRule,
    ): Promise<ConversionError | null> {
        const { regexFilter, resourceTypes } = declarativeRule.condition;

        // Check for empty resource types
        if (resourceTypes?.length === 0) {
            return new EmptyResourcesError('Conversion resourceTypes is empty', rule, declarativeRule);
        }

        // Check for empty initiator domains if original rule has permitted domains
        const permittedDomains = rule.getPermittedDomains();
        if (permittedDomains && permittedDomains.length > 0) {
            const { initiatorDomains } = declarativeRule.condition;
            if (!initiatorDomains || initiatorDomains.length === 0) {
                const ruleText = RuleGenerator.generate(rule.getNode());
                const msg = `Conversion initiatorDomains is empty, but original rule's domains not: "${ruleText}"`;
                return new EmptyDomainsError(msg, rule, declarativeRule);
            }
        }

        // Check for unsupported regexps
        if (regexFilter) {
            try {
                await re2Validator.isRegexSupported(regexFilter);
            } catch (e) {
                const ruleText = RuleGenerator.generate(rule.getNode());
                const message = `Regex is unsupported in rule: "${ruleText}"`;
                return new UnsupportedRegexpError(
                    message,
                    rule,
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
     * @param index Index of {@link NetworkRule}.
     * @param id Identifier of the desired declarative rule.
     * @param error Captured error.
     *
     * @returns Initial error or new packaged error.
     */
    private static catchConversionError(
        index: number,
        id: number,
        error: unknown,
    ): Error {
        if (isConversionError(error)) {
            return error;
        }

        const message = `Non-categorized error during a conversion rule (index - ${index}, id - ${id})`;
        return error instanceof Error
            ? new Error(message, { cause: error })
            : new Error(message);
    }

    /**
     * Converts the provided list of {@link NetworkRule} into {@link DeclarativeRule},
     * collecting source rule identifiers for declarative rules and catching conversion errors.
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link NetworkRule}.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     * Since we use hash of the rule text to generate ID, we need to ensure that
     * the ID is unique for the whole ruleset (especially when we convert
     * several filters into one ruleset).
     *
     * @returns Object of {@link ConvertedRules} which containing
     * declarative rules, source rule identifiers, errors.
     */
    protected async convertRules(
        filterListId: number,
        rules: NetworkRule[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        const res: ConvertedRules = {
            declarativeRules: [],
            errors: [],
            sourceMapValues: [],
        };

        await Promise.all(rules.map(async (rule: NetworkRule) => {
            const index = rule.getIndex();
            const id = RuleConverter.generateId(rule, usedIds);

            try {
                // Convert rule and collect source map value
                const converted = await this.convertRule(id, rule);
                res.sourceMapValues.push({
                    declarativeRuleId: converted.id,
                    sourceRuleIndex: index,
                    filterId: filterListId,
                });
                res.declarativeRules.push(converted);
            } catch (e) {
                const err = RuleConverter.catchConversionError(index, id, e);
                res.errors.push(err);
            }
        }));

        return res;
    }

    /**
     * This function groups similar rules among those already
     * converted into {@link DeclarativeRule}. If a similar
     * rule is found, it combines the two {@link DeclarativeRule} into one.
     *
     * @param converted An instance of {@link ConvertedRules} that includes
     * converted declarative rules, recorded errors, and a hash mapping
     * declarative rule IDs to corresponding source test rule IDs.
     * @param createRuleTemplate A function that generates the template of
     * a declarative rule. This template is used to compare different
     * declarative rules.
     * @param combineRulePair A function that combines two similar
     * declarative rules into one by merging their specific properties.
     *
     * @returns Object with grouped similar declarative rules.
     */
    protected static groupConvertedRules(
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
        declarativeRules.forEach((declarativeRule) => {
            // Try to find a sibling declarative rule
            const template = createRuleTemplate(declarativeRule);
            const siblingDeclarativeRule = rulesTemplates.get(template);

            // Try to find the source mapping for the current declarative rule
            const source = sourceMapValues.find((s) => s.declarativeRuleId === declarativeRule.id);
            if (source === undefined) {
                result.errors.push(new Error(`Cannot find source for converted rule "${declarativeRule}"`));
                return;
            }

            /**
             * If a similar rule is found, combine the two declarative rules into one
             * and save the combined rule's template for future comparisons.
             * Also, update the source mapping to reflect the new combined rule ID.
             *
             * If no similar rule is found, simply save the current
             * rule's template and add the source mapping as is.
             */
            if (siblingDeclarativeRule) {
                const combinedRule = combineRulePair(siblingDeclarativeRule, declarativeRule);
                saveRuleTemplate(combinedRule);
                result.sourceMapValues.push({
                    ...source,
                    declarativeRuleId: combinedRule.id,
                });
            } else {
                saveRuleTemplate(declarativeRule);
                result.sourceMapValues.push(source);
            }
        });

        result.declarativeRules = Array.from(rulesTemplates.values());

        return result;
    }

    /**
     * Creates unique ID for rule via adding salt to the hash of the rule if found duplicate ID.
     *
     * @param rule {@link NetworkRule} to generate ID for.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Unique ID for the rule.
     */
    private static generateId(rule: NetworkRule, usedIds: Set<number>): number {
        let id = rule.getRuleTextHash();

        // While the ID is already used, we add salt to the hash of the rule
        let salt = 0;
        while (usedIds.has(id)) {
            salt += 1;
            id = rule.getRuleTextHash(salt);
        }

        usedIds.add(id);

        return id;
    }

    /**
     * Converts provided bunch of {@link NetworkRule} to {@link DeclarativeRule}
     * via generating source map for it and catching errors of conversations.
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link NetworkRule}.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Object of {@link ConvertedRules} which containing
     * declarative rules, source rule identifiers, errors.
     */
    public abstract convert(
        filterListId: number,
        rules: NetworkRule[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules>;
}
