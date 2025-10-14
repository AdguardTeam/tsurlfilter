import * as v from 'valibot';

import { strictObjectByType } from '../utils/valibot';

import { type HeaderInfo, HeaderInfoValidator } from './header-info';

/**
 * Enum that represents request is first or third party to the frame in which it originated.
 * A request is said to be first party if it has the same domain (eTLD+1) as the frame in which the request originated.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-DomainType}
 */
export enum DomainType {
    /**
     * The network request is first party to the frame in which it originated.
     */
    FirstParty = 'firstParty',

    /**
     * The network request is third party to the frame in which it originated.
     */
    ThirdParty = 'thirdParty',
}

/**
 * Enum that represents the HTTP request method of a network request.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RequestMethod}
 */
export enum RequestMethod {
    Connect = 'connect',
    Delete = 'delete',
    Get = 'get',
    Head = 'head',
    Options = 'options',
    Patch = 'patch',
    Post = 'post',
    Put = 'put',
}

/**
 * Enum that represents resource type of the network request.
 *
 * Note: `'csp_report'`, `'webtransport'` and `'webbundle'`
 * is currently not used, thats why they are not specified here.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-ResourceType}
 *
 * @todo Add `'csp_report'` handler similar to AG-24613 but in declarative way.
 */
export enum ResourceType {
    MainFrame = 'main_frame',
    SubFrame = 'sub_frame',
    Stylesheet = 'stylesheet',
    Script = 'script',
    Image = 'image',
    Font = 'font',
    Object = 'object',
    XmlHttpRequest = 'xmlhttprequest',
    Ping = 'ping',
    // CspReport = 'csp_report',
    Media = 'media',
    WebSocket = 'websocket',
    // WebTransport = 'webtransport',
    // WebBundle = 'webbundle',
    Other = 'other',
}

/**
 * Rule condition for which the action should be applied.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleCondition}
 */
export interface RuleCondition {
    /**
     * Specifies whether the network request is first-party or third-party
     * to the domain from which it originated. If omitted, all requests are accepted.
     *
     * @see {@link DomainType}
     */
    domainType?: DomainType;

    /**
     * The rule will only match network requests originating from the list of {@link domains}.
     *
     * @deprecated Since Chrome 101. Use {@link initiatorDomains} instead.
     */
    domains?: string[];

    /**
     * The rule will not match network requests originating from the list of {@link excludedDomains}.
     *
     * @deprecated Since Chrome 101. Use {@link excludedInitiatorDomains} instead.
     */
    excludedDomains?: string[];

    /**
     * The rule will only match network requests originating
     * from the list of {@link initiatorDomains}. If the list is omitted,
     * the rule is applied to requests from all domains.
     * An empty list is not allowed.
     *
     * Notes:
     * - Sub-domains like `'a.example.com'` are also allowed.
     * - The entries must consist of only ascii characters.
     * - Use punycode encoding for internationalized domains.
     * - This matches against the request initiator and not the request url.
     * - Sub-domains of the listed domains are also matched.
     *
     * @since Chrome 101
     */
    initiatorDomains?: string[];

    /**
     * The rule will not match network requests originating
     * from the list of {@link excludedInitiatorDomains}.
     * If the list is empty or omitted, no domains are excluded.
     * This takes precedence over {@link initiatorDomains}.
     *
     * Notes:
     * - Sub-domains like `'a.example.com'` are also allowed.
     * - The entries must consist of only ascii characters.
     * - Use punycode encoding for internationalized domains.
     * - This matches against the request initiator and not the request url.
     * - Sub-domains of the listed domains are also excluded.
     *
     * @since Chrome 101
     */
    excludedInitiatorDomains?: string[];

    /**
     * The rule will only match network requests when the domain matches
     * one from the list of {@link requestDomains}. If the list is omitted,
     * the rule is applied to requests from all domains.
     * An empty list is not allowed.
     *
     * Notes:
     * - Sub-domains like `'a.example.com'` are also allowed.
     * - The entries must consist of only ascii characters.
     * - Use punycode encoding for internationalized domains.
     * - Sub-domains of the listed domains are also matched.
     *
     * @since Chrome 101
     */
    requestDomains?: string[];

    /**
     * The rule will not match network requests when the domains
     * matches one from the list of {@link excludedRequestDomains}.
     * If the list is empty or omitted, no domains are excluded.
     * This takes precedence over {@link requestDomains}.
     *
     * Notes:
     * - Sub-domains like `'a.example.com'` are also allowed.
     * - The entries must consist of only ascii characters.
     * - Use punycode encoding for internationalized domains.
     * - Sub-domains of the listed domains are also excluded.
     *
     * @since Chrome 101
     */
    excludedRequestDomains?: string[];

    /**
     * Rule matches if the request matches any response header condition in this list (if specified).
     *
     * @see {@link HeaderInfo}
     *
     * @since Chrome 128
     */
    responseHeaders?: HeaderInfo[];

    /**
     * Rule does not match if the request matches
     * any response header condition in this list (if specified).
     * If both {@link excludedResponseHeaders} and {@link responseHeaders} are specified,
     * then the {@link excludedResponseHeaders} property takes precedence.
     *
     * @see {@link HeaderInfo}
     *
     * @since Chrome 128
     */
    excludedResponseHeaders?: HeaderInfo[];

    /**
     * List of {@link chrome.tabs.Tab.id} which the rule should match.
     * An ID of {@link chrome.tabs.TAB_ID_NONE} matches requests which
     * don't originate from a tab. An empty list is not allowed.
     * Only supported for session-scoped rules.
     *
     * @since Chrome 92
     */
    tabIds?: number[];

