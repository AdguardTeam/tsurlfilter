import { type ModifierList, type NetworkRule as NetworkRuleNode } from '@adguard/agtree';
import { RuleGenerator } from '@adguard/agtree/generator';

import { EMPTY_STRING } from '../common/constants';
import { CompatibilityTypes, isCompatibleWith } from '../configuration';
import { type IAdvancedModifier } from '../modifiers/advanced-modifier';
import { AppModifier, type IAppModifier } from '../modifiers/app-modifier';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { CspModifier } from '../modifiers/csp-modifier';
import { ClientModifier } from '../modifiers/dns/client-modifier';
import { CtagModifier } from '../modifiers/dns/ctag-modifier';
import { DnsRewriteModifier } from '../modifiers/dns/dnsrewrite-modifier';
import { DnsTypeModifier } from '../modifiers/dns/dnstype-modifier';
import { DomainModifier, PIPE_SEPARATOR } from '../modifiers/domain-modifier';
import { HeaderModifier, type HttpHeaderMatcher, type HttpHeadersItem } from '../modifiers/header-modifier';
import { type HTTPMethod, MethodModifier } from '../modifiers/method-modifier';
import { PermissionsModifier } from '../modifiers/permissions-modifier';
import { RedirectModifier } from '../modifiers/redirect-modifier';
import { RemoveHeaderModifier } from '../modifiers/remove-header-modifier';
import { RemoveParamModifier } from '../modifiers/remove-param-modifier';
import { ReplaceModifier } from '../modifiers/replace-modifier';
import { StealthModifier } from '../modifiers/stealth-modifier';
import { ToModifier } from '../modifiers/to-modifier';
import { type IValueListModifier } from '../modifiers/value-list-modifier';
import { type Request } from '../request';
import { RequestType } from '../request-type';
import { countEnabledBits, getBitCount } from '../utils/bit-utils';
import { hasSpaces, stringArraysEquals, stringArraysHaveIntersection } from '../utils/string-utils';

import {
    MASK_ALLOWLIST,
    NETWORK_RULE_OPTIONS,
    NOT_MARK,
    OPTIONS_DELIMITER,
} from './network-rule-options';
import { Pattern } from './pattern';
import { type IRule, RULE_INDEX_NONE } from './rule';
import { SimpleRegex } from './simple-regex';

/**
 * NetworkRuleOption is the enumeration of various rule options.
 * In order to save memory, we store some options as a flag.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rule-modifiers}
 */
export enum NetworkRuleOption {
    /**
     * No value is set. Syntax sugar to simplify code.
     */
    NotSet = 0,

    /**
     * $third-party modifier.
     */
    ThirdParty = 1,

    /**
     * $match-case modifier.
     */
    MatchCase = 1 << 1,

    /**
     * $important modifier.
     */
    Important = 1 << 2,

    // Allowlist rules modifiers
    // Each of them can disable part of the functionality

    /**
     * $elemhide modifier.
     */
    Elemhide = 1 << 3,

    /**
     * $generichide modifier.
     */
    Generichide = 1 << 4,

    /**
     * $specifichide modifier.
     */
    Specifichide = 1 << 5,

    /**
     * $genericblock modifier.
     */
    Genericblock = 1 << 6,

    /**
     * $jsinject modifier.
     */
    Jsinject = 1 << 7,

    /**
     * $urlblock modifier.
     */
    Urlblock = 1 << 8,

    /**
     * $content modifier.
     */
    Content = 1 << 9,

    /**
     * $extension modifier.
     */
    Extension = 1 << 10,

    /**
     * $stealth modifier.
     */
    Stealth = 1 << 11,

    // Other modifiers

    /**
     * $popup modifier.
     */
    Popup = 1 << 12,

    /**
     * $csp modifier.
     */
    Csp = 1 << 13,

    /**
     * $replace modifier.
     */
    Replace = 1 << 14,

    /**
     * $cookie modifier.
     */
    Cookie = 1 << 15,

    /**
     * $redirect modifier.
     */
    Redirect = 1 << 16,

    /**
     * $badfilter modifier.
     */
    Badfilter = 1 << 17,

    /**
     * $removeparam modifier.
     */
    RemoveParam = 1 << 18,

    /**
     * $removeheader modifier.
     */
    RemoveHeader = 1 << 19,

    /**
     * $jsonprune modifier.
     */
    JsonPrune = 1 << 20,

    /**
     * $hls modifier.
     */
    Hls = 1 << 21,

    // Compatibility dependent
    /**
     * $network modifier.
     */
    Network = 1 << 22,

    /**
     * Dns modifiers.
     */
    Client = 1 << 23,
    DnsRewrite = 1 << 24,
    DnsType = 1 << 25,
    Ctag = 1 << 26,

    /**
     * $method modifier.
     */
    Method = 1 << 27,

    /**
     * $to modifier.
     */
    To = 1 << 28,

    /**
     * $permissions modifier.
     */
    Permissions = 1 << 29,

    /**
     * $header modifier.
     */
    Header = 1 << 30,
}

/**
 * NetworkRuleOptions is the enumeration of various rule options groups
 * needed for validation.
 */
export enum NetworkRuleGroupOptions {
    /**
     * Allowlist-only modifiers.
     */
    AllowlistOnly = NetworkRuleOption.Elemhide
        | NetworkRuleOption.Genericblock
        | NetworkRuleOption.Generichide
        | NetworkRuleOption.Specifichide
        | NetworkRuleOption.Jsinject
        | NetworkRuleOption.Urlblock
        | NetworkRuleOption.Content
        | NetworkRuleOption.Extension
        | NetworkRuleOption.Stealth,

    /**
     * Options supported by host-level network rules.
     */
    OptionHostLevelRules = NetworkRuleOption.Important
        | NetworkRuleOption.Badfilter
        | NetworkRuleOption.Client
        | NetworkRuleOption.DnsRewrite
        | NetworkRuleOption.DnsType
        | NetworkRuleOption.Ctag,

    /**
     * Cosmetic option modifiers.
     */
    CosmeticOption = NetworkRuleOption.Elemhide
        | NetworkRuleOption.Generichide
        | NetworkRuleOption.Specifichide
        | NetworkRuleOption.Jsinject
        | NetworkRuleOption.Content,

    /**
     * Removeparam compatible modifiers.
     *
     * $removeparam rules are compatible only with content type modifiers ($subdocument, $script, $stylesheet, etc)
     * except $document (using by default) and this list of modifiers.
     */
    RemoveParamCompatibleOptions = NetworkRuleOption.RemoveParam
        | NetworkRuleOption.ThirdParty
        | NetworkRuleOption.Important
        | NetworkRuleOption.MatchCase
        | NetworkRuleOption.Badfilter,

    /**
     * Removeheader compatible modifiers.
     *
     * $removeheader rules are compatible only with content type modifiers ($subdocument, $script, $stylesheet, etc)
     * except $document (using by default) and this list of modifiers.
     */
    RemoveHeaderCompatibleOptions = NetworkRuleOption.RemoveHeader
        | NetworkRuleOption.ThirdParty
        | NetworkRuleOption.Important
        | NetworkRuleOption.MatchCase
        | NetworkRuleOption.Header
        | NetworkRuleOption.Badfilter,

    /**
     * Permissions compatible modifiers.
     *
     * $permissions is compatible with the limited list of modifiers: $domain, $important, and $subdocument.
     */
    PermissionsCompatibleOptions = NetworkRuleOption.Permissions
        | NetworkRuleOption.Important
        | NetworkRuleOption.Badfilter,

    /**
     * Header compatible modifiers.
     *
     * $header is compatible with the limited list of modifiers:
     * - $important
     * - $csp
     * - $removeheader (on response headers)
     * - $third-party
     * - $match-case
     * - $badfilter
     * - $domain
     * - all content type modifiers ($subdocument, $script, $stylesheet, etc).
     */
    HeaderCompatibleOptions = NetworkRuleOption.Header
        | NetworkRuleOption.Important
        | NetworkRuleOption.Csp
        | NetworkRuleOption.RemoveHeader
        | NetworkRuleOption.ThirdParty
        | NetworkRuleOption.MatchCase
        | NetworkRuleOption.Badfilter,
}

