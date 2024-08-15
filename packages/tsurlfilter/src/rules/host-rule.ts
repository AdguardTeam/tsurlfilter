import { type HostRule as HostRuleNode } from '@adguard/agtree';

import * as rule from './rule';

/**
 * Implements a host rule.
 *
 * HostRule is a structure for simple host-level rules (i.e. /etc/hosts syntax).
 * http://man7.org/linux/man-pages/man5/hosts.5.html
 * It also supports "just domain" syntax. In this case, the IP will be set to 0.0.0.0.
 *
 * Rules syntax looks like this:
 * ```
 * IP_address canonical_hostname [aliases...]
 * ```
 *
 * Examples:
 * * `192.168.1.13 bar.mydomain.org bar` -- ipv4
 * * `ff02::1 ip6-allnodes` -- ipv6
 * * `::1 localhost ip6-localhost ip6-loopback` -- ipv6 aliases
 * * `example.org` -- "just domain" syntax
 */
export class HostRule implements rule.IRule {
    private readonly ruleIndex: number;

    private readonly filterListId: number;

    private readonly hostnames: string[] = [];

    private readonly ip: string = '';

    private readonly invalid: boolean = false;

    /**
     * Constructor
     *
     * Parses the rule and creates a new HostRule instance
     *
     * @param inputRule - original rule text.
     * @param filterListId - ID of the filter list this rule belongs to.
     *
     * @throws error if it fails to parse the rule.
     */
    constructor(node: HostRuleNode, filterListId: number, ruleIndex = rule.RULE_INDEX_NONE) {
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
     * @param hostname - hostname to check
     */
    match(hostname: string): boolean {
        return this.hostnames.includes(hostname);
    }

    /**
     * Returns list id
     */
    getFilterListId(): number {
        return this.filterListId;
    }

    /**
     * Returns rule index
     */
    getIndex(): number {
        return this.ruleIndex;
    }

    /**
     * Returns ip address
     */
    getIp(): string {
        return this.ip;
    }

    /**
     * Returns hostnames
     */
    getHostnames(): string[] {
        return this.hostnames;
    }

    /**
     * Is invalid rule
     */
    isInvalid(): boolean {
        return this.invalid;
    }
}
