/* eslint-disable jsdoc/require-description-complete-sentence */
/* eslint-disable jsdoc/no-multi-asterisks */
/* eslint-disable max-len */
/**
 * @file Describes how to convert one {@link Rule} into one or many {@link DeclarativeRule}.
 *
 *      Heir classes                                        RuleConverter
 *
 *                            │                                         │
 *    *override layer*        │              *protected layer*          │              *private layer*
 *                            │                                         │
 *                            │                                         │
 * Subclasses should define   │    Converts a set of {@link Rule}│
 * the logic in this method.  │    into {@link DeclarativeRule} while   │
 *                            │    handling errors.                     │
 *  ┌─────────────────────┐   │   ┌───────────────────────────┐         │
 *  │                     │   │   │                           │         │
 *  │   public convert()  ├───┼──►│  protected convertRules() │         │
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
 *                            │   {@link Rule} into one.         │     ┌─────────────────▼────────────────────┐
 *                            │   or several {@link DeclarativeRule}    │     │                                      │
 *                            │                                         │  ┌──┤      private getAction()             │
 *                            │                                         │  │  │                                      │
 *                            │                                         │  │  └──────────────────────────────────────┘
 *                            │                                         │  │  Generates the action section
 *                            │                                         │  │  of a declarative rule.
 *                            │                                         │  │
 *                            │                                         │  │  ┌───────────────────────────────────────────┐
 *                            │                                         │  └──►                                           │
 *                            │                                         │     │         private getRedirectAction()       │
 *                            │                                         │     │    static getRemoveParamRedirectAction()  │
 *                            │                                         │     │       static getModifyHeadersAction()     │
 *                            │                                         │     │ static getRemovingCookieHeadersAction()   │
 *                            │                                         │     │      static getAddingCspHeadersAction()   │
 *                            │                                         │  ┌──┤ static getAddingPermissionsHeadersAction()│
 *                            │                                         │  │  └───────────────────────────────────────────┘
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
 *                            │                                         │     │  public Rule.getPriority()  │
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

import {
    CSP_HEADER_NAME,
    MASK_ANY_CHARACTER,
    MASK_NEGATE_CHARACTER,
    MASK_REGEX_RULE,
    PERMISSIONS_POLICY_HEADER_NAME,
} from '../constants';
import {
    type DeclarativeRule,
    DomainType,
    type HeaderInfo,
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
import { re2Validator } from '../re2-regexp/re2-validator';
import { OPTION_NAMES } from '../rule/option-names';
import { type Rule } from '../rule/rule';
import { RuleDeclarativeValidator } from '../rule/rule-validator';
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
 * Contains the generic logic for converting a {@link Rule} into a {@link DeclarativeRule}.
 *
 * Descendant classes can override the {@link RegularRuleConverter.convert}
 * method to add post-processing logic (e.g. grouping similar rules).
 *
 * Also descendant classes can use {@link RegularRuleConverter.convertRules},
 * {@link RegularRuleConverter.convertRule} and {@link RegularRuleConverter.groupConvertedRules}
 * methods, which contains the general logic of transformation and grouping of rules.
 */
export class RegularRuleConverter {
    /**
     * Resource types that are compatible with {@link RuleActionType.AllowAllRequests}.
     */
    private static readonly ALLOW_ALL_REQUEST_COMPATIBLE_RESOURCE_TYPES: Set<ResourceType> = new Set([
        ResourceType.MainFrame,
        ResourceType.SubFrame,
    ]);

    /**
     * Characters that have special meaning in Chrome DNR urlFilter syntax.
     * If a $removeparam param name contains any of these, we cannot safely
     * embed it as a urlFilter token and must skip the augmentation.
     */
    private static readonly URL_FILTER_SPECIAL_CHARS = /[|*^]/;

    /**
     * Pipe character used as a separator in $removeparam multi-value rules,
     * e.g. `$removeparam=utm_source|utm_medium`.
     */
    private static readonly PIPE_SEPARATOR = '|';

    /**
     * String path to web accessible resources, relative to the extension root dir.
     * Should start with leading slash and end without trailing slash (`'/'`).
     */
    protected webAccessibleResourcesPath?: string;