/**
 * Basic network filtering rule.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
 */
export class NetworkRule implements IRule {
    /**
     * Rule index.
     */
    private readonly ruleIndex: number;

    /**
     * Filter list ID.
     */
    private readonly filterListId: number;

    /**
     * Allowlist flag.
     */
    private readonly allowlist: boolean;

    /**
     * Rule pattern.
     */
    private readonly pattern: Pattern;

    /**
     * Domains in denyallow modifier providing exceptions for permitted domains.
     *
     * @see {@link https://github.com/AdguardTeam/CoreLibs/issues/1304}
     */
    private denyAllowDomains: string[] | null = null;

    /**
     * Flag with all enabled rule options.
     */
    private enabledOptions: NetworkRuleOption = NetworkRuleOption.NotSet;

    /**
     * Flag with all disabled rule options.
     */
    private disabledOptions: NetworkRuleOption = NetworkRuleOption.NotSet;

    /**
     * Flag with all permitted request types.
     */
    private permittedRequestTypes: RequestType = RequestType.NotSet;

    /**
     * Flag with all restricted request types.
     */
    private restrictedRequestTypes: RequestType = RequestType.NotSet;

    /**
     * Rule Advanced modifier.
     */
    private advancedModifier: IAdvancedModifier | null = null;

    /**
     * Rule Domain modifier.
     */
    private domainModifier: DomainModifier | null = null;

    /**
     * Rule App modifier.
     */
    private appModifier: IAppModifier | null = null;

    /**
     * Rule Method modifier.
     */
    private methodModifier: IValueListModifier<HTTPMethod> | null = null;

    /**
     * Rule header modifier.
     */
    private headerModifier: HeaderModifier | null = null;

    /**
     * Rule To modifier.
     */
    private toModifier: IValueListModifier<string> | null = null;

    /**
     * Rule Stealth modifier.
     */
    private stealthModifier: StealthModifier | null = null;

    /**
     * Rule priority, which is needed when the engine has to choose between
     * several rules matching the query. This value is calculated based on
     * the rule modifiers enabled or disabled and rounded up
     * to the smallest integer greater than or equal to the calculated weight
     * in the {@link calculatePriorityWeight}.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-1
     */
    private priorityWeight = 1;

    /**
     * Rules with base modifiers, from category 1, each of them adds 1
     * to the weight of the rule.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-1
     */
    private static readonly CATEGORY_1_OPTIONS_MASK = NetworkRuleOption.ThirdParty
        | NetworkRuleOption.MatchCase
        | NetworkRuleOption.DnsRewrite;

    /**
     * The priority weight used in {@link calculatePriorityWeight} for rules
     * with permitted request types and methods.
     * The value 50 is chosen in order to cover (with a margin) all possible
     * combinations and variations of rules from categories with a lower
     * priority (each of them adds 1 to the rule priority).
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-2
     */
    private static readonly CategoryTwoWeight = 50;

    /**
     * The priority weight used in {@link calculatePriorityWeight} for rules
     * with allowed domains.
     * The value 100 is chosen to cover all possible combinations and variations
     * of rules from categories with a lower priority, for example a rule with
     * one allowed query type will get priority 100 (50 + 50/1), but for allowed
     * domains with any number of domains we will get at least 101 (for 100
     * domains: 100 + 100/100; for 200 100 + 100/200; or even for 10000:
     * 100 + 100/10000) because the resulting weight is rounded up.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-3
     */
    private static readonly CategoryThreeWeight = 100;

    /**
     * The priority weight used in {@link calculatePriorityWeight}
     * for $redirect rules.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-6
     */
    private static readonly CategoryFourWeight = 10 ** 3;

    /**
     * The priority weight used in {@link calculatePriorityWeight} for rules
     * with specific exceptions.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-4
     */
    private static readonly CategoryFiveWeight = 10 ** 4;

    /**
     * Rules with specific exclusions, from category 4, each of them adds
     * {@link SpecificExceptionsWeight} to the weight of the rule.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-4
     */
    private static readonly SPECIFIC_EXCLUSIONS_MASK = NetworkRuleOption.Elemhide
        | NetworkRuleOption.Generichide
        | NetworkRuleOption.Specifichide
        | NetworkRuleOption.Content
        | NetworkRuleOption.Urlblock
        | NetworkRuleOption.Genericblock
        | NetworkRuleOption.Jsinject
        | NetworkRuleOption.Extension;

    /**
     * The priority weight used in {@link calculatePriorityWeight} for rules
     * with allowlist mark '@@'.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-5
     */
    private static readonly CategorySixWeight = 10 ** 5;

    /**
     * The priority weight used in {@link calculatePriorityWeight}
     * for $important rules.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-7
     */
    private static readonly CategorySevenWeight = 10 ** 6;

    /**
     * Separates the rule pattern from the list of modifiers.
     *
     * ```
     * rule = ["@@"] pattern [ "$" modifiers ]
     * modifiers = [modifier0, modifier1[, ...[, modifierN]]]
     * ```
     */
    public static readonly OPTIONS_DELIMITER = OPTIONS_DELIMITER;

    /**
     * A marker that is used in rules of exception.
     * To turn off filtering for a request, start your rule with this marker.
     */
    public static readonly MASK_ALLOWLIST = MASK_ALLOWLIST;

    /**
     * Mark that negates options.
     */
    public static readonly NOT_MARK = NOT_MARK;

    /**
     * Rule options.
     */
    public static readonly OPTIONS = NETWORK_RULE_OPTIONS;

    /**
     * Rule options that can be negated.
     */
    public static readonly NEGATABLE_OPTIONS: ReadonlySet<string> = new Set([
        // General options
        NetworkRule.OPTIONS.FIRST_PARTY,
        NetworkRule.OPTIONS.THIRD_PARTY,
        NetworkRule.OPTIONS.MATCH_CASE,

        NetworkRule.OPTIONS.DOCUMENT,
        NetworkRule.OPTIONS.DOC,

        // Content type options
        NetworkRule.OPTIONS.SCRIPT,
        NetworkRule.OPTIONS.STYLESHEET,
        NetworkRule.OPTIONS.SUBDOCUMENT,
        NetworkRule.OPTIONS.OBJECT,
        NetworkRule.OPTIONS.IMAGE,
        NetworkRule.OPTIONS.XMLHTTPREQUEST,
        NetworkRule.OPTIONS.MEDIA,
        NetworkRule.OPTIONS.FONT,
        NetworkRule.OPTIONS.WEBSOCKET,
        NetworkRule.OPTIONS.OTHER,
        NetworkRule.OPTIONS.PING,

        // Dns modifiers
        NetworkRule.OPTIONS.EXTENSION,
    ]);

    /**
     * Advanced option modifier names.
     */
    public static readonly ADVANCED_OPTIONS: ReadonlySet<string> = new Set([
        NetworkRule.OPTIONS.CSP,
        NetworkRule.OPTIONS.REPLACE,
        NetworkRule.OPTIONS.COOKIE,
        NetworkRule.OPTIONS.REDIRECT,
        NetworkRule.OPTIONS.REDIRECTRULE,
        NetworkRule.OPTIONS.REMOVEPARAM,
        NetworkRule.OPTIONS.REMOVEHEADER,
        NetworkRule.OPTIONS.PERMISSIONS,
        NetworkRule.OPTIONS.CLIENT,
        NetworkRule.OPTIONS.DNSREWRITE,
        NetworkRule.OPTIONS.DNSTYPE,
        NetworkRule.OPTIONS.CTAG,
    ]);

    /**
     * Returns the rule index.
     *
     * @returns Rule index.
     */
    public getIndex(): number {
        return this.ruleIndex;
    }

    /**
     * Returns the identifier of the filter from which the rule was received.
     *
     * @returns Identifier of the filter from which the rule was received.
     */
    public getFilterListId(): number {
        return this.filterListId;
    }

