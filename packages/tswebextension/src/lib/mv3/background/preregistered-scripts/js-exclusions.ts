import {
    getRuleTable,
    MatchingResult,
    NetworkRule,
    NetworkRuleOption,
    Request,
    RequestType,
    RuleTable,
    SimpleRegex,
} from '@adguard/tsurlfilter';

import { convertRuleLine, isExceptionCandidateLine, splitFilterLines } from './filter-lines';
import { matchesHostScope } from './host-scope';
import { createPreregisteredPageRequest } from './page-request';
import { getPreregisteredRootUrl } from './root-request';

/**
 * Allowlist lines of one filter: the rules the engine matches with. Only the
 * enabled filters are passed, so a `$badfilter` of another filter resolves
 * here exactly like the engine resolves it.
 */
export interface ExceptionSource {
    /**
     * Filter id the lines belong to.
     */
    filterId: number;

    /**
     * Candidate lines of the filter (see {@link collectExceptionLines}).
     */
    lines: readonly string[];
}

/**
 * URL exclusions for the registrations of a set of hostnames.
 */
export interface JsExclusions {
    /**
     * Hostname → `excludeMatches` patterns of its registration: the URLs of
     * the host whose network exceptions disable JS injection.
     */
    exclusions: Map<string, string[]>;

    /**
     * Hostnames that must keep the dynamic injection path, mapped to the
     * reason: a host-wide exception, an exception `excludeMatches` cannot
     * express, or a higher-ranked exception that keeps JS injection on.
     */
    dynamicHosts: Map<string, string>;

    /**
     * Rule texts of the exceptions that name no host (`@@/path$document`).
     * They match every site, so no single exclusion can express them; they
     * are reported, never fatal.
     */
    unanchoredExceptions: string[];
}

/**
 * Separator between the scheme and the authority of an absolute pattern.
 */
const SCHEME_SEPARATOR = '://';

/**
 * Scheme a preregistered document is loaded over.
 */
const PREREGISTERED_SCHEME = 'https';

/**
 * Characters a match-pattern path can carry. Everything else (a wildcard
 * inside the path, a query, a regexp construct) cannot be expressed as an
 * `excludeMatches` entry.
 */
const MATCH_PATTERN_PATH = /^\/[\w~%./-]*$/;

/**
 * Host part of a pattern together with what follows it.
 */
type PatternHost = {
    /**
     * Host of the pattern, without the anchor.
     */
    host: string;

    /**
     * Whether the anchor accepts subdomains.
     */
    allowSubdomains: boolean;

    /**
     * Text after the host: the path, or a terminator.
     */
    rest: string;
};

/**
 * Reads the host part of a pattern that names one: `||host…`, `|scheme://host…`,
 * `://host…` or a bare `host/path` / `.host/path`.
 *
 * @param pattern Rule pattern.
 *
 * @returns Host part and the text after it, or `undefined` when the pattern
 * does not name a host (a regexp, a bare path, a plain substring).
 */
