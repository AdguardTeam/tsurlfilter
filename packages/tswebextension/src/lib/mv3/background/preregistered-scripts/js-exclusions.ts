import {
    MatchingResult,
    NetworkRule,
    NetworkRuleOption,
    Request,
    RequestType,
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
     * are reported and stay unapplied on preregistered pages, never fatal.
     */
    unanchoredExceptions: string[];
}

/**
 * A parsed candidate rule with the line it was written as: `$badfilter`
 * cancels a rule by comparing the written text, so the scan keeps the
 * original line next to the rule it parsed it into.
 */
interface Candidate {
    /**
     * Parsed allowlist rule.
     */
    rule: NetworkRule;

    /**
     * Filter line the rule was parsed from.
     */
    writtenText: string;
}

/**
 * Separator between the scheme and the authority of an absolute pattern.
 */
const SCHEME_SEPARATOR = '://';

/**
 * Schemes a preregistered document can be loaded over: the registration uses
 * the `*` scheme wildcard, so an exclusion anchored to one of them still lies
 * inside its `matches`.
 */
const DOCUMENT_SCHEMES = new Set(['http', 'https']);

/**
 * Scheme wildcard of an exclusion that covers both document schemes.
 */
const ANY_SCHEME = '*';

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

    /**
     * Scheme of an anchored pattern, or {@link ANY_SCHEME}.
     */
    scheme: string;

    /**
     * Whether the pattern anchors the host. A bare `host/path` pattern is a
     * substring search instead, so its host token can also occur inside a
     * longer host or the query of another site.
     */
    anchored: boolean;

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
    let scheme = ANY_SCHEME;
    let anchored = true;

    if (pattern.startsWith(SimpleRegex.MASK_START_URL)) {
        rest = pattern.slice(SimpleRegex.MASK_START_URL.length);
        allowSubdomains = true;
    } else if (pattern.startsWith(SimpleRegex.MASK_PIPE)) {
        const pipeAnchored = pattern.slice(SimpleRegex.MASK_PIPE.length);
        const schemeIndex = pipeAnchored.indexOf(SCHEME_SEPARATOR);
        if (schemeIndex < 0) {
            return undefined;
        }
        scheme = pipeAnchored.slice(0, schemeIndex).toLowerCase();
        // A document is loaded over http(s) only, so an exception anchored to
        // another scheme never matches one.
        if (!DOCUMENT_SCHEMES.has(scheme)) {
            return undefined;
        }
        rest = pipeAnchored.slice(schemeIndex + SCHEME_SEPARATOR.length);
    } else if (pattern.startsWith(SCHEME_SEPARATOR)) {
        rest = pattern.slice(SCHEME_SEPARATOR.length);
    } else {
        // A bare `host/path` or `.host/path` is a substring search, not a host
        // anchor: the same text can sit inside a longer host or a query. The
        // leading dot is not special in the engine either, it is part of the
        // substring, so it still requires a label before the host part.
        anchored = false;
        // The leading dot is part of the substring, not an anchor: it is
        // stripped to read the host token.
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
        scheme,
        anchored,
    };
};

/**
 * Escapes a literal for a regular expression.
 *
 * @param text Literal text.
 *
 * @returns Escaped text.
 */
/**
 * Checks whether a rule without a host part still matches the root page of the
 * hostname. Such an exception decides the very page the registration covers
 * and no exclusion can express it.
 *
 * @param rule Candidate rule.
 * @param hostname Hostname of the registration.
 *
 * @returns True when the rule matches a root page of the host.
 */
const reachesRootPage = (rule: NetworkRule, hostname: string): boolean => (
    [`https://${hostname}/`, `http://${hostname}/`].some((url) => (
        rule.match(new Request(url, '', RequestType.Document))
    ))
);

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Checks whether a host pattern with wildcards matches the hostname. The
 * engine's `*` spans dots, so the comparison is a glob, not a label match.
 *
 * @param host Host part of the pattern.
 * @param hostname Hostname to check.
 *
 * @returns True when the pattern matches the hostname.
 */
const matchesWildcardHost = (host: string, hostname: string): boolean => {
    const source = host.split('*').map(escapeRegExp).join('.*');

    return new RegExp(`^${source}$`).test(hostname);
};

/**
 * Resolves how a pattern's host part relates to the registered hostname.
 *
 * @param patternHost Host part of the pattern.
 * @param hostname Hostname the registration is for.
 *
 * @returns `"host"` when the pattern is pinned to this hostname, `"unknown"`
 * when the engine reaches the host but a match-pattern anchor cannot express
 * it, `"other"` when the pattern belongs to another site.
 */