    /**
     * Each rule has its own priority, which is necessary when several rules
     * match the request and the filtering system needs to select one of them.
     * Priority is measured as a positive integer.
     * In the case of a conflict between two rules with the same priority value,
     * it is not specified which one of them will be chosen.
     *
     * @returns Rule priority.
     */
    public getPriorityWeight(): number {
        return this.priorityWeight;
    }

    /**
     * Returns rule pattern,
     * which currently is used only in the rule validator module.
     *
     * @returns Rule pattern.
     */
    public getPattern(): string {
        return this.pattern.pattern;
    }

    /**
     * Returns `true` if the rule is "allowlist", e.g. if it disables other
     * rules when the pattern matches the request.
     *
     * @returns True if the rule is an allowlist rule.
     */
    public isAllowlist(): boolean {
        return this.allowlist;
    }

    /**
     * Checks if the rule is a document-level allowlist rule with $urlblock or
     * $genericblock or $content.
     * This means that the rule is supposed to disable or modify blocking
     * of the page sub-requests.
     * For instance, `@@||example.org^$urlblock` unblocks all sub-requests.
     *
     * @returns True if the rule is a document-level allowlist rule with specific modifiers.
     */
    public isDocumentLevelAllowlistRule(): boolean {
        if (!this.isAllowlist()) {
            return false;
        }

        return this.isOptionEnabled(NetworkRuleOption.Urlblock)
            || this.isOptionEnabled(NetworkRuleOption.Genericblock)
            || this.isOptionEnabled(NetworkRuleOption.Content);
    }

    /**
     * Checks if the rule completely disables filtering.
     *
     * @returns True if the rule completely disables filtering.
     */
    public isFilteringDisabled(): boolean {
        if (!this.isAllowlist()) {
            return false;
        }

        return this.isOptionEnabled(NetworkRuleOption.Elemhide)
            && this.isOptionEnabled(NetworkRuleOption.Content)
            && this.isOptionEnabled(NetworkRuleOption.Urlblock)
            && this.isOptionEnabled(NetworkRuleOption.Jsinject);
    }

    /**
     * The longest part of pattern without any special characters.
     * It is used to improve the matching performance.
     *
     * @returns The longest part of the pattern without any special characters.
     */
    public getShortcut(): string {
        return this.pattern.shortcut;
    }

    /**
     * Gets list of permitted domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#domain-modifier}
     *
     * @returns List of permitted domains or null if none.
     */
    public getPermittedDomains(): string[] | null {
        if (this.domainModifier) {
            return this.domainModifier.getPermittedDomains();
        }
        return null;
    }

    /**
     * Gets list of restricted domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#domain-modifier}
     *
     * @returns List of restricted domains or null if none.
     */
    public getRestrictedDomains(): string[] | null {
        if (this.domainModifier) {
            return this.domainModifier.getRestrictedDomains();
        }
        return null;
    }

    /**
     * Gets list of denyAllow domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#denyallow-modifier}
     *
     * @returns List of denyAllow domains or null if none.
     */
    public getDenyAllowDomains(): string[] | null {
        return this.denyAllowDomains;
    }

    /**
     * Get list of permitted $to domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#to-modifier}
     *
     * @returns List of permitted $to domains or null if none.
     */
    public getPermittedToDomains(): string[] | null {
        if (this.toModifier) {
            return this.toModifier.permittedValues;
        }
        return null;
    }

    /**
     * Get list of restricted $to domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#to-modifier}
     *
     * @returns List of restricted $to domains or null if none.
     */
    public getRestrictedToDomains(): string[] | null {
        if (this.toModifier) {
            return this.toModifier.restrictedValues;
        }
        return null;
    }

    /**
     * Gets list of permitted domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#app}
     *
     * @returns List of permitted domains or null if none.
     */
    public getPermittedApps(): string[] | null {
        if (this.appModifier) {
            return this.appModifier.permittedApps;
        }
        return null;
    }

    /**
     * Gets list of restricted domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#app}
     *
     * @returns List of restricted domains or null if none.
     */
    public getRestrictedApps(): string[] | null {
        if (this.appModifier) {
            return this.appModifier.restrictedApps;
        }
        return null;
    }

    /**
     * Gets list of permitted methods.
     *
     * @see {@link https://kb.adguard.com/general/how-to-create-your-own-ad-filters#method-modifier}
     *
     * @returns List of permitted methods or null if none.
     */
    public getRestrictedMethods(): HTTPMethod[] | null {
        if (this.methodModifier) {
            return this.methodModifier.restrictedValues;
        }
        return null;
    }

    /**
     * Gets list of restricted methods.
     *
     * @see {@link https://kb.adguard.com/general/how-to-create-your-own-ad-filters#method-modifier}
     *
     * @returns List of restricted methods or null if none.
     */
    public getPermittedMethods(): HTTPMethod[] | null {
        if (this.methodModifier) {
            return this.methodModifier.permittedValues;
        }
        return null;
    }

    /**
     * Flag with all permitted request types.
     * The value {@link RequestType.NotSet} here means "all request types are allowed".
     *
     * @returns The flag with all permitted request types.
     */
    public getPermittedRequestTypes(): RequestType {
        return this.permittedRequestTypes;
    }

    /**
     * Flag with all restricted request types.
     * The value {@link RequestType.NotSet} here means "no type of request is restricted".
     *
     * @returns The flag with all restricted request types.
     */
    public getRestrictedRequestTypes(): RequestType {
        return this.restrictedRequestTypes;
    }

    /**
     * Advanced modifier.
     *
     * @returns The advanced modifier or null if none.
     */
    public getAdvancedModifier(): IAdvancedModifier | null {
        return this.advancedModifier;
    }

    /**
     * Stealth modifier.
     *
     * @returns The stealth modifier or null if none.
     */
    public getStealthModifier(): StealthModifier | null {
        return this.stealthModifier;
    }

    /**
     * Advanced modifier value.
     *
     * @returns The advanced modifier value or null if none.
     */
    public getAdvancedModifierValue(): string | null {
        return this.advancedModifier && this.advancedModifier.getValue();
    }

    /**
     * Retrieves the header modifier value.
     *
     * @returns The header modifier value or null if none.
     */
    public getHeaderModifierValue(): HttpHeaderMatcher | null {
        if (!this.headerModifier) {
            return null;
        }
        return this.headerModifier.getHeaderModifierValue();
    }

    /**
     * Returns true if rule's pattern is a regular expression.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#regexp-support}
     *
     * @returns True if the rule pattern is a regular expression.
     */
    public isRegexRule(): boolean {
        return (
            this.getPattern().startsWith(SimpleRegex.MASK_REGEX_RULE)
            && this.getPattern().endsWith(SimpleRegex.MASK_REGEX_RULE)
        );
    }

    /**
     * Checks if this filtering rule matches the specified request.
     *
     * @param request Request to check.
     * @param useShortcut The flag to use this rule shortcut.
     *
     * @returns True if the rule matches the request.
     *
     * In case we use Trie in lookup table, we don't need to use shortcut cause we already check if request's url
     * includes full rule shortcut.
     */
    public match(request: Request, useShortcut = true): boolean {
        // Regex rules should not be tested by shortcut
        if (useShortcut && !this.matchShortcut(request)) {
            return false;
        }

        if (this.isOptionEnabled(NetworkRuleOption.Method) && !this.matchMethod(request.method)) {
            return false;
        }

        if (this.isOptionEnabled(NetworkRuleOption.ThirdParty) && !request.thirdParty) {
            return false;
        }

        if (this.isOptionDisabled(NetworkRuleOption.ThirdParty) && request.thirdParty) {
            return false;
        }

        if (!this.matchRequestType(request.requestType)) {
            return false;
        }

        if (!this.matchDomainModifier(request)) {
            return false;
        }

        if (
            this.isOptionEnabled(NetworkRuleOption.RemoveParam)
            || this.isOptionEnabled(NetworkRuleOption.Permissions)
        ) {
            if (!this.matchRequestTypeExplicit(request.requestType)) {
                return false;
            }
        }

        if (!this.matchDenyAllowDomains(request.hostname)) {
            return false;
        }

        if (this.isOptionEnabled(NetworkRuleOption.To) && !this.matchToModifier(request.hostname)) {
            return false;
        }

        if (!this.matchDnsType(request.dnsType)) {
            return false;
        }

        if (!this.matchClientTags(request.clientTags)) {
            return false;
        }

        if (!this.matchClient(request.clientName, request.clientIP)) {
            return false;
        }

        return this.pattern.matchPattern(request, true);
    }

