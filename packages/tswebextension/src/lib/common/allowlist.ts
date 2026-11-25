import { RuleGenerator } from '@adguard/agtree';
import {
    createAllowlistRuleNode,
    type NetworkRule,
    normalizeAllowlistDomain,
    RuleFactory,
} from '@adguard/tsurlfilter';

import { AllowlistPattern } from './allowlist-pattern';
import { type Configuration } from './configuration';
import { ALLOWLIST_FILTER_ID } from './constants';

/**
 * Configuration for the allowlist.
 */
export type AllowlistConfiguration = Pick<Configuration, 'allowlist' | 'settings'>;

/**
 * Hosts selected by the inverted allowlist, in a form that can be serialized into the canvas
 * protection policy and compared against a hostname.
 */
export interface InvertedAllowlistMatch {
    /**
     * Whether every host is selected, as with the full wildcard entry `*.*`.
     */
    readonly all: boolean;

    /**
     * Hosts selected as written or with a `www.` prefix.
     */
    readonly hosts: readonly string[];

    /**
     * Domains selected together with all their subdomains.
     */
    readonly domains: readonly string[];

    /**
     * Hostname regular expression sources of entries with a wildcard.
     */
    readonly patterns: readonly string[];
}

/**
 * The allowlist is used to exclude certain websites from filtering.
 * Blocking rules are not applied to the sites in the list.
 * The allow list can also be inverted.
 * In inverted mode, the application will unblock ads everywhere except for the
 * sites added to this list.
 */
export abstract class Allowlist {
    /**
     * Indicates whether the allowlist is enabled.
     */
    public enabled = false;

    /**
     * If true, ads will be blocked only on sites listed in the allowlist,
     * like "blocklist" mode.
     */
    public inverted = false;

    /**
     * Normalized entries that produce an allowlist rule.
     */
    private domainList: string[] = [];

    /**
     * Hosts selected by the inverted allowlist, rebuilt on every {@link domains} change.
     */
    private invertedMatchValue: InvertedAllowlistMatch = Allowlist.getInvertedMatch([]);

    /**
     * Hosts of {@link invertedMatchValue} as a set.
     */
    private invertedHosts: Set<string> = new Set();

    /**
     * Domains of {@link invertedMatchValue} as a set.
     */
    private invertedDomains: Set<string> = new Set();

    /**
     * Compiled patterns of {@link invertedMatchValue}, anchored to the whole hostname.
     */
    private invertedPatterns: RegExp[] = [];

    /**
     * List of domains which are allowed (by default)
     * or blocked (if the allowlist is inverted).
     *
     * @returns Normalized allowlist entries.
     */
    public get domains(): string[] {
        return this.domainList;
    }

    /**
     * Replaces the entry list and rebuilds the inverted allowlist match.
     *
     * @param domains Normalized allowlist entries.
     */
    public set domains(domains: string[]) {
        this.domainList = domains;
        this.invertedMatchValue = this.compileInvertedMatch();
        this.invertedHosts = new Set(this.invertedMatchValue.hosts);
        this.invertedDomains = new Set(this.invertedMatchValue.domains);
        this.invertedPatterns = this.invertedMatchValue.patterns
            .map((pattern) => new RegExp(`^(?:${pattern})$`));
    }

    /**
     * Hosts selected by the inverted allowlist.
     *
     * @returns Host selection of the inverted allowlist.
     */
    public get invertedMatch(): InvertedAllowlistMatch {
        return this.invertedMatchValue;
    }

    /**
     * Configures allowlist state based on app configuration.
     *
     * @param configuration App configuration.
     */
    public configure(configuration: AllowlistConfiguration): void {
        const {
            allowlist,
            settings,
        } = configuration;

        const {
            allowlistEnabled,
            allowlistInverted,
        } = settings;

        this.enabled = allowlistEnabled;
        this.inverted = allowlistInverted;

        this.domains = Allowlist.prepareDomains(allowlist);
    }

    /**
     * Checks whether the host is selected by the inverted allowlist, i.e. whether filtering stays
     * enabled on it. The result is meaningful only in the inverted mode: {@link enabled} and
     * {@link inverted} are not checked here.
     *
     * @param host Hostname to match, with or without the `www.` prefix.
     *
     * @returns True if filtering stays enabled on the host in the inverted mode.
     */
    public isDomainListed(host: string): boolean {
        if (this.invertedMatchValue.all) {
            return true;
        }

        const hostname = host.toLowerCase().replace(/\.$/, '');
        const domain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;

        if (this.invertedHosts.has(hostname) || this.invertedHosts.has(domain)) {
            return true;
        }

        for (let suffix = hostname; ; suffix = suffix.slice(suffix.indexOf('.') + 1)) {
            if (this.invertedDomains.has(suffix)) {
                return true;
            }

            if (!suffix.includes('.')) {
                break;
            }
        }

        return this.invertedPatterns.some((pattern) => pattern.test(hostname));
    }