const resolveScope = (
    patternHost: PatternHost,
    hostname: string,
): 'host' | 'unknown' | 'other' => {
    const host = patternHost.host.toLowerCase();

    if (!patternHost.anchored) {
        // A substring search cannot be pinned: `youtube.com/ads` also matches
        // `https://youtube.com/watch?u=youtube.com/ads`, so the reach of the
        // rule is wider than the URL prefix an exclusion could name. The
        // token counts as reaching the host when it occurs anywhere inside the
        // hostname — `tube.com` and the wildcard `you*.com` both match
        // `https://youtube.com/ads` in the engine.
        if (host.includes('*')) {
            return matchesWildcardHost(host, hostname) ? 'unknown' : 'other';
        }

        return hostname.includes(host) ? 'unknown' : 'other';
    }

    if (hostname === host || (patternHost.allowSubdomains && hostname.endsWith(`.${host}`))) {
        return 'host';
    }

    // A wildcard host (`||*.youtube.com`) reaches the hostname in the engine,
    // but no exclusion can be anchored to it. The engine's `*` spans dots, so
    // the comparison is a glob.
    if (host.includes('*')) {
        return matchesWildcardHost(host, hostname) ? 'unknown' : 'other';
    }

    // An unterminated host part is a prefix match: `||youtube` and `||youtube.`
    // both reach `www.youtube.com`, while their text does not name it.
    const terminated = /^[/^?#]/.test(patternHost.rest);

    return !terminated && (hostname.startsWith(host) || hostname.includes(`.${host}`))
        ? 'unknown'
        : 'other';
};

/**
 * Builds the `excludeMatches` pattern for one exception of the host.
 *
 * @param patternHost Host part of the pattern.
 * @param hostname Hostname the registration is for.
 * @param caseSensitive Whether the rule carries `$match-case`.
 *
 * @returns Match pattern, or `undefined` when the pattern cannot be expressed
 * (a host-wide exception, a wildcard path, a query, a regexp).
 */
const toExcludePattern = (
    patternHost: PatternHost,
    hostname: string,
    caseSensitive: boolean,
): string | undefined => {
    const path = patternHost.rest;
    if (!MATCH_PATTERN_PATH.test(path)) {
        return undefined;
    }

    // `$match-case` makes the engine compare the whole URL case-sensitively.
    // The exclusion names the hostname of the registration, which is
    // lowercased, so an uppercase spelling in the pattern would exclude a page
    // the engine allows.
    if (caseSensitive && patternHost.host !== patternHost.host.toLowerCase()) {
        return undefined;
    }

    // The browser compares the path of a match pattern case-sensitively and
    // the engine does not unless the rule has `$match-case` (probed in a
    // browser: `/Ads` does not exclude `/ads`). An uppercase path would match
    // no realistic page, so it keeps the host dynamic; a lowercase path still
    // misses an uppercase spelling of the same page, which is the accepted gap
    // listed in the README.
    if (!caseSensitive && /[A-Z]/.test(path)) {
        return undefined;
    }

    // The engine matches the pattern as `host` followed by the path, and the
    // registration covers the host only: the exclusion is anchored to it. A
    // scheme-anchored exception keeps its scheme, so the other scheme — where
    // the engine does not disable JS — is not excluded.
    return `${patternHost.scheme}://${hostname}${path}*`;
};

/**
 * Parses the candidate rules out of the sources: allowlist rules that can
 * win one of the two slots the JS bit depends on.
 *
 * @param sources Candidate lines of the enabled filters.
 *
 * @returns Parsed candidate rules.
 */
const collectCandidates = (sources: readonly ExceptionSource[]): Candidate[] => {
    const candidates: Candidate[] = [];

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

                candidates.push({ rule, writtenText: line });
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
 * One predicate decides both questions — "does the rule reach the host" and
 * "can the reach be expressed as an exclusion" — for disabling and keeping
 * rules alike: a rule that reaches a page of the host and cannot be pinned to
 * its name makes the host dynamic instead of being dropped.
 *
 * @param candidates Candidate rules of all enabled filters.
 * @param hostname Hostname to build exclusions for.
 *
 * @returns Exclusion patterns of the host, or the reason it stays dynamic.
 */
const buildHostExclusions = (
    candidates: readonly Candidate[],
    hostname: string,
): {
    patterns: string[];
    dynamic?: string;
    unanchored?: string[];
} => {
    const writtenTextByRule = new Map<NetworkRule, string>();
    for (const { rule, writtenText } of candidates) {
        writtenTextByRule.set(rule, writtenText);
    }

    const rules = candidates.map((candidate) => candidate.rule);

    const rootUrl = getPreregisteredRootUrl(hostname);

    const cosmeticRequest = createPreregisteredPageRequest(hostname);
    const documentRequest = new Request(rootUrl, '', RequestType.Document);

    const cosmeticRules = rules.filter((rule) => rule.hasCosmeticOption()
        && rule.matchModifiers(cosmeticRequest));
    // The domains table returns nothing for a request without a source, so
    // its rules can never win the document slot of a main frame.
    const documentRules = rules.filter((rule) => rule.isDocumentLevelAllowlistRule()
        && !rule.isInDomainsTable()
        && rule.matchModifiers(documentRequest));

    // `$badfilter` cancels its counterpart within the rule set that matched
    // the request, and compares the written text: the scan parses the list
    // itself, so it has to pass the original line, not the converted one.
    // The call does not mutate its argument.
    const resolveWrittenText = (rule: NetworkRule): string | null => writtenTextByRule.get(rule) ?? null;
    const activeCosmeticRules = MatchingResult.removeBadfilterRules(cosmeticRules, resolveWrittenText);
    const activeDocumentRules = MatchingResult.removeBadfilterRules(documentRules, resolveWrittenText);

    const reaching = rules
        .filter((rule) => activeCosmeticRules.includes(rule) || activeDocumentRules.includes(rule))
        .filter((rule) => matchesHostScope(rule.getPattern(), hostname));

    const disabling: NetworkRule[] = [];
    const keeping: NetworkRule[] = [];
    const unanchored: string[] = [];

    const writtenTextOf = (rule: NetworkRule): string => writtenTextByRule.get(rule) ?? rule.getPattern();

    for (const rule of reaching) {
        const text = writtenTextOf(rule);
        const patternHost = parsePatternHost(rule.getPattern());

        // A pattern that names no host can still match every URL: `@@$document`
        // and `@@$jsinject` decide every page of every host, so no
        // registration of any host is safe there.
        if (!patternHost) {
            if (rule.getPattern() === '' || rule.getPattern() === '*') {
                return {
                    patterns: [],
                    dynamic: `${text}: the exception matches every URL`,
                };
            }

            // A host-less pattern is a substring search: it may match a page
            // of the host, but no exclusion can express it. Reported for the
            // debug log; the owner accepted the pages it covers.
            // The extension generates such a rule for its own allowlist
            // (`@@///(www\.)?host/$document,important`): it names no host but
            // matches the root page, so the host cannot stay preregistered.
            if (reachesRootPage(rule, hostname)) {
                return {
                    patterns: [],
                    dynamic: `${text}: the exception names no host but matches the page`,
                    unanchored,
                };
            }

            unanchored.push(text);
            continue;
        }

        const scope = resolveScope(patternHost, hostname);

        // A pattern that reaches the host but cannot be anchored to its name
        // (a wildcard or a truncated host part) may decide a page of the
        // host, and no exclusion can express it.
        if (scope === 'unknown') {
            return {
                patterns: [],
                dynamic: `${text}: the pattern reaches the host but is not anchored to its name`,
            };
        }

        if (scope === 'other') {
            continue;
        }

        if (!rule.isOptionEnabled(NetworkRuleOption.Jsinject)) {
            keeping.push(rule);
            continue;
        }

        // A rule that covers every URL of the host would exclude the whole
        // registration: the host then stays on the dynamic path, which is the
        // same thing without a registration to maintain.
        if (patternHost.rest === '' || patternHost.rest === '^') {
            return { patterns: [], dynamic: text };
        }

        disabling.push(rule);
    }

    if (disabling.length === 0) {
        return { patterns: [], unanchored };
    }

    // An exception that keeps JS injection on and outranks a disabling one
    // would win on the same page: the registration cannot tell which page a
    // priority decides, so the host stays dynamic.
    const lowestDisablingPriority = Math.min(...disabling.map((rule) => rule.getPriorityWeight()));
    const shield = keeping.find((rule) => rule.getPriorityWeight() >= lowestDisablingPriority);
    if (shield) {
        return {
            patterns: [],
            dynamic: `${writtenTextOf(shield)}: a higher-ranked exception keeps JS injection on`,
            unanchored,
        };
    }

    const patterns = new Set<string>();

    for (const rule of disabling) {
        const text = writtenTextOf(rule);
        const patternHost = parsePatternHost(rule.getPattern());

        // `parsePatternHost` above saw the same pattern: it is not undefined.
        const pattern = patternHost
            ? toExcludePattern(patternHost, hostname, rule.isOptionEnabled(NetworkRuleOption.MatchCase))
            : undefined;

        if (!pattern) {
            return {
                patterns: [],
                dynamic: `${text}: the exception cannot be expressed as an excludeMatches pattern`,
                unanchored,
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
        return {
            exclusions,
            dynamicHosts,
            unanchoredExceptions: [],
        };
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