    /**
     * Simply checks if shortcut is a substring of the URL.
     *
     * @param request Request to check.
     *
     * @returns True if the shortcut is a substring of the URL.
     */
    private matchShortcut(request: Request): boolean {
        return request.urlLowercase.indexOf(this.getShortcut()) >= 0;
    }

    /**
     * Check if request matches domain modifier by request referrer (general case) or by request target.
     *
     * In some cases the $domain modifier can match not only the referrer domain, but also the target domain.
     * This happens when the following is true (1 AND ((2 AND 3) OR 4):
     *
     * 1) The request has $document request type (not subdocument)
     * 2) The rule's pattern doesn't match any particular domain(s)
     * 3) The rule's pattern doesn't contain regular expressions
     * 4) The $domain modifier contains only excluded domains (e.g., $domain=~example.org|~example.com).
     *
     * When all these conditions are met, the domain modifier will match both the referrer domain and the target domain.
     *
     * @see {@link https://github.com/AdguardTeam/tsurlfilter/issues/45}
     *
     * @param request The request to check.
     *
     * @returns True if the rule matches the domain modifier.
     */
    public matchDomainModifier(request: Request): boolean {
        if (!this.domainModifier) {
            return true;
        }

        const { domainModifier } = this;

        const isDocumentType = request.requestType === RequestType.Document;

        const hasOnlyExcludedDomains = !domainModifier.hasPermittedDomains()
            && domainModifier.hasRestrictedDomains();

        const patternIsRegex = this.isRegexRule();
        const patternIsDomainSpecific = this.pattern.isPatternDomainSpecific();
        const matchesTargetByPatternCondition = !patternIsRegex && !patternIsDomainSpecific;

        if (isDocumentType && (hasOnlyExcludedDomains || matchesTargetByPatternCondition)) {
            // check if matches source hostname if exists or if matches target hostname
            return (request.sourceHostname && domainModifier.matchDomain(request.sourceHostname))
                || domainModifier.matchDomain(request.hostname);
        }

        return domainModifier.matchDomain(request.sourceHostname || '');
    }

