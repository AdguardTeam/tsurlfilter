import { NetworkRuleType, RuleParser } from '@adguard/agtree';
import { SimpleRegex, StealthOptionName } from '@adguard/tsurlfilter';

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
 * Modifiers supported by host-only canvas exceptions.
 */
enum ExceptionModifier {
    Stealth = 'stealth',
    Document = 'document',
    Important = 'important',
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
     * Any number of subdomains.
     */
    private static readonly SUBDOMAINS = '(?:[^/?#:]+\\.)?';

    /**
     * Exactly one label before a domain, not counting a leading `www.`, like the
     * upper-level domain lookup of frame matching.
     */
    private static readonly FIRST_LABEL = '(?:www\\.[^./?#:]+|(?!www\\.)[^./?#:]+)\\.';

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
        const documentExclusions: PreparedCondition[] = [];
        for (const text of ruleTexts) {
            let rule;
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
            const document = modifiers.find((modifier) => modifier.name.value === ExceptionModifier.Document);
            const stealth = modifiers.find((modifier) => modifier.name.value === ExceptionModifier.Stealth);
            const fingerprinting = stealth !== undefined && (stealth.value === undefined
                || stealth.value.value.split('|').some((option) => option.trim() === StealthOptionName.Fingerprinting));
            if (!document && !fingerprinting) {
                continue;
            }
            const unsupportedModifier = modifiers.some((modifier) => {
                if (modifier.exception) {
                    return true;
                }
                switch (modifier.name.value) {
                    case ExceptionModifier.Stealth:
                        return false;
                    case ExceptionModifier.Document:
                    case ExceptionModifier.Important:
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
                documentExclusions.push(CanvasPolicyCompiler.urlCondition(regexp));
            }
        }
        if (allowlist.enabled) {
            documentExclusions.push(...(allowlist.inverted
                ? [CanvasPolicyCompiler.invertedAllowlistExclusion(allowlist.domains)]
                : allowlist.domains.map((domain) => CanvasPolicyCompiler.allowlistExclusion(domain))));
        }
        const policy = {
            selectors: { matches: ['<all_urls>'], excludeMatches: [...new Set(excludeMatches)].sort() },
            documentExclusions: CanvasPolicyCompiler.sortedUnique(documentExclusions),
        };
        return { revision: CanvasPolicyCompiler.hash(JSON.stringify(policy)), ...policy };
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
            return hostname;
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
     * @returns Document exclusion.
     */
    private static allowlistExclusion(domain: string): PreparedCondition {
        const subdomains = domain.startsWith('*.');
        const host = SimpleRegex.escapeRegexSpecials(subdomains ? domain.slice(2) : domain)
            .replaceAll('\\*', CanvasPolicyCompiler.HOST_WILDCARD);
        return CanvasPolicyCompiler.hostCondition(
            subdomains ? CanvasPolicyCompiler.SUBDOMAINS : CanvasPolicyCompiler.WWW,
            host,
        );
    }

    /**
     * Matches every top-level document outside the inverted allowlist, as frame matching does:
     * the host without `www.` equals an entry, or a `*.` entry equals that host without its first label.
     *
     * @param domains Allowlist entries.
     *
     * @returns Document exclusion.
     */
    private static invertedAllowlistExclusion(domains: readonly string[]): PreparedCondition {
        const operands = [
            CanvasPolicyCompiler.urlCondition(CanvasPolicyCompiler.NO_AUTHORITY),
            ...domains.map((domain) => (domain.startsWith('*.')
                ? CanvasPolicyCompiler.hostCondition(
                    CanvasPolicyCompiler.FIRST_LABEL,
                    SimpleRegex.escapeRegexSpecials(domain.slice(2)),
                )
                : CanvasPolicyCompiler.hostCondition(
                    CanvasPolicyCompiler.WWW,
                    SimpleRegex.escapeRegexSpecials(domain),
                ))),
        ];
        return {
            type: CanvasConditionType.Not,
            operand: { type: CanvasConditionType.Or, operands: CanvasPolicyCompiler.sortedUnique(operands) },
        };
    }

    /**
     * Matches a top document by its host.
     *
     * @param prefix Regular expression of the labels before the host.
     * @param host Escaped host regular expression.
     *
     * @returns URL predicate.
     */
    private static hostCondition(prefix: string, host: string): PreparedCondition {
        return CanvasPolicyCompiler.urlCondition(
            `${CanvasPolicyCompiler.URL_START}${prefix}${host}${CanvasPolicyCompiler.HOST_END}`,
        );
    }

    /**
     * Creates a predicate evaluated against the top document's URL.
     *
     * @param pattern Regular expression source.
     *
     * @returns URL predicate.
     */
    private static urlCondition(pattern: string): PreparedCondition {
        return { type: CanvasConditionType.UrlRegexp, pattern, flags: CanvasConditionFlags.IgnoreCase };
    }

    /**
     * Sorts and deduplicates JSON values by their serialized representations.
     *
     * @param values Values to canonicalize.
     *
     * @returns Unique values in deterministic order.
     */
    private static sortedUnique<T>(values: readonly T[]): T[] {
        return [...new Map(values.map((value) => [JSON.stringify(value), value]))]
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([, value]) => value);
    }

    /**
     * Computes 32-bit FNV-1a over UTF-16 character codes.
     *
     * @param text Canonical serialized policy.
     *
     * @returns Eight hexadecimal digits identifying the policy.
     */
    private static hash(text: string): string {
        let hash = 0x811c9dc5;
        for (let index = 0; index < text.length; index += 1) {
            hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
}
