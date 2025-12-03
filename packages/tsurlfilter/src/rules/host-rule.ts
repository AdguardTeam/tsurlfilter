import { type HostRule as HostRuleNode, NetworkRuleType, RuleCategory } from '@adguard/agtree';
import { defaultParserOptions, RuleParser } from '@adguard/agtree/parser';

import { type IRule, RULE_INDEX_NONE } from './rule';

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
    private readonly ruleText: string;

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
     * @param ruleText Rule text to parse.
     * @param filterListId ID of the filter list this rule belongs to.
     * @param ruleIndex Index of the rule.
     *
     * @throws Error if it fails to parse the rule or if the rule is not a host rule.
     */
    constructor(ruleText: string, filterListId: number, ruleIndex = RULE_INDEX_NONE) {
        this.ruleIndex = ruleIndex;
        this.filterListId = filterListId;
        this.ruleText = ruleText;

        // Parse the rule text with host rules enabled
        const parsedNode = RuleParser.parse(ruleText, {
            ...defaultParserOptions,
            parseHostRules: true,
        });

        // Validate that we got a valid host rule
        if (parsedNode.category !== RuleCategory.Network || parsedNode.type !== NetworkRuleType.HostRule) {
            throw new SyntaxError(`Expected host rule but got ${parsedNode.category}: ${ruleText}`);
        }

        const node = parsedNode as HostRuleNode;

        this.ip = node.ip.value;

        if (node.hostnames.children.length === 0) {
            this.invalid = true;
            return;
        }

        this.hostnames = node.hostnames.children.map((hostname: { value: string }) => hostname.value);
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
    public getText(): string {
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