    /**
     * Checks if the filtering rule is allowed on this domain.
     *
     * @param domain The request's domain.
     *
     * @returns True if the rule must be applied to the request.
     */
    private matchDenyAllowDomains(domain: string): boolean {
        if (!this.denyAllowDomains) {
            return true;
        }

        if (this.denyAllowDomains.length > 0) {
            if (DomainModifier.isDomainOrSubdomainOfAny(domain, this.denyAllowDomains!)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Checks if the request domain matches the specified conditions.
     *
     * @param domain The request's domain.
     *
     * @returns True if the request domain matches the permitted domains and does not match the restricted domains.
     */
    private matchToModifier(domain: string): boolean {
        if (!this.toModifier) {
            return true;
        }
        /**
         * The request's domain must be either explicitly permitted or not be included
         * in the list of restricted domains for the rule to apply.
         */
        const permittedDomains = this.getPermittedToDomains();
        const restrictedDomains = this.getRestrictedToDomains();

        let matches = false;
        if (permittedDomains) {
            matches = DomainModifier.isDomainOrSubdomainOfAny(domain, permittedDomains);
        }
        if (restrictedDomains) {
            matches = !DomainModifier.isDomainOrSubdomainOfAny(domain, restrictedDomains);
        }
        return matches;
    }

    /**
     * Return `true` if this rule matches with the tags associated with a client.
     *
     * @param clientTags Client tags.
     *
     * @returns True if the rule matches the client tags.
     */
    private matchClientTags(clientTags: string[] | undefined): boolean {
        const advancedModifier = this.getAdvancedModifier();
        if (!advancedModifier || !(advancedModifier instanceof CtagModifier)) {
            return true;
        }

        if (!clientTags) {
            return false;
        }

        const cTagsModifier = advancedModifier as CtagModifier;
        return clientTags.every((x) => cTagsModifier.match(x));
    }

    /**
     * Returns TRUE if the rule matches with the specified client.
     *
     * @param clientName The name of the client.
     * @param clientIP The IP address of the client.
     *
     * @returns True if the rule matches the client.
     */
    private matchClient(clientName: string | undefined, clientIP: string | undefined): boolean {
        const advancedModifier = this.getAdvancedModifier();
        if (!advancedModifier || !(advancedModifier instanceof ClientModifier)) {
            return true;
        }

        if (!clientName && !clientIP) {
            return false;
        }

        const modifier = advancedModifier as ClientModifier;
        return modifier.matchAny(clientName, clientIP);
    }

    /**
     * Return `true` if this rule matches with the request DNS type.
     *
     * @param dnstype The DNS type to check.
     *
     * @returns True if the rule matches the DNS type.
     */
    private matchDnsType(dnstype: string | undefined): boolean {
        const advancedModifier = this.getAdvancedModifier();
        if (!advancedModifier || !(advancedModifier instanceof DnsTypeModifier)) {
            return true;
        }

        if (!dnstype) {
            return false;
        }

        const modifier = advancedModifier as DnsTypeModifier;
        return modifier.match(dnstype);
    }

    /**
     * Checks if the request's type matches the rule properties.
     *
     * @param requestType Request type to check.
     *
     * @returns True if the rule must be applied to the request.
     */
    private matchRequestType(requestType: RequestType): boolean {
        if (this.permittedRequestTypes !== RequestType.NotSet) {
            if ((this.permittedRequestTypes & requestType) !== requestType) {
                return false;
            }
        }

        if (this.restrictedRequestTypes !== RequestType.NotSet) {
            if ((this.restrictedRequestTypes & requestType) === requestType) {
                return false;
            }
        }

        return true;
    }

    /**
     * In case of $removeparam, $permissions modifier,
     * we only allow it to target other content types if the rule has an explicit content-type modifier.
     *
     * @param requestType Request type to check.
     *
     * @returns True if the rule must be applied to the request.
     */
    private matchRequestTypeExplicit(requestType: RequestType): boolean {
        if (this.permittedRequestTypes === RequestType.NotSet
            && this.restrictedRequestTypes === RequestType.NotSet
            && requestType !== RequestType.Document
            && requestType !== RequestType.SubDocument) {
            return false;
        }

        return this.matchRequestType(requestType);
    }

    /**
     * Checks if request's method matches with the rule.
     *
     * @param method Request's method.
     *
     * @returns True, if rule must be applied to the request.
     */
    private matchMethod(method: HTTPMethod | undefined): boolean {
        if (!method || !MethodModifier.isHTTPMethod(method)) {
            return false;
        }

        /**
         * Request's method must be either explicitly
         * permitted or not be included in list of restricted methods
         * for the rule to apply.
         */
        const permittedMethods = this.getPermittedMethods();
        if (permittedMethods?.includes(method)) {
            return true;
        }

        const restrictedMethods = this.getRestrictedMethods();
        return !!restrictedMethods && !restrictedMethods.includes(method);
    }

    /**
     * Checks if request's response headers matches with
     * the rule's $header modifier value.
     *
     * @param responseHeadersItems Request's response headers.
     *
     * @returns True, if rule must be applied to the request.
     */
    public matchResponseHeaders(responseHeadersItems: HttpHeadersItem[] | undefined): boolean {
        if (!responseHeadersItems || responseHeadersItems.length === 0) {
            return false;
        }

        const ruleData = this.getHeaderModifierValue();

        if (!ruleData) {
            return false;
        }

        const {
            header: ruleHeaderName,
            value: ruleHeaderValue,
        } = ruleData;

        return responseHeadersItems.some((responseHeadersItem) => {
            const {
                name: responseHeaderName,
                value: responseHeaderValue,
            } = responseHeadersItem;

            // Header name matching is case-insensitive
            if (ruleHeaderName.toLowerCase() !== responseHeaderName.toLowerCase()) {
                return false;
            }

            if (ruleHeaderValue === null) {
                return true;
            }

            // Unlike header name, header value matching is case-sensitive
            if (typeof ruleHeaderValue === 'string') {
                return ruleHeaderValue === responseHeaderValue;
            }

            if (responseHeaderValue && ruleHeaderValue instanceof RegExp) {
                return ruleHeaderValue.test(responseHeaderValue);
            }

            return false;
        });
    }

    /**
     * Checks if a network rule is too general.
     *
     * @param node AST node of the network rule.
     *
     * @returns True if the rule is too general.
     */
    public static isTooGeneral(node: NetworkRuleNode): boolean {
        return !(node.modifiers?.children?.length) && node.pattern.value.length < 4;
    }

    /**
     * Creates an instance of the {@link NetworkRule}.
     * It parses this rule and extracts the rule pattern (see {@link SimpleRegex}),
     * and rule modifiers.
     *
     * @param node AST node of the network rule.
     * @param filterListId ID of the filter list this rule belongs to.
     * @param ruleIndex Line start index in the source filter list; it will be used to find the original rule text
     * in the filtering log when a rule is applied. Default value is {@link RULE_INDEX_NONE} which means that
     * the rule does not have source index.
     *
     * @throws Error if it fails to parse the rule.
     */
    constructor(node: NetworkRuleNode, filterListId: number, ruleIndex = RULE_INDEX_NONE) {
        this.ruleIndex = ruleIndex;
        this.filterListId = filterListId;
        this.allowlist = node.exception;

        const pattern = node.pattern.value;
        if (pattern && hasSpaces(pattern)) {
            throw new SyntaxError('Rule has spaces, seems to be an host rule');
        }

        if (node.modifiers?.children?.length) {
            this.loadOptions(node.modifiers);
        }

        if (NetworkRule.isTooGeneral(node)) {
            throw new SyntaxError(`Rule is too general: ${RuleGenerator.generate(node)}`);
        }

        this.calculatePriorityWeight();

        this.pattern = new Pattern(pattern, this.isOptionEnabled(NetworkRuleOption.MatchCase));
    }

    /**
     * Parses the options string and saves them.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers}
     *
     * @param options Modifier list node.
     *
     * @throws An error if there is an unsupported modifier.
     */
    private loadOptions(options: ModifierList): void {
        for (const option of options.children) {
            let value = EMPTY_STRING;

            if (option.value && option.value.value) {
                value = option.value.value;
            }

            this.loadOption(option.name.value, value, option.exception);
        }

        this.validateOptions();
    }

    /**
     * Returns true if rule contains (enabled or disabled) specified option.
     * Please note, that options have three state: enabled, disabled, undefined.
     *
     * @param option Rule option to check.
     *
     * @returns True if rule contains (enabled or disabled) specified option.
     */
    public hasOption(option: NetworkRuleOption): boolean {
        return this.isOptionEnabled(option) || this.isOptionDisabled(option);
    }

    /**
     * Returns true if rule has at least one cosmetic option enabled.
     *
     * @returns True if the rule has at least one cosmetic option enabled.
     */
    public hasCosmeticOption(): boolean {
        return (this.enabledOptions & NetworkRuleGroupOptions.CosmeticOption) !== 0;
    }

    /**
     * Returns true if the specified option is enabled.
     * Please note, that options have three state: enabled, disabled, undefined.
     *
     * @param option Rule option to check.
     *
     * @returns True if the specified option is enabled.
     */
    public isOptionEnabled(option: NetworkRuleOption): boolean {
        return (this.enabledOptions & option) === option;
    }

    /**
     * Returns true if one and only option is enabled.
     *
     * @param option Rule option to check.
     *
     * @returns True if the specified option is enabled.
     */
    public isSingleOptionEnabled(option: NetworkRuleOption): boolean {
        return this.enabledOptions === option;
    }

    /**
     * Returns true if the specified option is disabled.
     * Please note, that options have three state: enabled, disabled, undefined.
     *
     * @param option Rule option to check.
     *
     * @returns True if the specified option is disabled.
     */
    public isOptionDisabled(option: NetworkRuleOption): boolean {
        return (this.disabledOptions & option) === option;
    }

    /**
     * Checks if the rule has higher priority that the specified rule:
     * `allowlist + $important` > `$important` > `redirect` > `allowlist` > `basic rules`.
     *
     * @param r Rule to compare with.
     *
     * @returns True if the rule has higher priority than `r`.
     */
    public isHigherPriority(r: NetworkRule): boolean {
        return this.priorityWeight > r.priorityWeight;
    }

    /**
     * Returns true if the rule is considered "generic"
     * "generic" means that the rule is not restricted to a limited set of domains
     * Please note that it might be forbidden on some domains, though.
     *
     * @returns True if the rule is considered "generic".
     */
    public isGeneric(): boolean {
        return !this.domainModifier?.hasPermittedDomains();
    }

    /**
     * Returns true if this rule negates the specified rule.
     * Only makes sense when this rule has a `badfilter` modifier.
     *
     * @param specifiedRule Rule to check.
     *
     * @returns True if this rule negates the specified rule.
     */
    public negatesBadfilter(specifiedRule: NetworkRule): boolean {
        if (!this.isOptionEnabled(NetworkRuleOption.Badfilter)) {
            return false;
        }

        if (this.allowlist !== specifiedRule.allowlist) {
            return false;
        }

        if (this.pattern.pattern !== specifiedRule.pattern.pattern) {
            return false;
        }

        if (this.permittedRequestTypes !== specifiedRule.permittedRequestTypes) {
            return false;
        }

        if (this.restrictedRequestTypes !== specifiedRule.restrictedRequestTypes) {
            return false;
        }

        if ((this.enabledOptions ^ NetworkRuleOption.Badfilter) !== specifiedRule.enabledOptions) {
            return false;
        }

        if (this.disabledOptions !== specifiedRule.disabledOptions) {
            return false;
        }

        if (!stringArraysEquals(this.getRestrictedDomains(), specifiedRule.getRestrictedDomains())) {
            return false;
        }

        if (!stringArraysHaveIntersection(this.getPermittedDomains(), specifiedRule.getPermittedDomains())) {
            return false;
        }

        return true;
    }

    /**
     * Checks if this rule can be used for hosts-level blocking.
     *
     * @returns True if the rule can be used for hosts-level blocking.
     */
    public isHostLevelNetworkRule(): boolean {
        if (this.domainModifier?.hasPermittedDomains() || this.domainModifier?.hasRestrictedDomains()) {
            return false;
        }

        if (this.permittedRequestTypes !== 0 && this.restrictedRequestTypes !== 0) {
            return false;
        }

        if (this.disabledOptions !== NetworkRuleOption.NotSet) {
            return false;
        }

        if (this.enabledOptions !== NetworkRuleOption.NotSet) {
            return ((this.enabledOptions
                    & NetworkRuleGroupOptions.OptionHostLevelRules)
                | (this.enabledOptions
                    ^ NetworkRuleGroupOptions.OptionHostLevelRules)) === NetworkRuleGroupOptions.OptionHostLevelRules;
        }

        return true;
    }

    /**
     * Enables or disables the specified option.
     *
     * @param option Option to enable or disable.
     * @param enabled True to enable, false to disable.
     * @param skipRestrictions Skip options allowlist/blacklist restrictions.
     *
     * @throws An error if the option we're trying to enable cannot be.
     * For instance, you cannot enable $elemhide for blacklist rules.
     */
    private setOptionEnabled(option: NetworkRuleOption, enabled: boolean, skipRestrictions = false): void {
        if (!skipRestrictions) {
            if (!this.allowlist && (option & NetworkRuleGroupOptions.AllowlistOnly) === option) {
                throw new SyntaxError(
                    `Modifier ${NetworkRuleOption[option]} cannot be used in blacklist rule`,
                );
            }
        }

        if (enabled) {
            this.enabledOptions |= option;
        } else {
            this.disabledOptions |= option;
        }
    }

    /**
     * Permits or forbids the specified request type.
     * "Permits" means that the rule will match **only** the types that are permitted.
     * "Restricts" means that the rule will match **all but restricted**.
     *
     * @param requestType Request type.
     * @param permitted True if it's permitted (whic).
     */
    private setRequestType(requestType: RequestType, permitted: boolean): void {
        if (permitted) {
            this.permittedRequestTypes |= requestType;
        } else {
            this.restrictedRequestTypes |= requestType;
        }
    }

    /**
     * Sets and validates exceptionally allowed domains presented in $denyallow modifier.
     *
     * @param optionValue Denyallow modifier value.
     */
    private setDenyAllowDomains(optionValue: string): void {
        const domainModifier = new DomainModifier(optionValue, PIPE_SEPARATOR);
        if (domainModifier.restrictedDomains && domainModifier.restrictedDomains.length > 0) {
            throw new SyntaxError(
                'Invalid modifier: $denyallow domains cannot be negated',
            );
        }

        if (domainModifier.permittedDomains) {
            if (domainModifier.permittedDomains.some(DomainModifier.isWildcardOrRegexDomain)) {
                throw new SyntaxError(
                    'Invalid modifier: $denyallow does not support wildcards and regex domains',
                );
            }
        }

        this.denyAllowDomains = domainModifier.permittedDomains;
    }

    /**
     * Loads the specified modifier.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers}
     *
     * @param optionName Modifier name.
     * @param optionValue Modifier value.
     * @param exception True if the modifier is negated.
     *
     * @throws An error if there is an unsupported modifier.
     */
    private loadOption(optionName: string, optionValue: string, exception = false): void {
        const { OPTIONS, NEGATABLE_OPTIONS } = NetworkRule;

        if (optionName.startsWith(OPTIONS.NOOP)) {
            /**
             * A noop modifier does nothing and can be used to increase some rules readability.
             * It consists of the sequence of underscore characters (_) of any length
             * and can appear in a rule as many times as it's needed.
             */
            if (!optionName.split(OPTIONS.NOOP).some((s) => !!s)) {
                return;
            }
        }

        // TODO: Speed up this by creating a map from names to bit mask positions
        if (exception && !NEGATABLE_OPTIONS.has(optionName)) {
            throw new SyntaxError(`Invalid modifier: '${optionName}' cannot be negated`);
        }

        switch (optionName) {
            // General options
            // $first-party, $~first-party
            case OPTIONS.FIRST_PARTY:
                this.setOptionEnabled(NetworkRuleOption.ThirdParty, exception);
                break;
            // $third-party, $~third-party
            case OPTIONS.THIRD_PARTY:
                this.setOptionEnabled(NetworkRuleOption.ThirdParty, !exception);
                break;
            // $match-case, $~match-case
            case OPTIONS.MATCH_CASE:
                this.setOptionEnabled(NetworkRuleOption.MatchCase, !exception);
                break;
            // $important
            case OPTIONS.IMPORTANT:
                this.setOptionEnabled(NetworkRuleOption.Important, true);
                break;
            // $domain
            case OPTIONS.DOMAIN:
                this.domainModifier = new DomainModifier(optionValue, PIPE_SEPARATOR);
                break;
            // $denyallow
            case OPTIONS.DENYALLOW:
                this.setDenyAllowDomains(optionValue);
                break;
            // $method modifier
            case OPTIONS.METHOD: {
                this.setOptionEnabled(NetworkRuleOption.Method, true);
                this.methodModifier = new MethodModifier(optionValue);
                break;
            }
            // $header modifier
            case OPTIONS.HEADER:
                this.setOptionEnabled(NetworkRuleOption.Header, true);
                this.headerModifier = new HeaderModifier(optionValue);
                break;
            // $to modifier
            case OPTIONS.TO: {
                this.setOptionEnabled(NetworkRuleOption.To, true);
                this.toModifier = new ToModifier(optionValue);
                break;
            }
            // Document-level allowlist rules
            // $elemhide
            case OPTIONS.ELEMHIDE:
                this.setOptionEnabled(NetworkRuleOption.Elemhide, true);
                this.setRequestType(RequestType.Document, true);
                this.setRequestType(RequestType.SubDocument, true);
                break;
            // $generichide
            case OPTIONS.GENERICHIDE:
                this.setOptionEnabled(NetworkRuleOption.Generichide, true);
                this.setRequestType(RequestType.Document, true);
                this.setRequestType(RequestType.SubDocument, true);
                break;
            // $specifichide
            case OPTIONS.SPECIFICHIDE:
                this.setOptionEnabled(NetworkRuleOption.Specifichide, true);
                this.setRequestType(RequestType.Document, true);
                this.setRequestType(RequestType.SubDocument, true);
                break;
            // $genericblock
            case OPTIONS.GENERICBLOCK:
                this.setOptionEnabled(NetworkRuleOption.Genericblock, true);
                this.setRequestType(RequestType.Document, true);
                this.setRequestType(RequestType.SubDocument, true);
                break;
            // $jsinject
            case OPTIONS.JSINJECT:
                this.setOptionEnabled(NetworkRuleOption.Jsinject, true);
                this.setRequestType(RequestType.Document, true);
                this.setRequestType(RequestType.SubDocument, true);
                break;
            // $urlblock
            case OPTIONS.URLBLOCK:
                this.setOptionEnabled(NetworkRuleOption.Urlblock, true);
                this.setRequestType(RequestType.Document, true);
                this.setRequestType(RequestType.SubDocument, true);
                break;
            // $content
            case OPTIONS.CONTENT:
                this.setOptionEnabled(NetworkRuleOption.Content, true);
                this.setRequestType(RequestType.Document, true);
                this.setRequestType(RequestType.SubDocument, true);
                break;
            // $document, $doc / $~document, $~doc
            case OPTIONS.DOCUMENT:
            case OPTIONS.DOC:
                if (exception) {
                    this.setRequestType(RequestType.Document, false);
                    break;
                }

                this.setRequestType(RequestType.Document, true);
                // In the case of allowlist rules $document implicitly includes
                // all these modifiers: `$content`, `$elemhide`, `$jsinject`,
                // `$urlblock`.
                if (this.isAllowlist()) {
                    this.setOptionEnabled(NetworkRuleOption.Elemhide, true, true);
                    this.setOptionEnabled(NetworkRuleOption.Jsinject, true, true);
                    this.setOptionEnabled(NetworkRuleOption.Urlblock, true, true);
                    this.setOptionEnabled(NetworkRuleOption.Content, true, true);
                }
                break;
            // $stealth
            case OPTIONS.STEALTH:
                this.setOptionEnabled(NetworkRuleOption.Stealth, true);
                this.stealthModifier = new StealthModifier(optionValue);
                break;
            // $popup
            case OPTIONS.POPUP:
                this.setOptionEnabled(NetworkRuleOption.Popup, true);
                break;
            // Content type options
            // $script, $~script
            case OPTIONS.SCRIPT:
                this.setRequestType(RequestType.Script, !exception);
                break;
            // $stylesheet, $~stylesheet
            case OPTIONS.STYLESHEET:
                this.setRequestType(RequestType.Stylesheet, !exception);
                break;
            // $subdocument, $~subdocument
            case OPTIONS.SUBDOCUMENT:
                this.setRequestType(RequestType.SubDocument, !exception);
                break;
            // $object, $~object
            case OPTIONS.OBJECT:
                this.setRequestType(RequestType.Object, !exception);
                break;
            // $image, $~image
            case OPTIONS.IMAGE:
                this.setRequestType(RequestType.Image, !exception);
                break;
            // $xmlhttprequest, $~xmlhttprequest
            case OPTIONS.XMLHTTPREQUEST:
                this.setRequestType(RequestType.XmlHttpRequest, !exception);
                break;
            // $media, $~media
            case OPTIONS.MEDIA:
                this.setRequestType(RequestType.Media, !exception);
                break;
            // $font, $~font
            case OPTIONS.FONT:
                this.setRequestType(RequestType.Font, !exception);
                break;
            // $websocket, $~websocket
            case OPTIONS.WEBSOCKET:
                this.setRequestType(RequestType.WebSocket, !exception);
                break;
            // $other, $~other
            case OPTIONS.OTHER:
                this.setRequestType(RequestType.Other, !exception);
                break;
            // $ping, $~ping
            case OPTIONS.PING:
                this.setRequestType(RequestType.Ping, !exception);
                break;
            // Special modifiers
            // $badfilter
            case OPTIONS.BADFILTER:
                this.setOptionEnabled(NetworkRuleOption.Badfilter, true);
                break;
            // $csp
            case OPTIONS.CSP:
                this.setOptionEnabled(NetworkRuleOption.Csp, true);
                this.advancedModifier = new CspModifier(optionValue, this.isAllowlist());
                break;
            // $replace
            case OPTIONS.REPLACE:
                this.setOptionEnabled(NetworkRuleOption.Replace, true);
                this.advancedModifier = new ReplaceModifier(optionValue);
                break;
            // $cookie
            case OPTIONS.COOKIE:
                this.setOptionEnabled(NetworkRuleOption.Cookie, true);
                this.advancedModifier = new CookieModifier(optionValue);
                break;
            // $redirect
            case OPTIONS.REDIRECT:
                this.setOptionEnabled(NetworkRuleOption.Redirect, true);
                this.advancedModifier = new RedirectModifier(optionValue, this.isAllowlist());
                break;
            // $redirect-rule
            case OPTIONS.REDIRECTRULE:
                this.setOptionEnabled(NetworkRuleOption.Redirect, true);
                this.advancedModifier = new RedirectModifier(optionValue, this.isAllowlist(), true);
                break;
            // $removeparam
            case OPTIONS.REMOVEPARAM:
                this.setOptionEnabled(NetworkRuleOption.RemoveParam, true);
                this.advancedModifier = new RemoveParamModifier(optionValue);
                break;
            // $removeheader
            case OPTIONS.REMOVEHEADER:
                this.setOptionEnabled(NetworkRuleOption.RemoveHeader, true);
                this.advancedModifier = new RemoveHeaderModifier(optionValue, this.isAllowlist());
                break;
            // $permissions
            case OPTIONS.PERMISSIONS:
                this.setOptionEnabled(NetworkRuleOption.Permissions, true);
                this.advancedModifier = new PermissionsModifier(optionValue, this.isAllowlist());
                break;
            // $jsonprune
            // simple validation of jsonprune rules for compiler
            // https://github.com/AdguardTeam/FiltersCompiler/issues/168
            case OPTIONS.JSONPRUNE:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension does not support $jsonprune modifier yet');
                }
                this.setOptionEnabled(NetworkRuleOption.JsonPrune, true);
                // TODO: should be properly implemented later
                // https://github.com/AdguardTeam/tsurlfilter/issues/71
                break;
            // $hls
            // simple validation of hls rules for compiler
            // https://github.com/AdguardTeam/FiltersCompiler/issues/169
            case OPTIONS.HLS:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension does not support $hls modifier yet');
                }
                this.setOptionEnabled(NetworkRuleOption.Hls, true);
                // TODO: should be properly implemented later
                // https://github.com/AdguardTeam/tsurlfilter/issues/72
                break;
            // $referrerpolicy
            // simple validation of referrerpolicy rules for compiler
            // https://github.com/AdguardTeam/FiltersCompiler/issues/191
            case OPTIONS.REFERRERPOLICY:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension does not support $referrerpolicy modifier');
                }
                // do nothing as $referrerpolicy is supported by CoreLibs-based apps only.
                // it is needed for proper rule conversion performed by FiltersCompiler
                // so rules with $referrerpolicy modifier is not marked as invalid
                break;
            // Dns modifiers
            // $client
            case OPTIONS.CLIENT:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension doesn\'t support $client modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Client, true);
                this.advancedModifier = new ClientModifier(optionValue);
                break;
            // $dnsrewrite
            case OPTIONS.DNSREWRITE:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension doesn\'t support $dnsrewrite modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.DnsRewrite, true);
                this.advancedModifier = new DnsRewriteModifier(optionValue);
                break;
            // $dnstype
            case OPTIONS.DNSTYPE:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension doesn\'t support $dnstype modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.DnsType, true);
                this.advancedModifier = new DnsTypeModifier(optionValue);
                break;
            // $ctag
            case OPTIONS.CTAG:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension doesn\'t support $ctag modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Ctag, true);
                this.advancedModifier = new CtagModifier(optionValue);
                break;
            // $app
            case OPTIONS.APP:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension doesn\'t support $app modifier');
                }
                this.appModifier = new AppModifier(optionValue);
                break;
            // $network
            case OPTIONS.NETWORK:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension doesn\'t support $network modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Network, true);
                break;
            // $extension, $~extension
            case OPTIONS.EXTENSION:
                if (isCompatibleWith(CompatibilityTypes.Extension)) {
                    throw new SyntaxError('Extension doesn\'t support $extension modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Extension, !exception);
                break;
            // $all
            case OPTIONS.ALL:
                if (this.isAllowlist()) {
                    throw new SyntaxError('Rule with $all modifier can not be allowlist rule');
                }
                // Set all request types
                Object.values(RequestType).forEach((type) => {
                    this.setRequestType(type, true);
                });
                this.setOptionEnabled(NetworkRuleOption.Popup, true);
                break;
            // $empty and $mp4
            // Deprecated in favor of $redirect
            case OPTIONS.EMPTY:
            case OPTIONS.MP4:
                // Do nothing.
                break;
            default: {
                // clear empty values
                const modifierView = [optionName, optionValue]
                    .filter((i) => i)
                    .join('=');
                throw new SyntaxError(`Unknown modifier: ${modifierView}`);
            }
        }
    }

