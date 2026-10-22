import {
    type AnyRule,
    NetworkRuleType,
    PIPE_MODIFIER_SEPARATOR,
    RuleParser,
} from '@adguard/agtree';
import {
    fastHash,
    NETWORK_RULE_OPTIONS,
    SimpleRegex,
    StealthOptionName,
} from '@adguard/tsurlfilter';

import { logger } from '../utils/logger';

import { CanvasConditionType, CanvasRuleSkipReason } from './constants';
import { type HostCondition, type PreparedCondition, type ProtectionPolicyArtifact } from './contracts';

/**
 * Configured platform allowlist state.
 */
export interface PolicyAllowlist {
    readonly enabled: boolean;
    readonly inverted: boolean;
    readonly domains: readonly string[];
}

/**
 * What a supported filter rule excludes from canvas protection.
 */
export interface CanvasRuleExclusion {
    /**
     * Lowercase ASCII hostname of the `||host^` pattern.
     */
    readonly hostname: string;

    /**
     * `$document`: top-level documents of the host and its subdomains, together with their frames.
     */
    readonly document: boolean;

    /**
     * `$stealth` covering fingerprinting: documents of the host and its subdomains by their own URL.
     */
    readonly stealth: boolean;
}

/**
 * Prepares deterministic canvas exclusions from filter rules and the configured allowlist.
 */
export class CanvasPolicyCompiler {
    /**
     * Optional `www.` subdomain.
     */
    private static readonly WWW = '(?:www\\.)?';

    /**
     * Optional subdomain labels.
     */
    private static readonly SUBDOMAINS = '(?:[^.]+\\.)*';

    /**
     * Wildcard of an allowlist domain.
     */
    private static readonly HOST_WILDCARD = '.*';

