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

import { CanvasConditionFlags, CanvasConditionType } from './constants';
import { type PreparedCondition, type ProtectionPolicyArtifact } from './contracts';

/**
 * Configured platform allowlist state.
 */
export interface PolicyAllowlist {
    readonly enabled: boolean;
    readonly inverted: boolean;
    readonly domains: readonly string[];
}

/**
 * Prepares deterministic canvas exclusions from filter rules and the configured allowlist.
 */
export class CanvasPolicyCompiler {
    /**
     * Start of an absolute URL up to its host.
     */
    private static readonly URL_START = '^[^:/?#]+://';

    /**
     * End of a host: an optional trailing dot and port, then a path, query, fragment or the URL end.
     */
    private static readonly HOST_END = '\\.?(?::\\d+)?(?:[/?#]|$)';

    /**
     * URL without an authority, e.g. `file:///`. Frame matching finds no domain there and
     * never applies the inverted allowlist.
     */
    private static readonly NO_AUTHORITY = '^[^:/?#]+:///';

    /**
     * Optional `www.` subdomain.
     */
    private static readonly WWW = '(?:www\\.)?';

    /**
     * One label after stripping `www.`, mirroring the upper-level domain lookup of frame matching.
     */
    private static readonly FIRST_LABEL = '(?:www\\.[^./?#:]+|(?!www\\.)[^./?#:]+)\\.';

    /**
     * One or more subdomain labels.
     */
    private static readonly SUBDOMAINS = '(?:[^./?#:]+\\.)+';

    /**
     * Wildcard of an allowlist domain, limited to the host.
     */
    private static readonly HOST_WILDCARD = '[^/?#:]*';

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
        const positivePatterns: string[] = [];
        for (const text of ruleTexts) {
            let rule: AnyRule;
            try {
                rule = RuleParser.parse(text);
            } catch (error) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": parsing failed: ${error}`);
                continue;
            }
            if (rule.type !== NetworkRuleType.NetworkRule || rule.exception !== true) {
                continue;
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
                continue;
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
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": unsupported modifiers`);
                continue;
            }
            const pattern = rule.pattern.value;
            if (!pattern.startsWith('||') || !pattern.endsWith('^')) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": expected a ||host^ pattern`);
                continue;
            }
            const host = pattern.slice(2, -1);
            if (host.includes('*')) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": wildcard hosts are unsupported`);
                continue;
            }
            const hostname = CanvasPolicyCompiler.parseHost(host);
            if (hostname === undefined) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": expected a plain hostname`);
                continue;
            }
            if (fingerprinting) {
                excludeMatches.push(CanvasPolicyCompiler.IPV4.test(hostname)
                    ? `*://${hostname}/*` : `*://*.${hostname}/*`);
            }
            if (document) {
                const regexp = SimpleRegex.patternToRegexp(`||${hostname}^`);
                positivePatterns.push(regexp);
            }
        }
        if (allowlist.enabled && !allowlist.inverted) {
            positivePatterns.push(...allowlist.domains.map((domain) => CanvasPolicyCompiler.allowlistPattern(domain)));
        }
        const documentExclusions: PreparedCondition[] = [];
        if (positivePatterns.length > 0) {
            documentExclusions.push(CanvasPolicyCompiler.urlCondition(positivePatterns));
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
     * Matches a top-level document allowlisted by a normal-mode entry: the domain and its
     * `www.` subdomain, or the domain with all subdomains for a `*.` entry. A `*` in the
     * domain matches within the host.
     *
     * @param domain Allowlist entry.
     *
     * @returns URL regular expression source.
     */
    private static allowlistPattern(domain: string): string {
        const subdomains = domain.startsWith('*.');
        const host = SimpleRegex.escapeRegexSpecials(subdomains ? domain.slice(2) : domain)
            .replaceAll('\\*', CanvasPolicyCompiler.HOST_WILDCARD);
        return CanvasPolicyCompiler.hostPattern(
            subdomains ? `(?:${CanvasPolicyCompiler.SUBDOMAINS})?` : CanvasPolicyCompiler.WWW,
            host,
        );
    }

    /**
     * Matches hosted top-level documents outside the inverted allowlist. Plain entries cover the
     * host and `www.`, while `*.` entries cover subdomains one level below the domain after
     * stripping `www.`, mirroring the upper-level domain lookup of frame matching.
     *
     * @param domains Allowlist entries.
     *
     * @returns Document exclusion.
     */
    private static invertedAllowlistExclusion(domains: readonly string[]): PreparedCondition {
        const patterns = [
            CanvasPolicyCompiler.NO_AUTHORITY,
            ...domains.map((domain) => (domain.startsWith('*.')
                ? CanvasPolicyCompiler.hostPattern(
                    CanvasPolicyCompiler.FIRST_LABEL,
                    SimpleRegex.escapeRegexSpecials(domain.slice(2)),
                )
                : CanvasPolicyCompiler.hostPattern(
                    CanvasPolicyCompiler.WWW,
                    SimpleRegex.escapeRegexSpecials(domain),
                ))),
        ];
        return {
            type: CanvasConditionType.Not,
            operand: CanvasPolicyCompiler.urlCondition(patterns),
        };
    }

    /**
     * Matches a top document by its host.
     *
     * @param prefix Regular expression of the labels before the host.
     * @param host Escaped host regular expression.
     *
     * @returns URL regular expression source.
     */
    private static hostPattern(prefix: string, host: string): string {
        return `${CanvasPolicyCompiler.URL_START}${prefix}${host}${CanvasPolicyCompiler.HOST_END}`;
    }

    /**
     * Combines patterns into a single predicate evaluated against the top document's URL.
     *
     * @param patterns Regular expression sources.
     *
     * @returns URL predicate with deterministic, deduplicated alternatives.
     */
    private static urlCondition(patterns: readonly string[]): PreparedCondition {
        const pattern = [...new Set(patterns)].sort().map((source) => `(?:${source})`).join('|');
        return { type: CanvasConditionType.UrlRegexp, pattern, flags: CanvasConditionFlags.IgnoreCase };
    }
}