    /**
     * To calculate priority, we've categorized modifiers into different groups.
     * These groups are ranked based on their priority, from lowest to highest.
     * A modifier that significantly narrows the scope of a rule adds more
     * weight to its total priority. Conversely, if a rule applies to a broader
     * range of requests, its priority decreases.
     *
     * It's worth noting that there are cases where a single-parameter modifier
     * has a higher priority than multi-parameter ones. For instance, in
     * the case of `$domain=example.com|example.org`, a rule that includes two
     * domains has a slightly broader effective area than a rule with one
     * specified domain, therefore its priority is lower.
     *
     * The base priority weight of any rule is 1. If the calculated priority
     * is a floating-point number, it will be **rounded up** to the smallest
     * integer greater than or equal to the calculated weight.
     *
     * @see {@link NetworkRule.PermittedRequestTypeWeight}
     * @see {@link NetworkRule.PermittedDomainWeight}
     * @see {@link NetworkRule.SpecificExceptionsWeight}
     * @see {@link NetworkRule.AllowlistRuleWeight}
     * @see {@link NetworkRule.RedirectRuleWeight}
     * @see {@link NetworkRule.ImportantRuleWeight}
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-counting}
     */
    private calculatePriorityWeight() {
        // Base modifiers, category 1.
        this.priorityWeight += countEnabledBits(this.enabledOptions, NetworkRule.CATEGORY_1_OPTIONS_MASK);
        this.priorityWeight += countEnabledBits(this.disabledOptions, NetworkRule.CATEGORY_1_OPTIONS_MASK);

        /**
         * When dealing with a negated domain, app, method, or content-type,
         * we add a point for the existence of the modifier itself, regardless
         * of the quantity of negated domains or content-types. This is because
         * the rule's scope is already infinitely broad. Put simply,
         * by prohibiting multiple domains, content-types, methods or apps,
         * the scope of the rule becomes only minimally smaller.
         */
        if (this.denyAllowDomains && this.denyAllowDomains.length > 0) {
            this.priorityWeight += 1;
        }

        const { domainModifier } = this;
        if (domainModifier?.hasRestrictedDomains()) {
            this.priorityWeight += 1;
        }

        if (this.methodModifier?.restrictedValues && this.methodModifier.restrictedValues.length > 0) {
            this.priorityWeight += 1;
        }

        if (this.restrictedRequestTypes !== RequestType.NotSet) {
            this.priorityWeight += 1;
        }

        // $to modifier is basically a replacement for a regular expression
        // See https://github.com/AdguardTeam/KnowledgeBase/pull/196#discussion_r1221401215
        if (this.toModifier) {
            this.priorityWeight += 1;
        }

        /**
         * Category 2: permitted request types, methods, headers, $popup.
         * Specified content-types add `50 + 50 / number_of_content_types`,
         * for example: `||example.com^$image,script` will add
         * `50 + 50 / 2 = 50 + 25 = 75` to the total weight of the rule.
         * The `$popup` also belongs to this category, because it implicitly
         * adds the modifier `$document`.
         * Similarly, specific exceptions add `$document,subdocument`.
         *
         * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-2}
         */
        if (this.permittedRequestTypes !== RequestType.NotSet) {
            const numberOfPermittedRequestTypes = getBitCount(this.permittedRequestTypes);
            // More permitted request types mean less priority weight.
            const relativeWeight = NetworkRule.CategoryTwoWeight / numberOfPermittedRequestTypes;
            this.priorityWeight += NetworkRule.CategoryTwoWeight + relativeWeight;
        }

        if (this.methodModifier?.permittedValues && this.methodModifier.permittedValues.length > 0) {
            // More permitted request methods mean less priority weight.
            const relativeWeight = NetworkRule.CategoryTwoWeight / this.methodModifier.permittedValues.length;
            this.priorityWeight += NetworkRule.CategoryTwoWeight + relativeWeight;
        }

        if (this.headerModifier) {
            // $header modifier in the rule adds 50
            this.priorityWeight += NetworkRule.CategoryTwoWeight;
        }

        /**
         * Category 3: permitted domains.
         * Specified domains through `$domain` and specified applications
         * through `$app` add `100 + 100 / number_domains (or number_applications)`,
         * for example:
         * `||example.com^$domain=example.com|example.org|example.net`
         * will add `100 + 100 / 3 = 134.3 = 134` or
         * `||example.com^$app=org.example.app1|org.example.app2`
         * will add `100 + 100 / 2 = 151`.
         */
        if (domainModifier?.hasPermittedDomains()) {
            // More permitted domains mean less priority weight.
            const relativeWeight = NetworkRule.CategoryThreeWeight / domainModifier.getPermittedDomains()!.length;
            this.priorityWeight += NetworkRule.CategoryThreeWeight + relativeWeight;
        }

        // Category 4: redirect rules.
        if (this.isOptionEnabled(NetworkRuleOption.Redirect)) {
            this.priorityWeight += NetworkRule.CategoryFourWeight;
        }

        // Category 5: specific exceptions.
        this.priorityWeight += NetworkRule.CategoryFiveWeight * countEnabledBits(
            this.enabledOptions,
            NetworkRule.SPECIFIC_EXCLUSIONS_MASK,
        );

        // Category 6: allowlist rules.
        if (this.isAllowlist()) {
            this.priorityWeight += NetworkRule.CategorySixWeight;
        }

        // Category 7: important rules.
        if (this.isOptionEnabled(NetworkRuleOption.Important)) {
            this.priorityWeight += NetworkRule.CategorySevenWeight;
        }

        // Round up to avoid overlap between different categories of rules.
        this.priorityWeight = Math.ceil(this.priorityWeight);
    }