    /**
     * List of {@link chrome.tabs.Tab.id} which the rule should not match.
     * An ID of {@link chrome.tabs.TAB_ID_NONE} excludes requests which
     * don't originate from a tab. Only supported for session-scoped rules.
     *
     * @since Chrome 92
     */
    excludedTabIds?: number[];

    /**
     * List of HTTP request methods which the rule can match.
     * Only one of {@link requestMethods} and {@link excludedRequestMethods}
     * should be specified. If neither of them is specified,
     * all request methods are matched. An empty list is not allowed.
     *
     * Note: Specifying a {@link requestMethods} rule condition will also exclude
     * non-HTTP(s) requests, whereas specifying {@link excludedRequestMethods} will not.
     *
     * @see {@link RequestMethod}
     *
     * @since Chrome 91
     */
    requestMethods?: RequestMethod[];

    /**
     * List of request methods which the rule won't match.
     * Only one of {@link requestMethods} and {@link excludedRequestMethods}
     * should be specified. If neither of them is specified,
     * all request methods are matched.
     *
     * @see {@link RequestMethod}
     *
     * @since Chrome 91
     */
    excludedRequestMethods?: RequestMethod[];

    /**
     * List of resource types which the rule can match.
     * Only one of {@link resourceTypes} and {@link excludedResourceTypes}
     * should be specified. If neither of them is specified,
     * all resource types except {@link ResourceType.MainFrame} are blocked.
     * An empty list is not allowed.
     *
     * Note: this must be specified for `AllowAllRequests` rules
     * and may only include the {@link ResourceType.MainFrame} and {@link ResourceType.SubFrame} resource types.
     *
     * @see {@link ResourceType}
     */
    resourceTypes?: ResourceType[];

    /**
     * List of resource types which the rule won't match.
     * Only one of {@link resourceTypes} and {@link excludedResourceTypes}
     * should be specified. If neither of them is specified,
     * all resource types except {@link ResourceType.MainFrame} are blocked.
     *
     * @see {@link ResourceType}
     */
    excludedResourceTypes?: ResourceType[];

    /**
     * Regular expression to match against the network request url.
     * This follows the {@link https://github.com/google/re2/wiki/Syntax | RE2 syntax}.
     *
     * Notes:
     * - Only one of {@link urlFilter} or {@link regexFilter} can be specified.
     * - The {@link regexFilter} must be composed of only ASCII characters.
     *   This is matched against a url where the host is encoded in the punycode
     *   format (in case of internationalized domains) and any other non-ascii
     *   characters are url encoded in utf-8.
     */
    regexFilter?: string;

    /**
     * The pattern which is matched against the network request url. Supported constructs:
     * - `'*'` wildcard: Matches any number of characters.
     * - `'|'` left/right anchor: If used at either end of the pattern,
     *   specifies the beginning/end of the url respectively.
     * - `'||'` domain name anchor: If used at the beginning of the pattern,
     *   specifies the start of a (sub-)domain of the URL.
     * - `'^'` separator character: This matches anything except a letter,
     *   a digit, or one of the following: `'_'`, `'-'`, `'.'`, or `'%'`.
     *   This also match the end of the URL.
     *
     * Therefore {@link urlFilter} is composed of the following parts:
     * (optional Left/Domain name anchor) + pattern + (optional Right anchor).
     *
     * If omitted, all urls are matched. An empty string is not allowed.
     *
     * A pattern beginning with `'||*'` is not allowed. Use `'*'` instead.
     *
     * Notes:
     * - Only one of {@link urlFilter} or {@link regexFilter} can be specified.
     * - The {@link urlFilter} must be composed of only ASCII characters.
     *   This is matched against a url where the host is encoded
     *   in the punycode format (in case of internationalized domains)
     *   and any other non-ascii characters are url encoded in utf-8.
     *   For example, when the request url is `'http://abc.рф?q=ф'`,
     *   the urlFilter will be matched against the url `'http://abc.xn--p1ai/?q=%D1%84'`.
     */
    urlFilter?: string;

    /**
     * Whether the {@link urlFilter} or {@link regexFilter} (whichever is specified)
     * is case sensitive. Default is `false`.
     */
    isUrlFilterCaseSensitive?: boolean;
}

/**
 * Validator for {@link RuleCondition}.
 */
export const RuleConditionValidator = strictObjectByType<RuleCondition>({
    domainType: v.optional(v.enum(DomainType)),
    domains: v.optional(v.array(v.string())),
    excludedDomains: v.optional(v.array(v.string())),
    initiatorDomains: v.optional(v.pipe(
        v.array(v.string()),
        v.nonEmpty(),
    )),
    excludedInitiatorDomains: v.optional(v.array(v.string())),
    requestDomains: v.optional(v.pipe(
        v.array(v.string()),
        v.nonEmpty(),
    )),
    excludedRequestDomains: v.optional(v.array(v.string())),
    responseHeaders: v.optional(v.array(HeaderInfoValidator)),
    excludedResponseHeaders: v.optional(v.array(HeaderInfoValidator)),
    tabIds: v.optional(v.pipe(
        v.array(v.number()),
        v.nonEmpty(),
    )),
    excludedTabIds: v.optional(v.array(v.number())),
    requestMethods: v.optional(v.pipe(
        v.array(v.enum(RequestMethod)),
        v.nonEmpty(),
    )),
    excludedRequestMethods: v.optional(v.array(v.enum(RequestMethod))),
    resourceTypes: v.optional(v.pipe(
        v.array(v.enum(ResourceType)),
        v.nonEmpty(),
    )),
    excludedResourceTypes: v.optional(v.array(v.enum(ResourceType))),
    regexFilter: v.optional(v.string()),
    urlFilter: v.optional(v.pipe(
        v.string(),
        v.nonEmpty(),
    )),
    isUrlFilterCaseSensitive: v.optional(v.boolean()),
});