    /**
     * Characters a rule host may contain. URL parsing would rewrite or drop the others,
     * while filtering compares the host as written.
     */
    private static readonly RULE_HOST = /^[^\s/?#:@[\]|^\\%*]+$/;

    /**
     * Any character outside printable ASCII: such a host is converted to punycode.
     */
    private static readonly NON_ASCII = /[^ -~]/;

    /**
     * IPv4 address, which has no subdomains to match.
     */
    private static readonly IPV4 = /^\d+\.\d+\.\d+\.\d+$/;

    /**
     * Compiles supported network exceptions and the platform's allowlist semantics.
     *
     * @param ruleTexts Active exception rule texts, with badfilter cancellations already applied.
     * @param allowlist Configured allowlist state.
     *
     * @returns Seed-free policy, identical for equivalent inputs regardless of input order.
     */
    public static compile(ruleTexts: readonly string[], allowlist: PolicyAllowlist): ProtectionPolicyArtifact {
        const excludeMatches: string[] = [];
        const hosts: string[] = [];
        const domains: string[] = [];
        const patterns: string[] = [];
        const skipped = new Map<CanvasRuleSkipReason, number>();
        for (const text of ruleTexts) {
            const exclusion = CanvasPolicyCompiler.readRule(text);
            if (typeof exclusion === 'string') {
                skipped.set(exclusion, (skipped.get(exclusion) ?? 0) + 1);
                continue;
            }
            if (exclusion?.stealth) {
                excludeMatches.push(CanvasPolicyCompiler.IPV4.test(exclusion.hostname)
                    ? `*://${exclusion.hostname}/*` : `*://*.${exclusion.hostname}/*`);
            }
            if (exclusion?.document) {
                domains.push(exclusion.hostname);
            }
        }
        // One line instead of one per rule: filter lists hold hundreds of such exceptions.
        if (skipped.size > 0) {
            const total = [...skipped.values()].reduce((sum, count) => sum + count, 0);
            const reasons = [...skipped].map(([reason, count]) => `${count} ${reason}`).join(', ');
            logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipped ${total} exception rule(s) that canvas protection cannot express: ${reasons}`);
        }
        if (allowlist.enabled && !allowlist.inverted) {
            for (const domain of allowlist.domains) {
                const subdomains = domain.startsWith('*.');
                const host = subdomains ? domain.slice(2) : domain;
                if (host.includes('*')) {
                    patterns.push(CanvasPolicyCompiler.wildcardPattern(host, subdomains));
                } else {
                    (subdomains ? domains : hosts).push(host);
                }
            }
        }
        const documentExclusions: PreparedCondition[] = [];
        if (hosts.length > 0 || domains.length > 0 || patterns.length > 0) {
            documentExclusions.push(CanvasPolicyCompiler.hostCondition({ hosts, domains, patterns }));
        }
        if (allowlist.enabled && allowlist.inverted) {
            documentExclusions.push(CanvasPolicyCompiler.invertedAllowlistExclusion(allowlist.domains));
        }
        const policy = {
            selectors: { matches: ['<all_urls>'], excludeMatches: [...new Set(excludeMatches)].sort() },
            documentExclusions,
        };
        return { revision: fastHash(JSON.stringify(policy)).toString(16).padStart(8, '0'), ...policy };
    }

    /**
     * Reads what a filter rule excludes from canvas protection.
     *
     * @param text Rule text.
     *
     * @returns The exclusion, or `undefined` for a rule that does not affect canvas protection
     * or cannot be expressed by it.
     */
    public static parseRule(text: string): CanvasRuleExclusion | undefined {
        const exclusion = CanvasPolicyCompiler.readRule(text);
        return typeof exclusion === 'string' ? undefined : exclusion;
    }

    /**
     * Reads what a filter rule excludes from canvas protection, or why it is skipped.
     *
     * @param text Rule text.
     *
     * @returns The exclusion, the reason a rule that could affect canvas protection is skipped,
     * or `undefined` for a rule that does not affect it.
     */
    private static readRule(text: string): CanvasRuleExclusion | CanvasRuleSkipReason | undefined {
        let rule: AnyRule;
        try {
            rule = RuleParser.parse(text);
        } catch {
            return CanvasRuleSkipReason.Unparsable;
        }
        if (rule.type !== NetworkRuleType.NetworkRule || rule.exception !== true) {
            return undefined;
        }
        const modifiers = rule.modifiers?.children ?? [];
        const document = modifiers.find((modifier) => modifier.name.value === NETWORK_RULE_OPTIONS.DOCUMENT);
        // The engine keeps the last `$stealth`; `findLast` is missing in older supported Firefox.
        const stealths = modifiers.filter((modifier) => modifier.name.value === NETWORK_RULE_OPTIONS.STEALTH);
        const stealth = stealths[stealths.length - 1];
        const fingerprinting = stealth !== undefined && (stealth.value === undefined
            || stealth.value.value.split(PIPE_MODIFIER_SEPARATOR)
                .some((option) => option.trim() === StealthOptionName.Fingerprinting));
        if (!document && !fingerprinting) {
            return undefined;
        }
        const unsupportedModifier = modifiers.some((modifier) => {
            if (modifier.exception) {
                return true;
            }
            switch (modifier.name.value) {
                case NETWORK_RULE_OPTIONS.STEALTH:
                    return false;
                case NETWORK_RULE_OPTIONS.DOCUMENT:
                case NETWORK_RULE_OPTIONS.IMPORTANT:
                    return modifier.value !== undefined;
                default:
                    return true;
            }
        });
        if (unsupportedModifier) {
            return CanvasRuleSkipReason.UnsupportedModifiers;
        }
        const pattern = rule.pattern.value;
        if (!pattern.startsWith('||') || !pattern.endsWith('^')) {
            return CanvasRuleSkipReason.NotHostPattern;
        }
        const host = pattern.slice(2, -1);
        if (host.includes('*')) {
            return CanvasRuleSkipReason.WildcardHost;
        }
        const hostname = CanvasPolicyCompiler.parseHost(host);
        if (hostname === undefined) {
            return CanvasRuleSkipReason.NotPlainHostname;
        }
        return { hostname, document: document !== undefined, stealth: fingerprinting };
    }

    /**
     * Converts a rule host to the form the browser reports, accepting only hosts that
     * URL parsing does not rewrite apart from case and punycode.
     *
     * @param host Host from a `||host^` pattern.
     *
     * @returns Lowercase ASCII hostname, or `undefined` for anything but a plain hostname.
     */
    private static parseHost(host: string): string | undefined {
        if (!CanvasPolicyCompiler.RULE_HOST.test(host)) {
            return undefined;
        }
        let hostname: string;
        try {
            ({ hostname } = new URL(`http://${host}`));
        } catch {
            return undefined;
        }
        if (CanvasPolicyCompiler.NON_ASCII.test(host)) {
            const writtenLabels = host.split('.');
            const parsedLabels = hostname.split('.');
            const punycodeOnly = writtenLabels.length === parsedLabels.length
                && writtenLabels.every((label, index) => label.length > 0 && parsedLabels[index].length > 0
                    && (CanvasPolicyCompiler.NON_ASCII.test(label)
                        ? parsedLabels[index].startsWith('xn--')
                        : parsedLabels[index] === label.toLowerCase()));
            return punycodeOnly ? hostname : undefined;
        }
        // URL parsing also rewrites IPv4 shorthands such as `127.1`, which filtering matches literally.
        return hostname === host.toLowerCase() ? hostname : undefined;
    }

    /**
     * Matches the hostname of a top-level document allowlisted by a normal-mode entry with
     * a wildcard: the domain and its `www.` subdomain, or the domain with all subdomains for
     * a `*.` entry. A `*` in the domain matches within the host.
     *
     * @param host Allowlist entry without the `*.` prefix.
     * @param subdomains Whether the entry has the `*.` prefix.
     *
     * @returns Hostname regular expression source.
     */
    private static wildcardPattern(host: string, subdomains: boolean): string {
        const prefix = subdomains ? CanvasPolicyCompiler.SUBDOMAINS : CanvasPolicyCompiler.WWW;
        const pattern = SimpleRegex.escapeRegexSpecials(host).replaceAll('\\*', CanvasPolicyCompiler.HOST_WILDCARD);
        return `${prefix}${pattern}`;
    }

    /**
     * Matches hosted top-level documents outside the inverted allowlist. Plain entries cover the
     * host and `www.`, while `*.` entries cover subdomains one level below the domain after
     * stripping `www.`, mirroring the upper-level domain lookup of frame matching.
     * Top-level documents without a hostname stay protected, as frame matching finds no domain there.
     *
     * @param domains Allowlist entries.
     *
     * @returns Document exclusion.
     */
    private static invertedAllowlistExclusion(domains: readonly string[]): PreparedCondition {
        const hosts: string[] = [];
        const parents: string[] = [];
        for (const domain of domains) {
            if (domain.startsWith('*.')) {
                parents.push(domain.slice(2));
            } else {
                hosts.push(domain);
            }
        }
        return {
            type: CanvasConditionType.Not,
            operand: CanvasPolicyCompiler.hostCondition({ hosts, parents }),
        };
    }

    /**
     * Combines lookups into a single predicate evaluated against the top document's hostname.
     *
     * @param lookups Hosts, domains, parent domains and hostname regular expression sources.
     * @param lookups.hosts Hosts matched as written or with a `www.` prefix.
     * @param lookups.domains Domains matched together with their subdomains.
     * @param lookups.parents Domains whose subdomains one level below match after stripping `www.`.
     * @param lookups.patterns Regular expression sources of wildcard entries.
     *
     * @returns Host predicate with deterministic, deduplicated lookups.
     */
    private static hostCondition(lookups: {
        hosts?: readonly string[];
        domains?: readonly string[];
        parents?: readonly string[];
        patterns?: readonly string[];
    }): HostCondition {
        const unique = (values: readonly string[] = []): string[] => [...new Set(values)].sort();
        const domains = unique(lookups.domains);
        const domainSet = new Set(domains);
        // A domain lookup already covers the host and `www.`, e.g. the `*.` twins MV3 adds to every entry.
        const hosts = unique(lookups.hosts).filter((host) => !domainSet.has(host));
        const patterns = unique(lookups.patterns);
        const condition: HostCondition = {
            type: CanvasConditionType.Host,
            hosts,
            domains,
            parents: unique(lookups.parents),
        };
        return patterns.length > 0
            ? { ...condition, pattern: `^(?:${patterns.map((source) => `(?:${source})`).join('|')})$` }
            : condition;
    }
}