    /**
     * Constructor of {@link RegularRuleConverter}.
     *
     * @param webAccessibleResourcesPath Path to web accessible resources.
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;
    }

    /**
     * Checks if {@link Rule} can be converted to {@link RuleActionType.AllowAllRequests}.
     *
     * @param rule {@link Rule} to check.
     *
     * @returns Is rule compatible with {@link RuleActionType.AllowAllRequests}.
     */
    private static isCompatibleWithAllowAllRequests(rule: Rule): boolean {
        const types = rule.permittedResourceTypes;

        if (types.some((type) => !RegularRuleConverter.ALLOW_ALL_REQUEST_COMPATIBLE_RESOURCE_TYPES.has(type))) {
            return false;
        }

        return true;
    }

    /**
     * Retrieves the redirect action for the provided {@link Rule}.
     *
     * @param rule {@link Rule} to get action for.
     *
     * @returns Redirect action, which describes where and how the request should be redirected.
     *
     * @throws Error {@link ResourcesPathError} when a network rule has
     * a `$redirect` modifier and no path to web-accessible resources is specified.
     */
    private getRedirectAction(rule: Rule): Redirect | null {
        if (!rule.isModifierEnabled(OPTION_NAMES.REDIRECT)) {
            return null;
        }

        const value = rule.advancedModifierValue;
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
     * Returns a redirect action for a `$removeparam` rule.
     *
     * Pipe-separated values (e.g. `utm_source|utm_medium`) are
     * split into individual `removeParams` entries.
     *
     * In case if a param is an encoded URI, it is decoded first:
     * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3014.
     *
     * @param rule {@link Rule} to get action for.
     *
     * @returns Redirect action, or `null` if the rule does not have a
     * `$removeparam` modifier, its value is `null`, or a param value cannot be
     * URI-decoded (in which case augmentation is skipped).
     */
    private static getRemoveParamRedirectAction(rule: Rule): Redirect | null {
        if (!rule.isModifierEnabled(OPTION_NAMES.REMOVEPARAM)) {
            return null;
        }

        const value = rule.advancedModifierValue;
        if (value === null) {
            return null;
        }

        if (value === '') {
            return { transform: { query: '' } };
        }

        // Split on pipe to support multiple param names in a single rule.
        // If any segment contains invalid percent-encoding, decoding throws;
        // skip augmentation by returning null, consistent with getRemoveParamToken().
        let removeParams: string[];
        try {
            removeParams = value
                .split(RegularRuleConverter.PIPE_SEPARATOR)
                .map((p) => decodeURIComponent(p));
        } catch {
            return null;
        }

        return {
            transform: {
                queryTransform: { removeParams },
            },
        };
    }

    /**
     * Builds a param-aware urlFilter token for a $removeparam rule.
     *
     * For a rule like `$removeparam=utm_source` this method
     * returns the string `^utm_source=` where the caret acts
     * as a DNR separator matching query delimiters.
     *
     * Returns `null` when augmentation should be skipped:
     * - empty or null param value (strip-all-params rule).
     * - negation (`~param`).
     * - regex (`/pattern/`).
     * - pipe-separated values (`a|b`) — cannot generate a single token.
     * - whitespace-only param name.
     * - value cannot be URI-decoded.
     * - param name contains urlFilter special characters (`|`, `*`, `^`).
     *
     * @param rule Rule with $removeparam modifier enabled.
     *
     * @returns A urlFilter token string, or null if augmentation should be skipped.
     */
    private static getRemoveParamToken(rule: Rule): string | null {
        const value = rule.advancedModifierValue;

        // Skip augmentation for strip-all, negation, regex, and pipe-separated params.
        if (
            !value
            || value.startsWith(MASK_NEGATE_CHARACTER)
            || value.startsWith(MASK_REGEX_RULE)
            || value.includes(RegularRuleConverter.PIPE_SEPARATOR)
        ) {
            return null;
        }

        let decoded: string;
        try {
            decoded = decodeURIComponent(value);
        } catch {
            return null;
        }

        // Whitespace-only param names cannot form a useful urlFilter token.
        if (!decoded || decoded.trim() === '') {
            return null;
        }

        // If the decoded param name contains urlFilter special characters,
        // we cannot safely embed it — fall back to non-augmented behavior.
        if (RegularRuleConverter.URL_FILTER_SPECIAL_CHARS.test(decoded)) {
            return null;
        }

        return `^${decoded}=`;
    }

    /**
     * Returns rule modify headers action.
     *
     * @param rule {@link Rule} to get action for.
     *
     * @returns Modify headers action, which describes which
     * headers should be changed: added, set or deleted.
     */
    private static getModifyHeadersAction(rule: Rule): RuleActionHeaders | null {
        if (!rule.isModifierEnabled(OPTION_NAMES.REMOVEHEADER)) {
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
     * @param rule {@link Rule} to get action for.
     *
     * @returns Add headers action, which describes which headers should be added.
     */
    private static getRemovingCookieHeadersAction(rule: Rule): RuleActionHeaders | null {
        if (!rule.isModifierEnabled(OPTION_NAMES.COOKIE)) {
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
     * @param rule {@link Rule} to get action for.
     *
     * @returns Add headers action, which describes what headers should be added.
     */
    private static getAddingCspHeadersAction(rule: Rule): ModifyHeaderInfo | null {
        if (!rule.isModifierEnabled(OPTION_NAMES.CSP)) {
            return null;
        }

        const cspHeaderValue = rule.advancedModifierValue;
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
     * @param rule {@link Rule} to get action for.
     *
     * @returns Add headers action, which describes what headers should be added.
     */
    private static getAddingPermissionsHeadersAction(rule: Rule): ModifyHeaderInfo | null {
        if (!rule.isModifierEnabled(OPTION_NAMES.PERMISSIONS)) {
            return null;
        }

        const permissionsHeaderValue = rule.advancedModifierValue;
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
     * Retrieves the action for the provided {@link Rule}.
     *
     * @param rule {@link Rule} to get action for.
     *
     * @returns The action of a rule that describes what should be done with the request.
     *
     * @throws Error {@link ResourcesPathError} when specified an empty path to the web accessible resources.
     */
    private getAction(rule: Rule): RuleAction {
        if (rule.allowlist) {
            if (rule.isFilteringDisabled() && RegularRuleConverter.isCompatibleWithAllowAllRequests(rule)) {
                return { type: RuleActionType.AllowAllRequests };
            }

            return { type: RuleActionType.Allow };
        }

        if (rule.isModifierEnabled(OPTION_NAMES.REDIRECT)) {
            const redirectAction = this.getRedirectAction(rule);
            if (redirectAction) {
                return {
                    type: RuleActionType.Redirect,
                    redirect: redirectAction,
                };
            }
        }

        if (rule.isModifierEnabled(OPTION_NAMES.REMOVEPARAM)) {
            const removeParamRedirectAction = RegularRuleConverter.getRemoveParamRedirectAction(rule);
            if (removeParamRedirectAction) {
                return {
                    type: RuleActionType.Redirect,
                    redirect: removeParamRedirectAction,
                };
            }
        }

        if (rule.isModifierEnabled(OPTION_NAMES.REMOVEHEADER)) {
            const modifyHeadersAction = RegularRuleConverter.getModifyHeadersAction(rule);

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

        if (rule.isModifierEnabled(OPTION_NAMES.CSP)) {
            const headersAction = RegularRuleConverter.getAddingCspHeadersAction(rule);
            if (headersAction) {
                return {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [headersAction],
                };
            }
        }

        if (rule.isModifierEnabled(OPTION_NAMES.PERMISSIONS)) {
            const headersAction = RegularRuleConverter.getAddingPermissionsHeadersAction(rule);
            if (headersAction) {
                return {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [headersAction],
                };
            }
        }

        if (rule.isModifierEnabled(OPTION_NAMES.COOKIE)) {
            const removeCookieHeaders = RegularRuleConverter.getRemovingCookieHeadersAction(rule);
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
     * Retrieves the condition for the provided {@link Rule}.
     *
     * @param rule {@link Rule} to get condition for.
     *
     * @returns A rule condition that describes to which request the declarative rule should be applied.
     */
    private static getCondition(rule: Rule): RuleCondition {
        const condition: RuleCondition = {};

        // set `urlFilter` or `regexFilter` depending on the pattern type
        const { pattern } = rule;
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

        // For $removeparam rules with a specific named parameter, append
        // a param-aware token to urlFilter so that the rule only matches
        // when the target parameter is present in the URL query string.
        // This enables Chrome DNR to chain multiple redirect hops,
        // stripping one parameter per hop until all are removed.
        if (rule.isModifierEnabled(OPTION_NAMES.REMOVEPARAM)) {
            const paramToken = RegularRuleConverter.getRemoveParamToken(rule);
            if (paramToken !== null) {
                if (condition.urlFilter) {
                    condition.urlFilter += `*${paramToken}`;
                } else if (!condition.regexFilter) {
                    condition.urlFilter = paramToken;
                }
            }
        }

        // set `domainType`
        if (rule.isModifierEnabled(OPTION_NAMES.THIRD_PARTY)) {
            condition.domainType = DomainType.ThirdParty;
        } else if (rule.isModifierDisabled(OPTION_NAMES.THIRD_PARTY)) {
            condition.domainType = DomainType.FirstParty;
        }

        // set `initiatorDomains`
        const permittedDomains = rule.permittedDomains?.filter((domain) => (
            !domain.includes(MASK_ANY_CHARACTER)
            && !isRegexPattern(domain)
        ));
        if (permittedDomains && permittedDomains.length > 0) {
            condition.initiatorDomains = toASCII(permittedDomains);
        }

        // set `excludedInitiatorDomains`
        const excludedDomains = rule.restrictedDomains;
        if (excludedDomains && excludedDomains.length > 0) {
            condition.excludedInitiatorDomains = toASCII(excludedDomains);
        }

        // set `requestDomains`
        const { permittedToDomains } = rule;
        if (permittedToDomains && permittedToDomains.length > 0) {
            condition.requestDomains = toASCII(permittedToDomains);
        }

        // Can be specified `$to` or `$denyallow`, but not together.
        const { denyAllowDomains } = rule;
        const { restrictedToDomains } = rule;

        // set `excludedRequestDomains`
        if (denyAllowDomains && denyAllowDomains.length !== 0) {
            condition.excludedRequestDomains = toASCII(denyAllowDomains);
        } else if (restrictedToDomains && restrictedToDomains.length !== 0) {
            condition.excludedRequestDomains = toASCII(restrictedToDomains);
        }

        // set `excludedResourceTypes`
        const { restrictedResourceTypes } = rule;
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
        const { permittedResourceTypes } = rule;
        if (!hasExcludedResourceTypes && permittedResourceTypes.length !== 0) {
            condition.resourceTypes = permittedResourceTypes;
        }

        // set `requestMethods`
        const { permittedMethods } = rule;
        if (permittedMethods && permittedMethods.length !== 0) {
            condition.requestMethods = permittedMethods;
        }

        // set `excludedRequestMethods`
        const { restrictedMethods } = rule;
        if (restrictedMethods && restrictedMethods.length !== 0) {
            condition.excludedRequestMethods = restrictedMethods;
        }

        /**
         * Set `isUrlFilterCaseSensitive` if the `$match-case` modifier is specified,
         * because by default this option is false, so no need to specify it everywhere.
         */
        if (rule.isModifierEnabled(OPTION_NAMES.MATCH_CASE)) {
            condition.isUrlFilterCaseSensitive = true;
        }

        /**
         * Adds the {@link ResourceType.MainFrame} to the `resourceTypes`
         * if the popup modifier is enabled. Popup rules apply only
         * to document requests, so adding {@link ResourceType.MainFrame}
         * ensures the rules are correctly applied.
         */
        if (rule.isModifierEnabled(OPTION_NAMES.POPUP)) {
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
            const shouldMatchAllResourcesTypes = rule.isModifierEnabled(OPTION_NAMES.REMOVEHEADER)
                || rule.isModifierEnabled(OPTION_NAMES.CSP)
                || rule.isModifierEnabled(OPTION_NAMES.COOKIE)
                || rule.isModifierEnabled(OPTION_NAMES.TO)
                || rule.isModifierEnabled(OPTION_NAMES.METHOD);

            /**
             * `$permissions` and `$removeparam` modifiers must be applied only to `document` content-type
             * ({@link ResourceType.MainFrame} and {@link ResourceType.SubFrame}) if they don't have resource types.
             */
            const shouldMatchOnlyDocument = rule.isModifierEnabled(OPTION_NAMES.REMOVEPARAM)
                || rule.isModifierEnabled(OPTION_NAMES.PERMISSIONS);

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
                    ResourceType.CspReport,
                    ResourceType.Media,
                    ResourceType.WebSocket,
                    ResourceType.WebTransport,
                    ResourceType.WebBundle,
                    ResourceType.Other,
                ];
            } else if (shouldMatchOnlyDocument) {
                condition.resourceTypes = [ResourceType.MainFrame, ResourceType.SubFrame];
            }
        }

        // set response headers
        if (rule.isModifierEnabled(OPTION_NAMES.HEADER)) {
            const headerModifierMatcher = rule.headerMatcher;
            if (headerModifierMatcher) {
                const headerInfo: HeaderInfo = { header: headerModifierMatcher.header };

                // Add values array if a value pattern is specified and is not a regex
                // DNR does not support regex in the header info values field
                // as of 14 November 2025 https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-HeaderInfo
                const { value } = headerModifierMatcher;
                if (typeof value === 'string' && !headerModifierMatcher.isRegExp) {
                    headerInfo.values = [value];
                }

                condition.responseHeaders = [headerInfo];
            }
        }

        return condition;
    }

    /**
     * Converts the {@link Rule} into a {@link DeclarativeRule}.
     *
     * @param id Rule ID.
     * @param rule {@link Rule} to convert.
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
        rule: Rule,
    ): Promise<DeclarativeRule> {
        // Build declarative rule
        const declarativeRule: DeclarativeRule = {
            id,
            action: this.getAction(rule),
            condition: RegularRuleConverter.getCondition(rule),
        };

        // Set calculated priority
        declarativeRule.priority = rule.priority;

        // Validate created declarative rule and throw error if not valid
        const conversionErr = await RegularRuleConverter.checkRuleApplication(rule, declarativeRule);
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
     * @param rule The original {@link Rule}.
     * @param declarativeRule The converted {@link DeclarativeRule}.
     *
     * @returns Different errors:
     * - {@link EmptyResourcesError} if the rule has empty resources,
     * - {@link UnsupportedRegexpError} if the regexp is not supported
     *   by RE2 syntax (See {@link https://github.com/google/re2/wiki/Syntax | syntax}),
     * - {@link EmptyDomainsError} if the declarative rule has empty domains
     *   while the original rule has non-empty domains.
     */
    protected static async checkRuleApplication(
        rule: Rule,
        declarativeRule: DeclarativeRule,
    ): Promise<ConversionError | null> {
        const { regexFilter, resourceTypes } = declarativeRule.condition;

        // Check for empty resource types
        if (resourceTypes?.length === 0) {
            return new EmptyResourcesError('Conversion resourceTypes is empty', rule, declarativeRule);
        }

        // Check for empty initiator domains if original rule has permitted domains
        const { permittedDomains } = rule;
        if (permittedDomains && permittedDomains.length > 0) {
            const { initiatorDomains } = declarativeRule.condition;
            if (!initiatorDomains || initiatorDomains.length === 0) {
                const ruleText = RuleGenerator.generate(rule.node);
                const msg = `Conversion initiatorDomains is empty, but original rule's domains not: "${ruleText}"`;
                return new EmptyDomainsError(msg, rule, declarativeRule);
            }
        }

        // Check for unsupported regexps
        if (regexFilter) {
            try {
                await re2Validator.isRegexSupported(regexFilter);
            } catch (e) {
                const ruleText = RuleGenerator.generate(rule.node);
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
     * @param index Index of {@link Rule}.
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
     * Converts the provided list of {@link Rule} into {@link DeclarativeRule},
     * collecting source rule identifiers for declarative rules and catching conversion errors.
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link Rule}.
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
        rules: Rule[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        const res: ConvertedRules = {
            declarativeRules: [],
            errors: [],
            sourceMapValues: [],
        };

        await Promise.all(rules.map(async (rule: Rule) => {
            const { index } = rule;
            const id = RegularRuleConverter.generateId(rule, usedIds);

            try {
                // Validate rule can be converted to DNR format
                const shouldConvert = RuleDeclarativeValidator.shouldConvertRule(rule);
                if (!shouldConvert) {
                    // Rule doesn't require conversion (e.g. $elemhide-only rules)
                    return;
                }

                // Convert rule and collect source map value
                const converted = await this.convertRule(id, rule);
                res.sourceMapValues.push({
                    declarativeRuleId: converted.id,
                    sourceRuleIndex: index,
                    filterId: filterListId,
                });
                res.declarativeRules.push(converted);
            } catch (e) {
                const err = RegularRuleConverter.catchConversionError(index, id, e);
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
     * @param rule {@link Rule} to generate ID for.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Unique ID for the rule.
     */
    private static generateId(rule: Rule, usedIds: Set<number>): number {
        let id = rule.getTextHash();

        // While the ID is already used, we add salt to the hash of the rule
        let salt = 0;
        while (usedIds.has(id)) {
            salt += 1;
            id = rule.getTextHash(salt);
        }

        usedIds.add(id);

        return id;
    }

    /**
     * Converts provided bunch of {@link Rule} to {@link DeclarativeRule}
     * via generating source map for it and catching errors of conversations.
     *
     * Subclasses can override this method to add post-processing logic
     * (e.g. grouping similar rules via {@link RegularRuleConverter.groupConvertedRules}).
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link Rule}.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @returns Object of {@link ConvertedRules} which containing
     * declarative rules, source rule identifiers, errors.
     */
    public async convert(
        filterListId: number,
        rules: Rule[],
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        return this.convertRules(filterListId, rules, usedIds);
    }
}
