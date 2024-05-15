import { type HostRule as HostRuleNode, HostRuleParser, defaultParserOptions } from '@adguard/agtree';

import * as rule from './rule';
import { isString } from '../utils/string-utils';

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
    private readonly ruleText: string;

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
    constructor(inputRule: string | HostRuleNode, filterListId: number, ruleIndex = rule.RULE_INDEX_NONE) {
        this.ruleIndex = ruleIndex;
        this.filterListId = filterListId;

        let node: HostRuleNode;
        if (isString(inputRule)) {
            try {
                node = HostRuleParser.parse(inputRule.trim(), {
                    ...defaultParserOptions,
                    isLocIncluded: false,
                    includeRaws: true,
                });
            } catch (e) {
                this.invalid = true;
                this.ruleText = inputRule;
                return;
            }
        } else {
            node = inputRule;
        }

        // FIXME (David, v2.3): Remove storing the rule text
        this.ruleText = node.raws!.text!;

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
     * Return rule text
     */
    getText(): string {
        return this.ruleText;
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