    /**
     * Validates rule options.
     */
    private validateOptions(): void {
        if (this.advancedModifier instanceof RemoveParamModifier) {
            this.validateRemoveParamRule();
        } else if (this.advancedModifier instanceof RemoveHeaderModifier) {
            this.validateRemoveHeaderRule();
        } else if (this.advancedModifier instanceof PermissionsModifier) {
            this.validatePermissionsRule();
        } else if (this.headerModifier instanceof HeaderModifier) {
            this.validateHeaderRule();
        } else if (this.toModifier !== null) {
            this.validateToRule();
        } else if (this.denyAllowDomains !== null) {
            this.validateDenyallowRule();
        }
    }

    /**
     * Validates $header rule.
     *
     * $header is compatible with the limited list of modifiers:
     * - $important
     * - $csp
     * - $removeheader (on response headers)
     * - $third-party
     * - $match-case
     * - $badfilter
     * - $domain
     * - all content type modifiers ($subdocument, $script, $stylesheet, etc).
     *
     * The rules with any other modifiers are considered invalid and will be discarded.
     */
    private validateHeaderRule(): void {
        if ((this.enabledOptions | NetworkRuleGroupOptions.HeaderCompatibleOptions)
                        !== NetworkRuleGroupOptions.HeaderCompatibleOptions) {
            throw new SyntaxError('$header rules are not compatible with some other modifiers');
        }
        if (this.advancedModifier && this.isOptionEnabled(NetworkRuleOption.RemoveHeader)) {
            const removeHeaderValue = this.getAdvancedModifierValue();
            if (!removeHeaderValue || removeHeaderValue.includes('request:')) {
                const message = '$header rules are only compatible with response headers removal of $removeheader.';
                throw new SyntaxError(message);
            }
        }
    }

