// eslint-disable-next-line max-classes-per-file
import * as rule from './rule';
import { SimpleRegex } from './simple-regex';
import { Request, RequestType } from '../request';
import { DomainModifier } from '../modifiers/domain-modifier';
import * as utils from '../utils/utils';
import { IAdvancedModifier } from '../modifiers/advanced-modifier';
import { ReplaceModifier } from '../modifiers/replace-modifier';
import { CspModifier } from '../modifiers/csp-modifier';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { RedirectModifier } from '../modifiers/redirect-modifier';
import { RemoveParamModifier } from '../modifiers/remove-param-modifier';
import { CompatibilityTypes, isCompatibleWith } from '../configuration';
import { AppModifier, IAppModifier } from '../modifiers/app-modifier';

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

    // Whitelist rules modifiers
    // Each of them can disable part of the functionality

    /** $elemhide modifier */
    Elemhide = 1 << 3,
    /** $generichide modifier */
    Generichide = 1 << 4,
    /** $genericblock modifier */
    Genericblock = 1 << 5,
    /** $jsinject modifier */
    Jsinject = 1 << 6,
    /** $urlblock modifier */
    Urlblock = 1 << 7,
    /** $content modifier */
    Content = 1 << 8,
    /** $extension modifier */
    Extension = 1 << 9,
    /** $stealth modifier */
    Stealth = 1 << 10,

    // Content modifying
    // $empty modifier
    Empty = 1 << 11,
    // $mp4 modifier
    Mp4 = 1 << 12,

    // Other modifiers

    /** $popup modifier */
    Popup = 1 << 13,
    /** $csp modifier */
    Csp = 1 << 14,
    /** $replace modifier */
    Replace = 1 << 15,
    /** $cookie modifier */
    Cookie = 1 << 16,
    /** $redirect modifier */
    Redirect = 1 << 17,
    /** $badfilter modifier */
    Badfilter = 1 << 18,
    /** $removeparam modifier */
    RemoveParam = 1 << 19,

    // Compatibility dependent
    /** $network modifier */
    Network = 1 << 20,

    // Groups (for validation)

    /** Blacklist-only modifiers */
    BlacklistOnly = Empty | Mp4,

    /** Whitelist-only modifiers */
    WhitelistOnly = Elemhide | Genericblock | Generichide | Jsinject | Urlblock | Content | Extension | Stealth,

    /** Options supported by host-level network rules * */
    OptionHostLevelRulesOnly = Important | Badfilter
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
     * Indicates if rule is "whitelist" (e.g. it should unblock requests, not block them).
     */
    public whitelist: boolean | undefined;
}

/**
 * Basic network filtering rule.
 * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules
 */
export class NetworkRule implements rule.IRule {
    private readonly ruleText: string;

    private readonly filterListId: number;

    private readonly whitelist: boolean;

    private readonly pattern: string;

    private readonly shortcut: string;

    /** Regular expression compiled from the pattern. */
    private regex: RegExp | undefined;

    /** Marks the rule as invalid. Match will always return false in this case. */
    private invalid = false;

    private permittedDomains: string[] | null = null;

    private restrictedDomains: string[] | null = null;

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
     * Separates the rule pattern from the list of modifiers.
     *
     * ```
     * rule = ["@@"] pattern [ "$" modifiers ]
     * modifiers = [modifier0, modifier1[, ...[, modifierN]]]
     * ```
     */
    public static readonly OPTIONS_DELIMITER = '$';

    /**
     * This character is used to escape special characters in modifiers values
     */
    private static ESCAPE_CHARACTER = '\\';

    // eslint-disable-next-line max-len
    private static RE_ESCAPED_OPTIONS_DELIMITER = new RegExp(`${NetworkRule.ESCAPE_CHARACTER}${NetworkRule.OPTIONS_DELIMITER}`, 'g');

    /**
     * A marker that is used in rules of exception.
     * To turn off filtering for a request, start your rule with this marker.
     */
    public static readonly MASK_ALLOWLIST = '@@';

    /**
     * Mark that negates options
     */
    public static readonly NOT_MARK = '~';

