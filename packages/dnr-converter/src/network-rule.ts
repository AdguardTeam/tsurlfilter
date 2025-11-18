import {
    type AnyRule,
    type NetworkRule as NetworkRuleNode,
    NetworkRuleType,
    RuleCategory,
} from '@adguard/agtree';
import { RuleConverter } from '@adguard/agtree/converter';
import { RuleGenerator } from '@adguard/agtree/generator';

import { MASK_REGEX_RULE } from './constants';
import { type RequestMethod, type ResourceType } from './declarative-rule';
import { getErrorMessage } from './utils/error';
import { fastHash, fastHash31, hasSpaces } from './utils/string';

/**
 * NetworkRuleOption is the enumeration of various rule options.
 * In order to save memory, we store some options as a flag.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rule-modifiers}
 *
 * FIXME: Maybe we can move this to agtree? Because now it duplicated with tsurlfilter (AG-47697).
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
 * Basic network rule representation used in DNR converter.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
 *
 * FIXME: We should validate rule when parsing it here (look for `network-rule-validator.ts`) (AG-47697).
 */
export class NetworkRule {
    /**
     * Parses network rules from the given rule node.
     *
     * @param filterListId Filter list ID.
     * @param index Rule index.
     * @param node Rule node.
     *
     * @returns Array of {@link NetworkRule} parsed from `node`.
     *
     * @throws `Error` when conversion to AG syntax fails.
     * @throws `SyntaxError` when the rule has spaces in pattern or when its too general.
     */
    public static parseFromNode(
        filterListId: number,
        index: number,
        node: AnyRule,
    ): NetworkRule[] {
        // Converts a raw string rule to AG syntax (apply aliases, etc.)
        let rulesConvertedToAG: AnyRule[];
        try {
            const conversionResult = RuleConverter.convertToAdg(node);
            if (conversionResult.isConverted) {
                rulesConvertedToAG = conversionResult.result;
            } else {
                rulesConvertedToAG = [node];
            }
        } catch (e: unknown) {
            throw new Error(`Unknown error during conversion rule to AG syntax: ${getErrorMessage(e)}`);
        }

        const networkRules: NetworkRule[] = [];
        for (let i = 0; i < rulesConvertedToAG.length; i += 1) {
            const ruleNode = rulesConvertedToAG[i];

            // skip non-network rules and host network rules
            if (
                ruleNode.category !== RuleCategory.Network
                || ruleNode.type !== NetworkRuleType.NetworkRule
            ) {
                continue;
            }

            try {
                const rule = new NetworkRule(filterListId, index, ruleNode);
                networkRules.push(rule);
            } catch (e: unknown) {
                let msg = `"${getErrorMessage(e)}" in the rule: `;

                try {
                    msg += `"${RuleGenerator.generate(node)}"`;
                } catch (generateError: unknown) {
                    msg += `"${JSON.stringify(node)}" (generate error: ${getErrorMessage(generateError)})`;
                }

                throw new Error(msg);
            }
        }

        return networkRules;
    }

    /**
     * Checks if a network rule is too general.
     *
     * @param node AST node of the network rule.
     *
     * @returns True if the rule is too general.
     */
    private static isTooGeneral(node: NetworkRuleNode): boolean {
        return !(node.modifiers?.children?.length) && node.pattern.value.length < 4;
    }

    /**
     * Filter list ID.
     */
    private readonly filterListId: number;

    /**
     * Rule index.
     */
    private readonly index: number;

    /**
     * Rule node.
     */
    private readonly node: NetworkRuleNode;

    /**
     * Rule pattern.
     */
    private readonly pattern: string;

    /**
     * Allowlist flag.
     */
    private readonly allowlist: boolean;

    /**
     * Rule's hash created with {@link fastHash}. Needed to quickly compare
     * two different network rules with the same pattern part for future
     * checking of `$badfilter` application from one of them to another.
     *
     * Hash is create only from `node.pattern` part of the rule.
     */
    private readonly hash: number;

    /**
     * Rule priority, which is needed when the `declarativeNetRequest`
     * has to choose between several rules matching the query.
     * This value is calculated based on the rule modifiers enabled
     * or disabled and rounded up to the smallest integer greater
     * than or equal to the calculated in the {@link calculatePriority}.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-1
     *
     * FIXME: Implement priority calculation (AG-47697).
     */
    private priority = 1;

    /**
     * Constructor of {@link NetworkRuleNode}.
     *
     * @param filterListId Filter list ID.
     * @param index Rule index.
     * @param node Rule node.
     *
     * @throws `SyntaxError` when the rule has spaces in pattern or when its too general.
     */
    private constructor(
        filterListId: number,
        index: number,
        node: NetworkRuleNode,
    ) {
        const pattern = node.pattern.value;
        if (pattern && hasSpaces(pattern)) {
            throw new SyntaxError('Rule has spaces, seems to be an host rule');
        }

        if (NetworkRule.isTooGeneral(node)) {
            throw new SyntaxError(`Rule is too general: ${RuleGenerator.generate(node)}`);
        }

        this.filterListId = filterListId;
        this.index = index;
        this.node = node;
        this.allowlist = node.exception;
        this.pattern = pattern;

        // TODO: Improve this part: maybe use trie-lookup-table and .getShortcut()?
        // or use agtree to collect pattern + all enabled network options without values
        this.hash = fastHash(this.pattern);
    }

    /**
     * Retrieves rule filter list ID.
     *
     * @returns Rule filter list ID.
     */
    public getFilterListId(): number {
        return this.filterListId;
    }