    /**
     * $permissions rules are not compatible with any other
     * modifiers except $domain, $important, and $subdocument.
     * The rules with any other modifiers are considered invalid and will be discarded.
     */
    private validatePermissionsRule(): void {
        if ((this.enabledOptions | NetworkRuleGroupOptions.PermissionsCompatibleOptions)
                !== NetworkRuleGroupOptions.PermissionsCompatibleOptions) {
            throw new SyntaxError('$permissions rules are not compatible with some other modifiers');
        }
    }

    /**
     * $removeparam rules are not compatible with any other modifiers except $domain,
     * $third-party, $app, $important, $match-case and permitted content type modifiers ($script, $stylesheet, etc).
     * The rules with any other modifiers are considered invalid and will be discarded.
     */
    private validateRemoveParamRule(): void {
        if ((this.enabledOptions | NetworkRuleGroupOptions.RemoveParamCompatibleOptions)
            !== NetworkRuleGroupOptions.RemoveParamCompatibleOptions) {
            throw new SyntaxError('$removeparam rules are not compatible with some other modifiers');
        }
    }

    /**
     * $removeheader rules are not compatible with any other modifiers except $domain,
     * $third-party, $app, $important, $match-case and permitted content type modifiers ($script, $stylesheet, etc).
     * The rules with any other modifiers are considered invalid and will be discarded.
     */
    private validateRemoveHeaderRule(): void {
        if ((this.enabledOptions | NetworkRuleGroupOptions.RemoveHeaderCompatibleOptions)
            !== NetworkRuleGroupOptions.RemoveHeaderCompatibleOptions) {
            throw new SyntaxError('$removeheader rules are not compatible with some other modifiers');
        }
        if (this.headerModifier && this.isOptionEnabled(NetworkRuleOption.Header)) {
            const removeHeaderValue = this.getAdvancedModifierValue();
            if (!removeHeaderValue || removeHeaderValue.includes('request:')) {
                const message = 'Request headers removal of $removeheaders is not compatible with $header rules.';
                throw new SyntaxError(message);
            }
        }
    }

    /**
     * $to rules are not compatible $denyallow - these rules considered invalid
     * and will be discarded.
     */
    private validateToRule(): void {
        if (this.denyAllowDomains) {
            throw new SyntaxError('modifier $to is not compatible with $denyallow modifier');
        }
    }

    /**
     * $denyallow rules are not compatible $to - these rules considered invalid
     * and will be discarded.
     */
    private validateDenyallowRule(): void {
        if (this.toModifier) {
            throw new SyntaxError('modifier $to is not compatible with $denyallow modifier');
        }
    }
}
