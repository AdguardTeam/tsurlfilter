import { type HostRule as HostRuleNode, NetworkRuleType, RuleCategory } from '@adguard/agtree';
import { defaultParserOptions, type ParserOptions, RuleParser } from '@adguard/agtree/parser';

import { FILTER_LIST_ID_NONE, type IRule, RULE_INDEX_NONE } from './rule';

/**
 * Implements a host rule.
 *
 * HostRule is a structure for simple host-level rules (i.e. /etc/hosts syntax).
 * More details: http://man7.org/linux/man-pages/man5/hosts.5.html.
 * It also supports "just domain" syntax. In this case, the IP will be set to `0.0.0.0`.
 *
 * Rules syntax looks like this.
 * ```
 * IP_address canonical_hostname [aliases...]
 * ```
 *
 * Examples:
 * `192.168.1.13 bar.mydomain.org bar` -- ipv4
 * `ff02::1 ip6-allnodes` -- ipv6
 * `::1 localhost ip6-localhost ip6-loopback` -- ipv6 aliases
 * `example.org` -- "just domain" syntax.
 *
 * @returns True if this rule can be used on the specified hostname.
 */
export class HostRule implements IRule {
    /**
     * Parser options for host rules.
     */
    private static readonly PARSER_OPTIONS: ParserOptions = {
        ...defaultParserOptions,
        parseHostRules: true,
        isLocIncluded: false,
    };

    /**
     * Rule index.
     */
    private readonly ruleIndex: number;

    /**
     * Filter list ID.
     */
    private readonly filterListId: number;

    /**
     * Rule text.
     */
    private readonly ruleText?: string;

    /**
     * Hostnames.
     */
    private readonly hostnames: string[] = [];

    /**
     * IP address.
     */
    private readonly ip: string = '';

    /**
     * Invalid flag.
     */
    private readonly invalid: boolean = false;

    /**
     * Constructor.
     *
     * Parses the rule and creates a new HostRule instance.
     *
     * @param ruleText Rule text.
     * @param filterListId ID of the filter list this rule belongs to.
     * @param ruleIndex Index of the rule.
     * @param node Optional pre-parsed host rule node to avoid re-parsing.
     *
     * @throws Error if it fails to parse the rule or if the rule is not a host rule.
     */
    constructor(
        ruleText: string,
        filterListId: number = FILTER_LIST_ID_NONE,
        ruleIndex: number = RULE_INDEX_NONE,
        node?: HostRuleNode,
    ) {
        this.ruleIndex = ruleIndex;
        this.filterListId = filterListId;

        // Store rule text in the instance if the rule is not indexed in FiltersStorage.
        // When filterListId or ruleIndex is NONE, the rule text cannot be retrieved
        // from the engine and must be available via getText().
        if (filterListId === FILTER_LIST_ID_NONE || ruleIndex === RULE_INDEX_NONE) {
            this.ruleText = ruleText;
        }

        // Use provided node or parse the rule text
        let parsedNode: HostRuleNode;
        if (node) {
            parsedNode = node;
        } else {
            const parsed = RuleParser.parse(ruleText, HostRule.PARSER_OPTIONS);

            // Validate that we got a valid host rule
            if (parsed.category !== RuleCategory.Network || parsed.type !== NetworkRuleType.HostRule) {
                throw new SyntaxError(`Expected host rule but got ${parsed.category}: ${ruleText}`);
            }

            parsedNode = parsed as HostRuleNode;
        }

        this.ip = parsedNode.ip.value;

        if (parsedNode.hostnames.children.length === 0) {
            this.invalid = true;
            return;
        }

        this.hostnames = parsedNode.hostnames.children.map((hostname: { value: string }) => hostname.value);
    }

    /**
     * Match returns true if this rule can be used on the specified hostname.
     *
     * @param hostname Hostname to check.
     *
     * @returns True if the hostname matches one of the hostnames in the rule.
     */
    public match(hostname: string): boolean {
        return this.hostnames.includes(hostname);
    }

    /**
     * Returns list id.
     *
     * @returns The filter list ID.
     */
    public getFilterListId(): number {
        return this.filterListId;
    }

    /**
     * Returns rule index.
     *
     * @returns The rule index.
     */
    public getIndex(): number {
        return this.ruleIndex;
    }

    /**
     * Returns the rule text.
     *
     * @returns Rule text.
     */
    public getText(): string | undefined {
        return this.ruleText;
    }

    /**
     * Returns ip address.
     *
     * @returns IP address.
     */
    public getIp(): string {
        return this.ip;
    }

    /**
     * Returns hostnames.
     *
     * @returns Array of hostnames.
     */
    public getHostnames(): string[] {
        return this.hostnames;
    }

    /**
     * Checks if the rule is invalid.
     *
     * @returns True if the rule is invalid.
     */
    public isInvalid(): boolean {
        return this.invalid;
    }
}
