import isIp from 'is-ip';
import * as rule from './rule';
import { isDomainName } from '../utils/url';

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

    private readonly filterListId: number;

    private readonly hostnames: string[] = [];

    private readonly ip: string = '';

    private readonly invalid: boolean = false;

    /**
     * Constructor
     *
     * Parses the rule and creates a new HostRule instance
     *
     * @param ruleText - original rule text.
     * @param filterListId - ID of the filter list this rule belongs to.
     *
     * @throws error if it fails to parse the rule.
     */
    constructor(ruleText: string, filterListId: number) {
        this.ruleText = ruleText;
        this.filterListId = filterListId;

        const commentIndex = ruleText.indexOf('#');
        const stripped = commentIndex >= 0 ? ruleText.substring(0, commentIndex) : ruleText;

        const parts = stripped.trim().split(' ');
        if (parts.length >= 2) {
            if (!isIp(parts[0])) {
                this.invalid = true;
                return;
            }

            // eslint-disable-next-line prefer-destructuring
            this.ip = parts[0];
            this.hostnames = parts.slice(1).filter((x) => !!x);
        } else if (parts.length === 1 && isDomainName(parts[0])) {
            this.hostnames = [parts[0]];
            this.ip = '0.0.0.0';
        } else {
            this.invalid = true;
        }
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