    /**
     * Rule options
     */
    public static readonly OPTIONS = {
        THIRD_PARTY: 'third-party',
        FIRST_PARTY: 'first-party',
        MATCH_CASE: 'match-case',
        IMPORTANT: 'important',
        DOMAIN: 'domain',
        ELEMHIDE: 'elemhide',
        GENERICHIDE: 'generichide',
        GENERICBLOCK: 'genericblock',
        JSINJECT: 'jsinject',
        URLBLOCK: 'urlblock',
        CONTENT: 'content',
        DOCUMENT: 'document',
        STEALTH: 'stealth',
        POPUP: 'popup',
        EMPTY: 'empty',
        MP4: 'mp4',
        SCRIPT: 'script',
        STYLESHEET: 'stylesheet',
        SUBDOCUMENT: 'subdocument',
        OBJECT: 'object',
        IMAGE: 'image',
        XMLHTTPREQUEST: 'xmlhttprequest',
        MEDIA: 'media',
        FONT: 'font',
        WEBSOCKET: 'websocket',
        OTHER: 'other',
        PING: 'ping',
        WEBRTC: 'webrtc',
        BADFILTER: 'badfilter',
        CSP: 'csp',
        REPLACE: 'replace',
        COOKIE: 'cookie',
        REDIRECT: 'redirect',
        REMOVEPARAM: 'removeparam',
        APP: 'app',
        NETWORK: 'network',
        EXTENSION: 'extension',
    };

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
        return this.pattern;
    }

    /**
     * Returns `true` if the rule is "whitelist", e.g. if it disables other
     * rules when the pattern matches the request.
     */
    isWhitelist(): boolean {
        return this.whitelist;
    }

    /**
     * Checks if the rule is a document-level whitelist rule
     * This means that the rule is supposed to disable or modify blocking
     * of the page subrequests.
     * For instance, `@@||example.org^$urlblock` unblocks all sub-requests.
     */
    isDocumentLevelWhitelistRule(): boolean {
        if (!this.isWhitelist()) {
            return false;
        }

        return this.isOptionEnabled(NetworkRuleOption.Urlblock)
            || this.isOptionEnabled(NetworkRuleOption.Elemhide)
            || this.isOptionEnabled(NetworkRuleOption.Jsinject)
            || this.isOptionEnabled(NetworkRuleOption.Content);
    }

    /**
     * Checks if the rule is a document whitelist rule
     * For instance,
     * "@@||example.org^$document"
     * completely disables filtering on all pages at example.com and all subdomains.
     */
    isDocumentWhitelistRule(): boolean {
        if (!this.isWhitelist()) {
            return false;
        }

        return this.isOptionEnabled(NetworkRuleOption.Urlblock)
            && this.isOptionEnabled(NetworkRuleOption.Elemhide)
            && this.isOptionEnabled(NetworkRuleOption.Jsinject)
            && this.isOptionEnabled(NetworkRuleOption.Content);
    }

    /**
     * The longest part of pattern without any special characters.
     * It is used to improve the matching performance.
     */
    getShortcut(): string {
        return this.shortcut;
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
            this.pattern.startsWith(SimpleRegex.MASK_REGEX_RULE) && this.pattern.endsWith(SimpleRegex.MASK_REGEX_RULE)
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
     */
    match(request: Request): boolean {
        if (!this.matchShortcut(request)) {
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

        if (!this.matchDomain(request.sourceHostname || '')) {
            /**
             * We make an exception for HTML documents and also check $domain against the request URL hostname.
             * We do this in order to simplify creating rules like this: $cookie,domain=example.org|example.com
             * as otherwise, you'd need to create an additional rule for each of these domains.
             */
            if (request.requestType !== RequestType.Document && request.requestType !== RequestType.Subdocument) {
                return false;
            }

            /**
             * Skipping patterns with domain specified
             * https://github.com/AdguardTeam/CoreLibs/issues/1354#issuecomment-704226271
             */
            if (this.isPatternDomainSpecific()) {
                return false;
            }

            if (!this.matchDomain(request.hostname || '')) {
                return false;
            }
        }

        return this.matchPattern(request);
    }

    /**
     * matchShortcut simply checks if shortcut is a substring of the URL.
     * @param request - request to check.
     */
    private matchShortcut(request: Request): boolean {
        return request.urlLowercase.includes(this.shortcut);
    }

    /**
     * matchDomain checks if the filtering rule is allowed on this domain.
     * @param domain - domain to check.
     */
    private matchDomain(domain: string): boolean {
        if (!this.permittedDomains && !this.restrictedDomains) {
            return true;
        }

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
    private matchRequestType(requestType: RequestType): boolean {
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
     * matchPattern uses the regex pattern to match the request URL
     * @param request - request to check.
     */
    private matchPattern(request: Request): boolean {
        if (!this.regex) {
            if (this.invalid) {
                return false;
            }

            const regex = SimpleRegex.patternToRegexp(this.pattern);
            try {
                let flags = 'i';
                if (this.isOptionEnabled(NetworkRuleOption.MatchCase)) {
                    flags = '';
                }
                this.regex = new RegExp(regex, flags);
            } catch (e) {
                this.invalid = true;
            }
        }

        if (this.regex) {
            if (this.shouldMatchHostname(request)) {
                return this.regex.test(request.hostname);
            }

            return this.regex.test(request.url);
        }

        return false;
    }

    /**
     * Checks if we should match hostnames and not the URL
     * this is important for the cases when we use urlfilter for DNS-level blocking
     * Note, that even though we may work on a DNS-level, we should still sometimes match full URL instead
     *
     * @param request
     */
    private shouldMatchHostname(request: Request): boolean {
        if (!request.isHostnameRequest) {
            return false;
        }

        return !this.isPatternDomainSpecific();
    }

    /**
     * In case pattern starts with the following it targets some specific domain
     */
    private isPatternDomainSpecific(): boolean {
        return this.pattern.startsWith(SimpleRegex.MASK_START_URL)
            || this.pattern.startsWith('http://')
            || this.pattern.startsWith('https:/')
            || this.pattern.startsWith('://');
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
        this.pattern = ruleParts.pattern!;
        this.whitelist = !!ruleParts.whitelist;

        if (this.pattern && NetworkRule.hasSpaces(this.pattern)) {
            throw new SyntaxError('Rule has spaces, seems to be an host rule');
        }

        if (ruleParts.options) {
            this.loadOptions(ruleParts.options);
        }

        if (
            this.pattern === SimpleRegex.MASK_START_URL
            || this.pattern === SimpleRegex.MASK_ANY_CHARACTER
            || this.pattern === ''
            || this.pattern.length < 3
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

        this.shortcut = SimpleRegex.extractShortcut(this.pattern);
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

        // Rules of these types can be applied to documents only
        // $jsinject, $elemhide, $urlblock, $genericblock, $generichide and $content for whitelist rules.
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
     * whitelist + $important > $important > whitelist > basic rules
     */
    isHigherPriority(r: NetworkRule): boolean {
        const important = this.isOptionEnabled(NetworkRuleOption.Important);
        const rImportant = r.isOptionEnabled(NetworkRuleOption.Important);
        if (this.isWhitelist() && important && !(r.isWhitelist() && rImportant)) {
            return true;
        }

        if (r.isWhitelist() && rImportant && !(this.isWhitelist() && important)) {
            return false;
        }

        if (important && !rImportant) {
            return true;
        }

        if (rImportant && !important) {
            return false;
        }

        if (this.isWhitelist() && !r.isWhitelist()) {
            return true;
        }

        if (r.isWhitelist() && !this.isWhitelist()) {
            return false;
        }

        const redirect = this.isOptionEnabled(NetworkRuleOption.Redirect);
        const rRedirect = r.isOptionEnabled(NetworkRuleOption.Redirect);
        if (redirect && !rRedirect) {
            // $redirect rules have "slightly" higher priority than regular basic rules
            return true;
        }

        const generic = this.isGeneric();
        const rGeneric = r.isGeneric();
        if (!generic && rGeneric) {
            // specific rules have priority over generic rules
            return true;
        }

        // More specific rules (i.e. with more modifiers) have higher priority
        let count = utils.countElementsInEnum(this.enabledOptions, NetworkRuleOption)
            + utils.countElementsInEnum(this.disabledOptions, NetworkRuleOption)
            + utils.countElementsInEnum(this.permittedRequestTypes, RequestType)
            + utils.countElementsInEnum(this.restrictedRequestTypes, RequestType);
        if (this.hasPermittedDomains() || this.hasRestrictedDomains()) {
            count += 1;
        }

        let rCount = utils.countElementsInEnum(r.enabledOptions, NetworkRuleOption)
            + utils.countElementsInEnum(r.disabledOptions, NetworkRuleOption)
            + utils.countElementsInEnum(r.permittedRequestTypes, RequestType)
            + utils.countElementsInEnum(r.restrictedRequestTypes, RequestType);
        if (r.hasPermittedDomains() || r.hasRestrictedDomains()) {
            rCount += 1;
        }

        return count > rCount;
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

        if (this.whitelist !== specifiedRule.whitelist) {
            return false;
        }

        if (this.pattern !== specifiedRule.pattern) {
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
                    & NetworkRuleOption.OptionHostLevelRulesOnly)
                | (this.enabledOptions
                    ^ NetworkRuleOption.OptionHostLevelRulesOnly)) === NetworkRuleOption.OptionHostLevelRulesOnly;
        }

        return true;
    }

    /**
     * Enables or disables the specified option.
     *
     * @param option - option to enable or disable.
     * @param enabled - true to enable, false to disable.
     * @param skipRestrictions - skip options whitelist/blacklist restrictions
     *
     * @throws an error if the option we're trying to enable cannot be.
     * For instance, you cannot enable $elemhide for blacklist rules.
     */
    private setOptionEnabled(option: NetworkRuleOption, enabled: boolean, skipRestrictions = false): void {
        if (!skipRestrictions) {
            if (this.whitelist && (option & NetworkRuleOption.BlacklistOnly) === option) {
                throw new SyntaxError(
                    `Modifier ${NetworkRuleOption[option]} cannot be used in whitelist rule`,
                );
            }

            if (!this.whitelist && (option & NetworkRuleOption.WhitelistOnly) === option) {
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
     * Loads the specified modifier:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers
     *
     * @param optionName - modifier name.
     * @param optionValue - modifier value.
     *
     * @throws an error if there is an unsupported modifier
     */
    private loadOption(optionName: string, optionValue: string): void {
        const { OPTIONS, NOT_MARK } = NetworkRule;

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
                const domainModifier = new DomainModifier(optionValue, '|');
                this.permittedDomains = domainModifier.permittedDomains;
                this.restrictedDomains = domainModifier.restrictedDomains;
                break;
            }
            // Document-level whitelist rules
            case OPTIONS.ELEMHIDE:
                this.setOptionEnabled(NetworkRuleOption.Elemhide, true);
                break;
            case OPTIONS.GENERICHIDE:
                this.setOptionEnabled(NetworkRuleOption.Generichide, true);
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
                this.setOptionEnabled(NetworkRuleOption.Elemhide, true, true);
                this.setOptionEnabled(NetworkRuleOption.Jsinject, true, true);
                this.setOptionEnabled(NetworkRuleOption.Urlblock, true, true);
                this.setOptionEnabled(NetworkRuleOption.Content, true, true);
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
                this.advancedModifier = new CspModifier(optionValue, this.isWhitelist());
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
                this.advancedModifier = new RedirectModifier(optionValue, this.ruleText);
                break;

            case OPTIONS.REMOVEPARAM:
                this.setOptionEnabled(NetworkRuleOption.RemoveParam, true);
                this.advancedModifier = new RemoveParamModifier(optionValue, this.isWhitelist());
                break;

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
     * parseRuleText splits the rule text into multiple parts.
     * @param ruleText - original rule text
     * @returns basic rule parts
     *
     * @throws error if the rule is empty (for instance, empty string or `@@`)
     */
    static parseRuleText(ruleText: string): BasicRuleParts {
        const ruleParts = new BasicRuleParts();
        ruleParts.whitelist = false;

        let startIndex = 0;
        if (ruleText.startsWith(NetworkRule.MASK_ALLOWLIST)) {
            ruleParts.whitelist = true;
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

        let foundEscaped = false;
        for (let i = ruleText.length - 2; i >= startIndex; i -= 1) {
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
