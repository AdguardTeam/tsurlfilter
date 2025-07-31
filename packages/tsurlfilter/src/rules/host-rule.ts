import { type HostRule as HostRuleNode } from '@adguard/agtree';

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
    private readonly ruleIndex: number;

    private readonly filterListId: number;

    private readonly hostnames: string[] = [];

    private readonly ip: string = '';

    private readonly invalid: boolean = false;

    /**
     * Constructor.
     *
     * Parses the rule and creates a new HostRule instance.
     *
     * @param node Original rule text.
     * @param filterListId ID of the filter list this rule belongs to.
     * @param ruleIndex Index of the rule.
     *
     * @throws Error if it fails to parse the rule.
     */
    constructor(node: HostRuleNode, filterListId: number, ruleIndex = RULE_INDEX_NONE) {
        this.ruleIndex = ruleIndex;
        this.filterListId = filterListId;

        this.ip = node.ip.value;

        if (node.hostnames.children.length === 0) {
            this.invalid = true;
            return;
        }

        this.hostnames = node.hostnames.children.map((hostname) => hostname.value);
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
