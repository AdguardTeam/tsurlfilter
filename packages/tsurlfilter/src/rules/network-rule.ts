// eslint-disable-next-line max-classes-per-file
import * as rule from './rule';
import { SimpleRegex } from './simple-regex';
import { Request } from '../request';
import { DomainModifier, PIPE_SEPARATOR } from '../modifiers/domain-modifier';
import * as utils from '../utils/utils';
import { IAdvancedModifier } from '../modifiers/advanced-modifier';
import { ReplaceModifier } from '../modifiers/replace-modifier';
import { CspModifier } from '../modifiers/csp-modifier';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { RedirectModifier } from '../modifiers/redirect-modifier';
import { RemoveParamModifier } from '../modifiers/remove-param-modifier';
import { RemoveHeaderModifier } from '../modifiers/remove-header-modifier';
import { CompatibilityTypes, isCompatibleWith } from '../configuration';
import { AppModifier, IAppModifier } from '../modifiers/app-modifier';
import {
    ESCAPE_CHARACTER,
    MASK_ALLOWLIST,
    NETWORK_RULE_OPTIONS,
    NOT_MARK,
    OPTIONS_DELIMITER,
} from './network-rule-options';
import { RequestType } from '../request-type';
import { ClientModifier } from '../modifiers/dns/client-modifier';
import { DnsRewriteModifier } from '../modifiers/dns/dnsrewrite-modifier';
import { DnsTypeModifier } from '../modifiers/dns/dnstype-modifier';
import { CtagModifier } from '../modifiers/dns/ctag-modifier';
import { Pattern } from './pattern';

/**
 * NetworkRuleOption is the enumeration of various rule options.
 * In order to save memory, we store some options as a flag.
 * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#modifiers
 */
export enum NetworkRuleOption {
    /** $third-party modifier */
    ThirdParty = 1,
    /** $match-case modifier */
    MatchCase = 1 << 1,
    /** $important modifier */
    Important = 1 << 2,

    // Allowlist rules modifiers
    // Each of them can disable part of the functionality

    /** $elemhide modifier */
    Elemhide = 1 << 3,
    /** $generichide modifier */
    Generichide = 1 << 4,
    /** $specifichide modifier */
    Specifichide = 1 << 5,
    /** $genericblock modifier */
    Genericblock = 1 << 6,
    /** $jsinject modifier */
    Jsinject = 1 << 7,
    /** $urlblock modifier */
    Urlblock = 1 << 8,
    /** $content modifier */
    Content = 1 << 9,
    /** $extension modifier */
    Extension = 1 << 10,
    /** $stealth modifier */
    Stealth = 1 << 11,

    // Content modifying
    // $empty modifier
    Empty = 1 << 12,
    // $mp4 modifier
    Mp4 = 1 << 13,

    // Other modifiers

    /** $popup modifier */
    Popup = 1 << 14,
    /** $csp modifier */
    Csp = 1 << 15,
    /** $replace modifier */
    Replace = 1 << 16,
    /** $cookie modifier */
    Cookie = 1 << 17,
    /** $redirect modifier */
    Redirect = 1 << 18,
    /** $badfilter modifier */
    Badfilter = 1 << 19,
    /** $removeparam modifier */
    RemoveParam = 1 << 20,
    /** $removeheader modifier */
    RemoveHeader = 1 << 21,

    // Compatibility dependent
    /** $network modifier */
    Network = 1 << 22,

    /** dns modifiers */
    Client = 1 << 23,
    DnsRewrite = 1 << 24,
    DnsType = 1 << 25,
    Ctag = 1 << 26,

    // Document
    Document = 1 << 27,

    // Groups (for validation)

    /** Blacklist-only modifiers */
    BlacklistOnly = Empty | Mp4,

    /** Allowlist-only modifiers */
    AllowlistOnly = Elemhide
        | Genericblock
        | Generichide
        | Specifichide
        | Jsinject
        | Urlblock
        | Content
        | Extension
        | Stealth,

    /** Options supported by host-level network rules * */
    OptionHostLevelRules = Important | Badfilter | Client | DnsRewrite | DnsType | Ctag,

    /**
     * Removeparam compatible modifiers
     *
     * $removeparam rules are compatible only with content type modifiers ($script, $stylesheet, etc)
     * and this list of modifiers:
     */
    RemoveParamCompatibleOptions = RemoveParam | ThirdParty | Important | MatchCase | Badfilter | Document,

    /**
     * Removeheader compatible modifiers
     *
     * $removeheader rules are compatible only with content type modifiers ($script, $stylesheet, etc)
     * and this list of modifiers:
     */
    RemoveHeaderCompatibleOptions = RemoveHeader | ThirdParty | Important | MatchCase | Badfilter | Document,
}

/**
 * Helper class that is used for passing {@link NetworkRule.parseRuleText}
 * result to the caller. Should not be used outside of this file.
 */
class BasicRuleParts {
    /**
     * Basic rule pattern (which can be easily converted into a regex).
     * See {@link SimpleRegex} for more details.
     */
    public pattern: string | undefined;