const parsePatternHost = (pattern: string): PatternHost | undefined => {
    let rest: string;
    let allowSubdomains = false;

    if (pattern.startsWith(SimpleRegex.MASK_START_URL)) {
        rest = pattern.slice(SimpleRegex.MASK_START_URL.length);
        allowSubdomains = true;
    } else if (pattern.startsWith(SimpleRegex.MASK_PIPE)) {
        const anchored = pattern.slice(SimpleRegex.MASK_PIPE.length);
        const schemeIndex = anchored.indexOf(SCHEME_SEPARATOR);
        if (schemeIndex < 0) {
            return undefined;
        }
        // A document is loaded over `https` in every target the artifacts
        // ship for: a rule anchored to another scheme never matches.
        if (anchored.slice(0, schemeIndex).toLowerCase() !== PREREGISTERED_SCHEME) {
            return undefined;
        }
        rest = anchored.slice(schemeIndex + SCHEME_SEPARATOR.length);
    } else if (pattern.startsWith(SCHEME_SEPARATOR)) {
        rest = pattern.slice(SCHEME_SEPARATOR.length);
    } else {
        // A scheme-less pattern that starts with a host-looking token
        // (`host/path`, `.host/path`): the leading dot is not special in the
        // engine, it is part of the substring the rule looks for.
        const bare = pattern.startsWith('.') ? pattern.slice(1) : pattern;
        const [firstToken = ''] = bare.split(/[/^?#]/);
        if (!/^[\w*%-]+(\.[\w*%-]+)+$/.test(firstToken)) {
            return undefined;
        }
        rest = bare;
    }

    const host = rest.split(/[:/^?#]/)[0];
    if (!host) {
        return undefined;
    }

    return {
        host,
        allowSubdomains,
        rest: rest.slice(host.length),
    };
};

/**
 * Checks whether the pattern covers the hostname.
 *
 * @param patternHost Host part of the pattern.
 * @param hostname Hostname to check.
 *
 * @returns True when the pattern can match some URL of the hostname.
 */
const hostCovers = (patternHost: PatternHost, hostname: string): boolean => {
    const host = patternHost.host.toLowerCase();
    // A wildcard host cannot be compared with the target without a matcher,
    // and a host that neither equals nor suffixes the target belongs to
    // another site: both are "not this host".
    if (host.includes('*')) {
        return false;
    }

    return hostname === host || (patternHost.allowSubdomains && hostname.endsWith(`.${host}`));
};

/**
 * Builds the `excludeMatches` pattern for one exception of the host.
 *
 * @param patternHost Host part of the pattern.
 * @param hostname Hostname the registration is for.
 *
 * @returns Match pattern, or `undefined` when the pattern cannot be expressed
 * (a host-wide exception, a wildcard path, a query, a regexp).
 */
const toExcludePattern = (patternHost: PatternHost, hostname: string): string | undefined => {
    const path = patternHost.rest;
    if (!MATCH_PATTERN_PATH.test(path)) {
        return undefined;
    }

    // The engine matches the pattern as `host` followed by the path, and the
    // registration covers the host only: the exclusion is anchored to it.
    return `*://${hostname}${path}*`;
};

/**
 * Parses the candidate rules out of the sources: allowlist rules that can
 * win one of the two slots the JS bit depends on.
 *
 * @param sources Candidate lines of the enabled filters.
 *
 * @returns Parsed candidate rules.
 */
const collectCandidates = (sources: readonly ExceptionSource[]): NetworkRule[] => {
    const candidates: NetworkRule[] = [];

    for (const source of sources) {
        for (const line of source.lines) {
            for (const ruleText of convertRuleLine(line)) {
                let rule: NetworkRule;
                try {
                    rule = new NetworkRule(ruleText, source.filterId);
                } catch {
                    // The engine drops rules it cannot parse as well.
                    continue;
                }

                if (!rule.isAllowlist()) {
                    continue;
                }

                if (!rule.hasCosmeticOption() && !rule.isDocumentLevelAllowlistRule()) {
                    continue;
                }

                candidates.push(rule);
            }
        }
    }

    return candidates;
};

/**
 * Collects the URL exclusions of one hostname.
 *
 * The scan mirrors the engine's own decision instead of re-implementing rule
 * syntax: rules are parsed by `NetworkRule`, the eligibility conditions copy
 * `NetworkRule.match()`, `$badfilter` is resolved with
 * `MatchingResult.removeBadfilterRules()` on the same rule set the engine
 * matches with (the enabled filters only, and a cancellation by a filter the
 * user disabled is simply absent), and the reach of a pattern is the engine's
 * own comparison.
 *
 * Two requests are evaluated per host, exactly like the runtime does for a
 * main frame: the cosmetic slot uses the page as both the request and the
 * source, while the document slot (`Engine.matchFrame`) has no source, so
 * `$domain` matching differs between the slots.
 *
 * @param candidates Candidate rules of all enabled filters.
 * @param hostname Hostname to build exclusions for.
 *
 * @returns Exclusion patterns of the host, or the reason it stays dynamic.
 */
const buildHostExclusions = (
    candidates: readonly NetworkRule[],
    hostname: string,
): { patterns: string[]; dynamic?: string; unanchored?: string[] } => {
    const rootUrl = getPreregisteredRootUrl(hostname);

    const cosmeticRequest = createPreregisteredPageRequest(hostname);
    const documentRequest = new Request(rootUrl, '', RequestType.Document);

    const cosmeticRules = candidates.filter((rule) => rule.hasCosmeticOption()
        && rule.matchModifiers(cosmeticRequest));
    // The domains table returns nothing for a request without a source, so
    // its rules can never win the document slot of a main frame.
    const documentRules = candidates.filter((rule) => rule.isDocumentLevelAllowlistRule()
        && getRuleTable(rule) !== RuleTable.Domains
        && rule.matchModifiers(documentRequest));

    // `$badfilter` cancels its counterpart within the rule set that matched
    // the request, exactly like the engine resolves it. The call does not
    // mutate its argument.
    const activeCosmeticRules = MatchingResult.removeBadfilterRules(cosmeticRules);
    const activeDocumentRules = MatchingResult.removeBadfilterRules(documentRules);

    const reaching = candidates
        .filter((rule) => activeCosmeticRules.includes(rule) || activeDocumentRules.includes(rule))
        .filter((rule) => matchesHostScope(rule.getPattern(), hostname));

    const disabling: NetworkRule[] = [];
    const keeping: NetworkRule[] = [];

    for (const rule of reaching) {
        if (rule.isOptionEnabled(NetworkRuleOption.Jsinject)) {
            disabling.push(rule);
        } else {
            keeping.push(rule);
        }
    }

    if (disabling.length === 0) {
        return { patterns: [] };
    }

    // An exception that keeps JS injection on and outranks a disabling one
    // would win on the same page: the registration cannot tell which page a
    // priority decides, so the host stays dynamic.
    const lowestDisablingPriority = Math.min(...disabling.map((rule) => rule.getPriorityWeight()));
    const shield = keeping.find((rule) => rule.getPriorityWeight() >= lowestDisablingPriority);
    if (shield) {
        return {
            patterns: [],
            dynamic: `${shield.getText() ?? shield.getPattern()}: a higher-ranked exception keeps JS injection on`,
        };
    }

    const patterns = new Set<string>();
    const unanchored: string[] = [];

    for (const rule of disabling) {
        const text = rule.getText() ?? rule.getPattern();
        const patternHost = parsePatternHost(rule.getPattern());

        // A host-less pattern matches every URL of every site, so it cannot be
        // singled out by an exclusion; a pattern naming another host cannot
        // match this host's pages in the engine either (a generic exception
        // like `.queue*.vk.com/` is not baked for every host).
        if (!patternHost) {
            unanchored.push(text);
            continue;
        }

        if (!hostCovers(patternHost, hostname)) {
            continue;
        }

        // A rule that covers every URL of the host would exclude the whole
        // registration: the host then stays on the dynamic path, which is the
        // same thing without a registration to maintain.
        if (patternHost.rest === '' || patternHost.rest === '^') {
            return { patterns: [], dynamic: text };
        }

        const pattern = toExcludePattern(patternHost, hostname);
        if (!pattern) {
            return {
                patterns: [],
                dynamic: `${text}: the exception cannot be expressed as an excludeMatches pattern`,
            };
        }

        patterns.add(pattern);
    }

    return { patterns: [...patterns].sort(), unanchored };
};

/**
 * Resolves the URL exclusions of the registrations for the given hostnames.
 *
 * @param sources Candidate lines of the enabled filters.
 * @param hostnames Hostnames to build exclusions for.
 *
 * @returns Exclusions per hostname and the hosts that must stay dynamic.
 */
export const resolveHostExclusions = (
    sources: readonly ExceptionSource[],
    hostnames: readonly string[],
): JsExclusions => {
    const exclusions = new Map<string, string[]>();
    const dynamicHosts = new Map<string, string>();
    const unanchoredExceptions = new Set<string>();

    if (hostnames.length === 0) {
        return { exclusions, dynamicHosts, unanchoredExceptions: [] };
    }

    const candidates = collectCandidates(sources);

    for (const hostname of hostnames) {
        const { patterns, dynamic, unanchored } = buildHostExclusions(candidates, hostname);

        unanchored?.forEach((text) => unanchoredExceptions.add(text));

        if (dynamic) {
            dynamicHosts.set(hostname, dynamic);
            continue;
        }

        if (patterns.length > 0) {
            exclusions.set(hostname, patterns);
        }
    }

    return {
        exclusions,
        dynamicHosts,
        unanchoredExceptions: [...unanchoredExceptions].sort(),
    };
};

/**
 * Keeps the allowlist lines of a filter list, so a later scan does not have
 * to re-split the whole list.
 *
 * @param content Raw filter list text.
 *
 * @returns Candidate lines.
 */
export const collectExceptionLines = (content: string): string[] => {
    return splitFilterLines(content).filter(isExceptionCandidateLine);
};