    /**
     * Retrieves rule index.
     *
     * @returns Rule index.
     */
    public getIndex(): number {
        return this.index;
    }

    /**
     * Retrieves rule node.
     *
     * @returns Rule node.
     */
    public getNode(): NetworkRuleNode {
        return this.node;
    }

    /**
     * Retrieves rule pattern.
     *
     * @returns Rule pattern.
     */
    public getPattern(): string {
        return this.pattern;
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
     * Retrieves rule hash.
     *
     * @returns Rule hash.
     */
    public getHash(): number {
        return this.hash;
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
    public getPriority(): number {
        return this.priority;
    }

    /**
     * Checks if the rule completely disables filtering.
     *
     * @returns `true` if the rule completely disables filtering, `false` otherwise.
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
     * Checks if the rule pattern is a regular expression.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#regexp-support}
     *
     * @returns `true` if the rule pattern is a regular expression, `false` otherwise.
     */
    public isRegexRule(): boolean {
        return (
            this.pattern.startsWith(MASK_REGEX_RULE)
            && this.pattern.endsWith(MASK_REGEX_RULE)
        );
    }

    /**
     * Checks if the specified rule option is enabled.
     *
     * @param option Rule option to check.
     *
     * @returns `true` if the specified option is enabled, `false` otherwise.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public isOptionEnabled(option: NetworkRuleOption): boolean {
        return !!option;
    }

    /**
     * Checks if the specified rule option is disabled.
     *
     * @param option Rule option to check.
     *
     * @returns `true` if the specified option is disabled, `false` otherwise.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public isOptionDisabled(option: NetworkRuleOption): boolean {
        return !option;
    }

    /**
     * Gets list of permitted domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#domain-modifier}
     *
     * @returns List of permitted domains or null if none.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getPermittedDomains(): string[] | null {
        return null;
    }

    /**
     * Gets list of restricted domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#domain-modifier}
     *
     * @returns List of restricted domains or null if none.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getRestrictedDomains(): string[] | null {
        return null;
    }

    /**
     * Get list of permitted `$to` domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#to-modifier}
     *
     * @returns List of permitted `$to` domains or `null` if none.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getPermittedToDomains(): string[] | null {
        return null;
    }

    /**
     * Get list of restricted `$to` domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#to-modifier}
     *
     * @returns List of restricted `$to` domains or `null` if none.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getRestrictedToDomains(): string[] | null {
        return null;
    }

    /**
     * Gets list of denyAllow domains.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#denyallow-modifier}
     *
     * @returns List of denyAllow domains or null if none.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getDenyAllowDomains(): string[] | null {
        return null;
    }

    /**
     * Gets list of {@link ResourceType} the rule applies to.
     *
     * @returns List of {@link ResourceType}.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getPermittedResourceTypes(): ResourceType[] {
        return [];
    }

    /**
     * Gets list of {@link ResourceType} the rule not applies to.
     *
     * @returns List of {@link ResourceType}.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getRestrictedResourceTypes(): ResourceType[] {
        return [];
    }

    /**
     * Gets list of restricted {@link RequestMethod}.
     *
     * @see {@link https://kb.adguard.com/general/how-to-create-your-own-ad-filters#method-modifier}
     *
     * @returns List of restricted {@link RequestMethod} or `null` if none.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getPermittedMethods(): RequestMethod[] | null {
        return null;
    }

    /**
     * Gets list of permitted methods.
     *
     * @see {@link https://kb.adguard.com/general/how-to-create-your-own-ad-filters#method-modifier}
     *
     * @returns List of permitted methods or null if none.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getRestrictedMethods(): RequestMethod[] | null {
        return null;
    }

    /**
     * Returns modifier value.
     *
     * @returns Modifier value.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getAdvancedModifierValue(): string | null {
        return null;
    }

    /**
     * Returns effective header name to be removed.
     *
     * @param isRequestHeaders Flag to determine that the header is a *request* header, otherwise *response* header.
     *
     * @returns The applicable header name if valid, otherwise `null`.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public getApplicableHeaderName(isRequestHeaders: boolean): string | null {
        return isRequestHeaders ? 'X-Example-Header' : null;
    }

    /**
     * Gets hash for whole text of the rule and return it. Needed
     * to keep ID of the rule in the filter the same between several runs.
     * Thus is needed to be able to use "skip review" option in CWS.
     *
     * @param salt Salt for hash, needed to make hash unique ID if the rule
     * is the same (e.g. for different filters). To keep check simple,
     * we just use numbers.
     *
     * @returns Hash for pattern part of the network rule.
     */
    public getRuleTextHash(salt?: number): number {
        const textOfNetworkRule = RuleGenerator.generate(this.node);

        // Append a null-char to not collide with legitimate rule text.
        const trialText = salt === undefined ? textOfNetworkRule : `${textOfNetworkRule}\0${salt}`;

        return fastHash31(trialText);
    }

    /**
     * Returns `true` if this rule negates the `ruleToCheck`.
     * Only makes sense when this rule has a `$badfilter` modifier.
     *
     * @param ruleToCheck Rule to check.
     *
     * @returns `true` if this rule negates the specified rule, `false` otherwise.
     *
     * FIXME: Replace with actual implementation (AG-47697).
     */
    // eslint-disable-next-line class-methods-use-this
    public negatesBadfilter(ruleToCheck: NetworkRule): boolean {
        return !!ruleToCheck;
    }
}