    /**
     * String with all rule options (modifiers).
     */
    public options: string | undefined;

    /**
     * Indicates if rule is "allowlist" (e.g. it should unblock requests, not block them).
     */
    public allowlist: boolean | undefined;
}

/**
 * Basic network filtering rule.
 * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules
 */
export class NetworkRule implements rule.IRule {
    private readonly ruleText: string;

    private readonly filterListId: number;

    private readonly allowlist: boolean;

    private readonly pattern: Pattern;

    private permittedDomains: string[] | null = null;

    private restrictedDomains: string[] | null = null;

    /**
     * Domains in denyallow modifier providing exceptions for permitted domains
     * https://github.com/AdguardTeam/CoreLibs/issues/1304
     */
    private denyAllowDomains: string[] | null = null;

    /** Flag with all enabled rule options */
    private enabledOptions: NetworkRuleOption = 0;

    /** Flag with all disabled rule options */
    private disabledOptions: NetworkRuleOption = 0;

    /** Flag with all permitted request types. 0 means ALL. */
    private permittedRequestTypes: RequestType = 0;

    /** Flag with all restricted request types. 0 means NONE. */
    private restrictedRequestTypes: RequestType = 0;

    /**
     * Rule Advanced modifier
     */
    private advancedModifier: IAdvancedModifier | null = null;

    /**
     * Rule App modifier
     */
    private appModifier: IAppModifier | null = null;

    /**
     * Priority weight
     * Used in rules priority comparision
     */
    private priorityWeight = 0;

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
     * This character is used to escape special characters in modifiers values
     */
    private static ESCAPE_CHARACTER = ESCAPE_CHARACTER;

    // eslint-disable-next-line max-len
    private static RE_ESCAPED_OPTIONS_DELIMITER = new RegExp(`${NetworkRule.ESCAPE_CHARACTER}${NetworkRule.OPTIONS_DELIMITER}`, 'g');

    /**
     * A marker that is used in rules of exception.
     * To turn off filtering for a request, start your rule with this marker.
     */
    public static readonly MASK_ALLOWLIST = MASK_ALLOWLIST;

    /**
     * Mark that negates options
     */
    public static readonly NOT_MARK = NOT_MARK;

    /**
     * Rule options
     */
    public static readonly OPTIONS = NETWORK_RULE_OPTIONS;

    getText(): string {
        return this.ruleText;
    }

    getFilterListId(): number {
        return this.filterListId;
    }

    /**
     * Returns rule pattern,
     * which currently is used only in the rule validator module
     */
    getPattern(): string {
        return this.pattern.pattern;
    }

    /**
     * Returns `true` if the rule is "allowlist", e.g. if it disables other
     * rules when the pattern matches the request.
     */
    isAllowlist(): boolean {
        return this.allowlist;
    }

    /**
     * Checks if the rule is a document-level allowlist rule
     * This means that the rule is supposed to disable or modify blocking
     * of the page subrequests.
     * For instance, `@@||example.org^$urlblock` unblocks all sub-requests.
     */
    isDocumentLevelAllowlistRule(): boolean {
        if (!this.isAllowlist()) {
            return false;
        }

        return this.isOptionEnabled(NetworkRuleOption.Urlblock)
            || this.isOptionEnabled(NetworkRuleOption.Genericblock)
            || this.isOptionEnabled(NetworkRuleOption.Content);
    }

    /**
     * Checks if the rule is a document allowlist rule.
     * For instance,
     * "@@||example.org^$document"
     * completely disables filtering on all pages at example.com and all subdomains.
     */
    isDocumentAllowlistRule(): boolean {
        if (!this.isAllowlist()) {
            return false;
        }

        return this.isOptionEnabled(NetworkRuleOption.Document);
    }

    /**
     * The longest part of pattern without any special characters.
     * It is used to improve the matching performance.
     */
    getShortcut(): string {
        return this.pattern.shortcut;
    }

    /**
     * Gets list of permitted domains.
     * See https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#domain-modifier
     */
    getPermittedDomains(): string[] | null {
        return this.permittedDomains;
    }

    /**
     * Gets list of restricted domains.
     * See https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#domain-modifier
     */
    getRestrictedDomains(): string[] | null {
        return this.restrictedDomains;
    }

    /**
     * Gets list of permitted domains.
     * See https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#app
     */
    getPermittedApps(): string[] | null {
        if (this.appModifier) {
            return this.appModifier.permittedApps;
        }
        return null;
    }

    /**
     * Gets list of restricted domains.
     * See https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#app
     */
    getRestrictedApps(): string[] | null {
        if (this.appModifier) {
            return this.appModifier.restrictedApps;
        }
        return null;
    }

    /** Flag with all permitted request types. 0 means ALL. */
    getPermittedRequestTypes(): RequestType {
        return this.permittedRequestTypes;
    }

    /** Flag with all restricted request types. 0 means NONE. */
    getRestrictedRequestTypes(): RequestType {
        return this.restrictedRequestTypes;
    }