    /**
     * Checks whether the entry is the full wildcard — `*.*` and its `*.**` spelling — which selects
     * every host.
     *
     * @param domain Normalized allowlist entry.
     *
     * @returns True for an entry without a concrete label.
     */
    public static isFullWildcardEntry(domain: string): boolean {
        return /^\*\.\*+$/.test(domain);
    }

    /**
     * Describes the hosts an inverted allowlist selects: a plain entry covers its host and the
     * `www.` variant, a `*.` entry covers the domain and every subdomain, and an entry with a
     * wildcard TLD covers the domain, its `www.` variant and their subdomains. The last one goes
     * beyond the generated allowlist rule of that entry, which covers only the host and `www.`, so
     * that inverted filtering stays on for the subdomains too.
     *
     * @param domains Normalized allowlist entries.
     *
     * @returns Host selection of the inverted allowlist.
     */
    public static getInvertedMatch(domains: readonly string[]): InvertedAllowlistMatch {
        const hosts: string[] = [];
        const selectedDomains: string[] = [];
        const patterns: string[] = [];

        for (const domain of domains) {
            if (Allowlist.isFullWildcardEntry(domain)) {
                return {
                    all: true,
                    hosts: [],
                    domains: [],
                    patterns: [],
                };
            }

            const base = domain.startsWith('*.') ? domain.slice(2) : domain;

            if (!base.includes('*')) {
                (domain.startsWith('*.') ? selectedDomains : hosts).push(base);
                continue;
            }

            // A wildcard TLD entry covers subdomains at any depth as well, unlike its own generated
            // rule. A wildcard inside a label without the `*.` prefix covers the host and `www.`,
            // and the wildcard may cross label dots, as in the generated rule.
            const subdomains = domain.startsWith('*.') || domain.endsWith('.*');

            patterns.push(AllowlistPattern.hostname(base, subdomains));
        }

        return {
            all: false,
            hosts,
            domains: selectedDomains,
            patterns,
        };
    }

    /**
     * Normalizes the configured entries and keeps the ones the allowlist can match, so every
     * consumer of {@link domains} — the generated rules, the canvas protection policy and the MV3
     * twins — sees the same list.
     *
     * @param allowlist Allowlist entries from the configuration.
     *
     * @returns Normalized entries that produce an allowlist rule.
     */
    protected static prepareDomains(allowlist: string[]): string[] {
        return allowlist
            .map((hostname) => normalizeAllowlistDomain(hostname))
            .filter((domain) => {
                try {
                    return Allowlist.createAllowlistRule(domain) !== null;
                } catch {
                    // An entry that only looks like a domain, e.g. a hosts-file line from an
                    // import, produces no allowlist rule, so it must not reach the generated rules
                    // or the DNR `$to` list either.
                    return false;
                }
            });
    }

    /**
     * Describes the hosts an inverted allowlist selects. Platforms whose network layer matches
     * differently from the generated rules override it.
     *
     * @returns Host selection of the inverted allowlist.
     */
    protected compileInvertedMatch(): InvertedAllowlistMatch {
        return Allowlist.getInvertedMatch(this.domains);
    }

    /**
     * Returns a list of rules to be loaded into the engine based on allowlist state.
     *
     * @returns List of allowlist rules or null.
     */
    public getAllowlistRules(): string | null {
        if (!this.enabled || this.inverted) {
            return null;
        }

        const rules = this.domains
            .map((domain) => createAllowlistRuleNode(domain))
            .filter((r) => r !== null)
            .map(RuleGenerator.generate);

        return rules.join('\n');
    }

    /**
     * Creates an allowlist rule for a domain which will be passed to our engine
     * to unblock requests. In MV3 we will pass this rule to TsUrlFilter engine,
     * because it do work with cosmetic rules.
     *
     * @param domain Domain name.
     *
     * @returns Allowlist rule or null.
     */
    public static createAllowlistRule(domain: string): NetworkRule | null {
        if (!domain) {
            return null;
        }

        return RuleFactory.createAllowlistRule(domain, ALLOWLIST_FILTER_ID);
    }
}