    /**
     * Advanced modifier
     */
    getAdvancedModifier(): IAdvancedModifier | null {
        return this.advancedModifier;
    }

    /**
     * Advanced modifier value
     */
    getAdvancedModifierValue(): string | null {
        return this.advancedModifier && this.advancedModifier.getValue();
    }

    /**
     * isRegexRule returns true if rule's pattern is a regular expression.
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#regexp-support
     */
    isRegexRule(): boolean {
        return (
            this.getPattern().startsWith(SimpleRegex.MASK_REGEX_RULE)
            && this.getPattern().endsWith(SimpleRegex.MASK_REGEX_RULE)
        );
    }

    public matchesPermittedDomains(hostname: string): boolean {
        if (this.hasPermittedDomains()
            && DomainModifier.isDomainOrSubdomainOfAny(hostname, this.permittedDomains!)) {
            return true;
        }
        return false;
    }

    /**
     * Checks if this filtering rule matches the specified request.
     * @param request - request to check.
     * @param useShortcut - the flag to use this rule shortcut
     *
     * In case we use Trie in lookup table, we don't need to use shortcut cause we already check if request's url
     * includes full rule shortcut.
     */
    match(request: Request, useShortcut = true): boolean {
        if (useShortcut && !this.matchShortcut(request)) {
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

        if (this.isOptionEnabled(NetworkRuleOption.RemoveParam)) {
            if (!this.matchRequestTypeExplicit(request.requestType)) {
                return false;
            }
        }

        if (!this.matchDenyAllowDomains(request.hostname)) {
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
     * matchShortcut simply checks if shortcut is a substring of the URL.
     * @param request - request to check.
     */
    private matchShortcut(request: Request): boolean {
        return request.urlLowercase.indexOf(this.getShortcut()) >= 0;
    }

    /**
     * matchDomain checks if the filtering rule is allowed on this domain.
     * @param domain - domain to check.
     */
    private matchDomain(domain: string): boolean {
        if (this.hasRestrictedDomains()) {
            if (DomainModifier.isDomainOrSubdomainOfAny(domain, this.restrictedDomains!)) {
                // Domain or host is restricted
                // i.e. $domain=~example.org
                return false;
            }
        }

        if (this.hasPermittedDomains()) {
            if (!DomainModifier.isDomainOrSubdomainOfAny(domain, this.permittedDomains!)) {
                // Domain is not among permitted
                // i.e. $domain=example.org and we're checking example.com
                return false;
            }
        }

        return true;
    }

    /**
     * Check if request matches domain modifier by request referrer (general case) or by request target
     *
     * In some cases the $domain modifier can match not only the referrer domain, but also the target domain.
     * This happens when the following is true (1 AND ((2 AND 3) OR 4):
     *
     * 1) The request has document type
     * 2) The rule's pattern doesn't match any particular domain(s)
     * 3) The rule's pattern doesn't contain regular expressions
     * 4) The $domain modifier contains only excluded domains (e.g., $domain=~example.org|~example.com)
     *
     * When all these conditions are met, the domain modifier will match both the referrer domain and the target domain.
     * https://github.com/AdguardTeam/tsurlfilter/issues/45
     * @param request
     */
    matchDomainModifier(request: Request): boolean {
        if (!this.permittedDomains && !this.restrictedDomains) {
            return true;
        }

        const isDocumentType = request.requestType === RequestType.Document
            || request.requestType === RequestType.Subdocument;

        const hasOnlyExcludedDomains = (!this.permittedDomains || this.permittedDomains.length === 0)
            && this.restrictedDomains
            && this.restrictedDomains.length > 0;

        const patternIsRegex = this.isRegexRule();
        const patternIsDomainSpecific = this.pattern.isPatternDomainSpecific();

        const matchesTargetByPatternCondition = !patternIsRegex && !patternIsDomainSpecific;

        if (isDocumentType && (hasOnlyExcludedDomains || matchesTargetByPatternCondition)) {
            // check if matches source hostname if exists or if matches target hostname
            return (request.sourceHostname && this.matchDomain(request.sourceHostname))
                || this.matchDomain(request.hostname);
        }

        return this.matchDomain(request.sourceHostname || '');
    }

    /**
     * checks if the filtering rule is allowed on this domain.
     * @param domain
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
     * Return TRUE if this rule matches with the tags associated with a client
     *
     * @param clientTags
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
     * returns TRUE if the rule matches with the specified client
     *
     * @param clientName
     * @param clientIP
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
     * Return TRUE if this rule matches with the request dnstype
     *
     * @param dnstype
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
     * Checks if rule has permitted domains
     */
    private hasPermittedDomains(): boolean {
        return this.permittedDomains != null && this.permittedDomains.length > 0;
    }

    /**
     * Checks if rule has restricted domains
     */
    private hasRestrictedDomains(): boolean {
        return this.restrictedDomains != null && this.restrictedDomains.length > 0;
    }

    /**
     * Checks if rule has permitted apps
     */
    private hasPermittedApps(): boolean {
        if (!this.appModifier) {
            return false;
        }

        return this.appModifier!.permittedApps !== null && this.appModifier!.permittedApps.length > 0;
    }

    /**
     * matchRequestType checks if the request's type matches the rule properties
     * @param requestType - request type to check.
     */
    public matchRequestType(requestType: RequestType): boolean {
        if (this.permittedRequestTypes !== 0) {
            if ((this.permittedRequestTypes & requestType) !== requestType) {
                return false;
            }
        }

        if (this.restrictedRequestTypes !== 0) {
            if ((this.restrictedRequestTypes & requestType) === requestType) {
                return false;
            }
        }

        return true;
    }

    /**
     * In case of $removeparam modifier,
     * we only allow it to target other content types if the rule has an explicit content-type modifier.
     */
    private matchRequestTypeExplicit(requestType: RequestType): boolean {
        if (this.permittedRequestTypes === 0
            && this.restrictedRequestTypes === 0
            && requestType !== RequestType.Document
            && requestType !== RequestType.Subdocument) {
            return false;
        }

        return this.matchRequestType(requestType);
    }

    /**
     * Checks if pattern has spaces
     * Used in order to do not create network rules from host rules
     * @param pattern
     * @private
     */
    private static hasSpaces(pattern: string): boolean {
        return pattern.indexOf(' ') > -1;
    }

    /**
     * Creates an instance of the {@link NetworkRule}.
     * It parses this rule and extracts the rule pattern (see {@link SimpleRegex}),
     * and rule modifiers.
     *
     * @param ruleText - original rule text.
     * @param filterListId - ID of the filter list this rule belongs to.
     *
     * @throws error if it fails to parse the rule.
     */
    constructor(ruleText: string, filterListId: number) {
        this.ruleText = ruleText;
        this.filterListId = filterListId;

        const ruleParts = NetworkRule.parseRuleText(ruleText);
        this.allowlist = !!ruleParts.allowlist;

        const pattern = ruleParts.pattern!;
        if (pattern && NetworkRule.hasSpaces(pattern)) {
            throw new SyntaxError('Rule has spaces, seems to be an host rule');
        }

        if (ruleParts.options) {
            this.loadOptions(ruleParts.options);
        }

        if (
            pattern === SimpleRegex.MASK_START_URL
            || pattern === SimpleRegex.MASK_ANY_CHARACTER
            || pattern === ''
            || pattern.length < SimpleRegex.MIN_GENERIC_RULE_LENGTH
        ) {
            // Except cookie and removeparam rules, they have their own atmosphere
            if (!(this.advancedModifier instanceof CookieModifier)
                && !(this.advancedModifier instanceof RemoveParamModifier)) {
                if (!(this.hasPermittedDomains() || this.hasPermittedApps())) {
                    // Rule matches too much and does not have any domain restriction
                    // We should not allow this kind of rules
                    // eslint-disable-next-line max-len
                    throw new SyntaxError('The rule is too wide, add domain restriction or make the pattern more specific');
                }
            }
        }

        this.pattern = new Pattern(pattern, this.isOptionEnabled(NetworkRuleOption.MatchCase));
    }

    /**
     * Parses the options string and saves them.
     * More on the rule modifiers:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers
     *
     * @param options - string with the rule modifiers
     *
     * @throws an error if there is an unsupported modifier
     */
    private loadOptions(options: string): void {
        const optionParts = utils.splitByDelimiterWithEscapeCharacter(options, ',', '\\', false);

        for (let i = 0; i < optionParts.length; i += 1) {
            const option = optionParts[i];
            const valueIndex = option.indexOf('=');
            let optionName = option;
            let optionValue = '';
            if (valueIndex > 0) {
                optionName = option.substring(0, valueIndex);
                optionValue = option.substring(valueIndex + 1);
            }
            this.loadOption(optionName, optionValue);
        }

        // More specified rule has more priority
        this.priorityWeight = optionParts.length;

        this.validateOptions();

        // In the case of allowlist rules $document implicitly includes all other modifiers:
        // `$content`, `$elemhide`, `$jsinject`, `$urlblock`.
        if (this.isAllowlist() && this.isOptionEnabled(NetworkRuleOption.Document)) {
            this.setOptionEnabled(NetworkRuleOption.Elemhide, true, true);
            this.setOptionEnabled(NetworkRuleOption.Jsinject, true, true);
            this.setOptionEnabled(NetworkRuleOption.Urlblock, true, true);
            this.setOptionEnabled(NetworkRuleOption.Content, true, true);
        }

        // Rules of these types can be applied to documents only
        // $jsinject, $elemhide, $urlblock, $genericblock, $generichide and $content for allowlist rules.
        // $popup - for url blocking
        if (
            this.isOptionEnabled(NetworkRuleOption.Jsinject)
            || this.isOptionEnabled(NetworkRuleOption.Elemhide)
            || this.isOptionEnabled(NetworkRuleOption.Content)
            || this.isOptionEnabled(NetworkRuleOption.Urlblock)
            || this.isOptionEnabled(NetworkRuleOption.Genericblock)
            || this.isOptionEnabled(NetworkRuleOption.Generichide)
            || this.isOptionEnabled(NetworkRuleOption.Popup)
        ) {
            this.permittedRequestTypes = RequestType.Document;
        }
    }

    /**
     * Returns true if the specified option is enabled.
     * Please note, that options have three state: enabled, disabled, undefined.
     *
     * @param option - rule option to check.
     */
    isOptionEnabled(option: NetworkRuleOption): boolean {
        return (this.enabledOptions & option) === option;
    }

    /**
     * Returns true if one and only option is enabled
     *
     * @param option
     */
    isSingleOptionEnabled(option: NetworkRuleOption): boolean {
        return this.enabledOptions === option;
    }

    /**
     * Returns true if the specified option is disabled.
     * Please note, that options have three state: enabled, disabled, undefined.
     *
     * @param option - rule option to check.
     */
    isOptionDisabled(option: NetworkRuleOption): boolean {
        return (this.disabledOptions & option) === option;
    }

    /**
     * Checks if the rule has higher priority that the specified rule
     * allowlist + $important > $important > allowlist > basic rules
     */
    isHigherPriority(r: NetworkRule): boolean {
        const important = this.isOptionEnabled(NetworkRuleOption.Important);
        const rImportant = r.isOptionEnabled(NetworkRuleOption.Important);
        if (this.isAllowlist() && important && !(r.isAllowlist() && rImportant)) {
            return true;
        }

        if (r.isAllowlist() && rImportant && !(this.isAllowlist() && important)) {
            return false;
        }

        if (important && !rImportant) {
            return true;
        }

        if (rImportant && !important) {
            return false;
        }

        if (this.isAllowlist() && !r.isAllowlist()) {
            return true;
        }

        if (r.isAllowlist() && !this.isAllowlist()) {
            return false;
        }

        const generic = this.isGeneric();
        const rGeneric = r.isGeneric();
        if (!generic && rGeneric) {
            // specific rules have priority over generic rules
            return true;
        }

        return this.priorityWeight > r.priorityWeight;
    }

    /**
     * Returns true if the rule is considered "generic"
     * "generic" means that the rule is not restricted to a limited set of domains
     * Please note that it might be forbidden on some domains, though.
     *
     * @return {boolean}
     */
    isGeneric(): boolean {
        return !this.hasPermittedDomains();
    }

    /**
     * Returns true if this rule negates the specified rule
     * Only makes sense when this rule has a `badfilter` modifier
     */
    negatesBadfilter(specifiedRule: NetworkRule): boolean {
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

        if (!utils.stringArraysEquals(this.restrictedDomains, specifiedRule.restrictedDomains)) {
            return false;
        }

        if (!utils.stringArraysHaveIntersection(this.permittedDomains, specifiedRule.permittedDomains)) {
            return false;
        }

        return true;
    }

    /**
     * Checks if this rule can be used for hosts-level blocking
     */
    isHostLevelNetworkRule(): boolean {
        if (this.hasPermittedDomains() || this.hasRestrictedDomains()) {
            return false;
        }

        if (this.permittedRequestTypes !== 0 && this.restrictedRequestTypes !== 0) {
            return false;
        }

        if (this.disabledOptions !== 0) {
            return false;
        }

        if (this.enabledOptions !== 0) {
            return ((this.enabledOptions
                    & NetworkRuleOption.OptionHostLevelRules)
                | (this.enabledOptions
                    ^ NetworkRuleOption.OptionHostLevelRules)) === NetworkRuleOption.OptionHostLevelRules;
        }

        return true;
    }

    /**
     * Enables or disables the specified option.
     *
     * @param option - option to enable or disable.
     * @param enabled - true to enable, false to disable.
     * @param skipRestrictions - skip options allowlist/blacklist restrictions
     *
     * @throws an error if the option we're trying to enable cannot be.
     * For instance, you cannot enable $elemhide for blacklist rules.
     */
    private setOptionEnabled(option: NetworkRuleOption, enabled: boolean, skipRestrictions = false): void {
        if (!skipRestrictions) {
            if (this.allowlist && (option & NetworkRuleOption.BlacklistOnly) === option) {
                throw new SyntaxError(
                    `Modifier ${NetworkRuleOption[option]} cannot be used in allowlist rule`,
                );
            }

            if (!this.allowlist && (option & NetworkRuleOption.AllowlistOnly) === option) {
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
     * @param requestType - request type.
     * @param permitted - true if it's permitted (whic)
     */
    private setRequestType(requestType: RequestType, permitted: boolean): void {
        if (permitted) {
            this.permittedRequestTypes |= requestType;
        } else {
            this.restrictedRequestTypes |= requestType;
        }
    }

    /**
     * Sets and validates exceptionally allowed domains presented in $denyallow modifier
     *
     * @param optionValue
     */
    private setDenyAllowDomains(optionValue: string): void {
        const domainModifier = new DomainModifier(optionValue, PIPE_SEPARATOR);
        if (domainModifier.restrictedDomains && domainModifier.restrictedDomains.length > 0) {
            throw new SyntaxError(
                'Invalid modifier: $denyallow domains cannot be negated',
            );
        }

        if (domainModifier.permittedDomains
            && domainModifier.permittedDomains.some((x) => x.includes(SimpleRegex.MASK_ANY_CHARACTER))) {
            throw new SyntaxError(
                'Invalid modifier: $denyallow domains wildcards are not supported',
            );
        }

        this.denyAllowDomains = domainModifier.permittedDomains;
    }

    /**
     * Loads the specified modifier:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers
     *
     * @param optionName - modifier name.
     * @param optionValue - modifier value.
     *
     * @throws an error if there is an unsupported modifier
     */
    private loadOption(optionName: string, optionValue: string): void {
        const { OPTIONS } = NetworkRule;

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

        switch (optionName) {
            // General options
            case OPTIONS.THIRD_PARTY:
            case NOT_MARK + OPTIONS.FIRST_PARTY:
                this.setOptionEnabled(NetworkRuleOption.ThirdParty, true);
                break;
            case NOT_MARK + OPTIONS.THIRD_PARTY:
            case OPTIONS.FIRST_PARTY:
                this.setOptionEnabled(NetworkRuleOption.ThirdParty, false);
                break;
            case OPTIONS.MATCH_CASE:
                this.setOptionEnabled(NetworkRuleOption.MatchCase, true);
                break;
            case NOT_MARK + OPTIONS.MATCH_CASE:
                this.setOptionEnabled(NetworkRuleOption.MatchCase, false);
                break;
            case OPTIONS.IMPORTANT:
                this.setOptionEnabled(NetworkRuleOption.Important, true);
                break;

            // $domain modifier
            case OPTIONS.DOMAIN: {
                const domainModifier = new DomainModifier(optionValue, PIPE_SEPARATOR);
                this.permittedDomains = domainModifier.permittedDomains;
                this.restrictedDomains = domainModifier.restrictedDomains;
                break;
            }
            case OPTIONS.DENYALLOW: {
                this.setDenyAllowDomains(optionValue);
                break;
            }
            // Document-level allowlist rules
            case OPTIONS.ELEMHIDE:
                this.setOptionEnabled(NetworkRuleOption.Elemhide, true);
                break;
            case OPTIONS.GENERICHIDE:
                this.setOptionEnabled(NetworkRuleOption.Generichide, true);
                break;
            case OPTIONS.SPECIFICHIDE:
                this.setOptionEnabled(NetworkRuleOption.Specifichide, true);
                break;
            case OPTIONS.GENERICBLOCK:
                this.setOptionEnabled(NetworkRuleOption.Genericblock, true);
                break;
            case OPTIONS.JSINJECT:
                this.setOptionEnabled(NetworkRuleOption.Jsinject, true);
                break;
            case OPTIONS.URLBLOCK:
                this.setOptionEnabled(NetworkRuleOption.Urlblock, true);
                break;
            case OPTIONS.CONTENT:
                this.setOptionEnabled(NetworkRuleOption.Content, true);
                break;

            // $document
            case OPTIONS.DOCUMENT:
            case OPTIONS.DOC:
                this.setOptionEnabled(NetworkRuleOption.Document, true);
                this.setRequestType(RequestType.Document, true);
                break;
            case NOT_MARK + OPTIONS.DOCUMENT:
            case NOT_MARK + OPTIONS.DOC:
                this.setOptionEnabled(NetworkRuleOption.Document, false);
                this.setRequestType(RequestType.Document, false);
                break;
            // Stealth mode $stealth
            case OPTIONS.STEALTH:
                this.setOptionEnabled(NetworkRuleOption.Stealth, true);
                break;

            // $popup blocking option
            case OPTIONS.POPUP:
                this.setOptionEnabled(NetworkRuleOption.Popup, true);
                break;

            // $empty and $mp4
            // Deprecated in favor of $redirect
            case OPTIONS.EMPTY:
                this.setOptionEnabled(NetworkRuleOption.Empty, true);
                break;
            case OPTIONS.MP4:
                this.setOptionEnabled(NetworkRuleOption.Mp4, true);
                break;

            // Content type options
            case OPTIONS.SCRIPT:
                this.setRequestType(RequestType.Script, true);
                break;
            case NOT_MARK + OPTIONS.SCRIPT:
                this.setRequestType(RequestType.Script, false);
                break;
            case OPTIONS.STYLESHEET:
                this.setRequestType(RequestType.Stylesheet, true);
                break;
            case NOT_MARK + OPTIONS.STYLESHEET:
                this.setRequestType(RequestType.Stylesheet, false);
                break;
            case OPTIONS.SUBDOCUMENT:
                this.setRequestType(RequestType.Subdocument, true);
                break;
            case NOT_MARK + OPTIONS.SUBDOCUMENT:
                this.setRequestType(RequestType.Subdocument, false);
                break;
            case OPTIONS.OBJECT:
                this.setRequestType(RequestType.Object, true);
                break;
            case NOT_MARK + OPTIONS.OBJECT:
                this.setRequestType(RequestType.Object, false);
                break;
            case OPTIONS.IMAGE:
                this.setRequestType(RequestType.Image, true);
                break;
            case NOT_MARK + OPTIONS.IMAGE:
                this.setRequestType(RequestType.Image, false);
                break;
            case OPTIONS.XMLHTTPREQUEST:
                this.setRequestType(RequestType.XmlHttpRequest, true);
                break;
            case NOT_MARK + OPTIONS.XMLHTTPREQUEST:
                this.setRequestType(RequestType.XmlHttpRequest, false);
                break;
            case OPTIONS.MEDIA:
                this.setRequestType(RequestType.Media, true);
                break;
            case NOT_MARK + OPTIONS.MEDIA:
                this.setRequestType(RequestType.Media, false);
                break;
            case OPTIONS.FONT:
                this.setRequestType(RequestType.Font, true);
                break;
            case NOT_MARK + OPTIONS.FONT:
                this.setRequestType(RequestType.Font, false);
                break;
            case OPTIONS.WEBSOCKET:
                this.setRequestType(RequestType.Websocket, true);
                break;
            case NOT_MARK + OPTIONS.WEBSOCKET:
                this.setRequestType(RequestType.Websocket, false);
                break;
            case OPTIONS.OTHER:
                this.setRequestType(RequestType.Other, true);
                break;
            case NOT_MARK + OPTIONS.OTHER:
                this.setRequestType(RequestType.Other, false);
                break;
            case OPTIONS.PING:
                this.setRequestType(RequestType.Ping, true);
                break;
            case NOT_MARK + OPTIONS.PING:
                this.setRequestType(RequestType.Ping, false);
                break;
            case OPTIONS.WEBRTC:
                this.setRequestType(RequestType.Webrtc, true);
                break;
            case NOT_MARK + OPTIONS.WEBRTC:
                this.setRequestType(RequestType.Webrtc, false);
                break;

            // Special modifiers
            case OPTIONS.BADFILTER:
                this.setOptionEnabled(NetworkRuleOption.Badfilter, true);
                break;

            case OPTIONS.CSP:
                this.setOptionEnabled(NetworkRuleOption.Csp, true);
                this.advancedModifier = new CspModifier(optionValue, this.isAllowlist());
                break;

            case OPTIONS.REPLACE:
                this.setOptionEnabled(NetworkRuleOption.Replace, true);
                this.advancedModifier = new ReplaceModifier(optionValue);
                break;

            case OPTIONS.COOKIE:
                this.setOptionEnabled(NetworkRuleOption.Cookie, true);
                this.advancedModifier = new CookieModifier(optionValue);
                break;

            case OPTIONS.REDIRECT:
                this.setOptionEnabled(NetworkRuleOption.Redirect, true);
                this.advancedModifier = new RedirectModifier(optionValue, this.ruleText, this.isAllowlist());
                break;

            case OPTIONS.REDIRECTRULE:
                this.setOptionEnabled(NetworkRuleOption.Redirect, true);
                this.advancedModifier = new RedirectModifier(optionValue, this.ruleText, this.isAllowlist(), true);
                break;

            case OPTIONS.REMOVEPARAM:
                this.setOptionEnabled(NetworkRuleOption.RemoveParam, true);
                this.advancedModifier = new RemoveParamModifier(optionValue);
                break;

            case OPTIONS.REMOVEHEADER:
                this.setOptionEnabled(NetworkRuleOption.RemoveHeader, true);
                this.advancedModifier = new RemoveHeaderModifier(optionValue, this.isAllowlist());
                break;

            // Dns modifiers
            case OPTIONS.CLIENT: {
                if (isCompatibleWith(CompatibilityTypes.extension)) {
                    throw new SyntaxError('Extension doesn\'t support $client modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Client, true);
                this.advancedModifier = new ClientModifier(optionValue);
                break;
            }

            case OPTIONS.DNSREWRITE: {
                if (isCompatibleWith(CompatibilityTypes.extension)) {
                    throw new SyntaxError('Extension doesn\'t support $dnsrewrite modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.DnsRewrite, true);
                this.advancedModifier = new DnsRewriteModifier(optionValue);
                break;
            }

            case OPTIONS.DNSTYPE: {
                if (isCompatibleWith(CompatibilityTypes.extension)) {
                    throw new SyntaxError('Extension doesn\'t support $dnstype modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.DnsType, true);
                this.advancedModifier = new DnsTypeModifier(optionValue);
                break;
            }

            case OPTIONS.CTAG: {
                if (isCompatibleWith(CompatibilityTypes.extension)) {
                    throw new SyntaxError('Extension doesn\'t support $ctag modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Ctag, true);
                this.advancedModifier = new CtagModifier(optionValue);
                break;
            }

            case OPTIONS.APP: {
                if (isCompatibleWith(CompatibilityTypes.extension)) {
                    throw new SyntaxError('Extension doesn\'t support $app modifier');
                }
                this.appModifier = new AppModifier(optionValue);
                break;
            }

            case OPTIONS.NETWORK:
                if (isCompatibleWith(CompatibilityTypes.extension)) {
                    throw new SyntaxError('Extension doesn\'t support $network modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Network, true);
                break;

            case OPTIONS.EXTENSION:
                if (isCompatibleWith(CompatibilityTypes.extension)) {
                    throw new SyntaxError('Extension doesn\'t support $extension modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Extension, true);
                break;
            case NOT_MARK + OPTIONS.EXTENSION:
                if (isCompatibleWith(CompatibilityTypes.extension)) {
                    throw new SyntaxError('Extension doesn\'t support $extension modifier');
                }
                this.setOptionEnabled(NetworkRuleOption.Extension, false);
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
     * Validates rule options
     */
    private validateOptions(): void {
        if (this.advancedModifier instanceof RemoveParamModifier) {
            this.validateRemoveParamRule();
        } else if (this.advancedModifier instanceof RemoveHeaderModifier) {
            this.validateRemoveHeaderRule();
        }
    }

    /**
     * $removeparam rules are not compatible with any other modifiers except $domain,
     * $third-party, $app, $important, $match-case and permitted content type modifiers ($script, $stylesheet, etc).
     * The rules with any other modifiers are considered invalid and will be discarded.
     */
    private validateRemoveParamRule(): void {
        if ((this.enabledOptions | NetworkRuleOption.RemoveParamCompatibleOptions)
            !== NetworkRuleOption.RemoveParamCompatibleOptions) {
            throw new SyntaxError('$removeparam rules are not compatible with some other modifiers');
        }
    }

    /**
     * $removeheader rules are not compatible with any other modifiers except $domain,
     * $third-party, $app, $important, $match-case and permitted content type modifiers ($script, $stylesheet, etc).
     * The rules with any other modifiers are considered invalid and will be discarded.
     */
    private validateRemoveHeaderRule(): void {
        if ((this.enabledOptions | NetworkRuleOption.RemoveHeaderCompatibleOptions)
            !== NetworkRuleOption.RemoveHeaderCompatibleOptions) {
            throw new SyntaxError('$removeheader rules are not compatible with some other modifiers');
        }
    }

    /**
     * parseRuleText splits the rule text into multiple parts.
     * @param ruleText - original rule text
     * @returns basic rule parts
     *
     * @throws error if the rule is empty (for instance, empty string or `@@`)
     */
    static parseRuleText(ruleText: string): BasicRuleParts {
        const ruleParts = new BasicRuleParts();
        ruleParts.allowlist = false;

        let startIndex = 0;
        if (ruleText.startsWith(NetworkRule.MASK_ALLOWLIST)) {
            ruleParts.allowlist = true;
            startIndex = NetworkRule.MASK_ALLOWLIST.length;
        }

        if (ruleText.length <= startIndex) {
            throw new SyntaxError('Rule is too short');
        }

        // Setting pattern to rule text (for the case of empty options)
        ruleParts.pattern = ruleText.substring(startIndex);

        // Avoid parsing options inside of a regex rule
        if (ruleParts.pattern.startsWith(SimpleRegex.MASK_REGEX_RULE)
            && ruleParts.pattern.endsWith(SimpleRegex.MASK_REGEX_RULE)
            && !ruleParts.pattern.includes(`${NetworkRule.OPTIONS.REPLACE}=`)
        ) {
            return ruleParts;
        }

        const removeParamIndex = ruleText.lastIndexOf(`${NetworkRule.OPTIONS.REMOVEPARAM}=`);
        const endIndex = removeParamIndex >= 0 ? removeParamIndex : ruleText.length - 2;

        let foundEscaped = false;
        for (let i = endIndex; i >= startIndex; i -= 1) {
            const c = ruleText.charAt(i);

            if (c === NetworkRule.OPTIONS_DELIMITER) {
                if (i > startIndex && ruleText.charAt(i - 1) === NetworkRule.ESCAPE_CHARACTER) {
                    foundEscaped = true;
                } else {
                    ruleParts.pattern = ruleText.substring(startIndex, i);
                    ruleParts.options = ruleText.substring(i + 1);

                    if (foundEscaped) {
                        // Find and replace escaped options delimiter
                        ruleParts.options = ruleParts.options.replace(
                            NetworkRule.RE_ESCAPED_OPTIONS_DELIMITER,
                            NetworkRule.OPTIONS_DELIMITER,
                        );
                        // Reset the regexp state
                        NetworkRule.RE_ESCAPED_OPTIONS_DELIMITER.lastIndex = 0;
                    }

                    // Options delimiter was found, exiting loop
                    break;
                }
            }
        }

        return ruleParts;
    }
}
