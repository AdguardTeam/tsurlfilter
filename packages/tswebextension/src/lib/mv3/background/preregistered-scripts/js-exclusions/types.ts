import { type NetworkRule } from '@adguard/tsurlfilter';

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
     * Candidate lines of the filter as written in the list: `$badfilter`
     * compares the written text, so a converted line would not cancel its
     * counterpart (see {@link collectExceptionLines}).
     */
    lines: readonly string[];

    /**
     * Whether the engine drops the rules with an advanced modifier from this
     * filter: remote filters of an untrusted author are created with
     * `ignoreUnsafe: true`, so a rule with `$cookie`, `$replace` and the like
     * never reaches the engine (see `RuleStorage`).
     */
    unsafeIgnored?: boolean;
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
     * express, or an exception ranked at least as high that keeps JS
     * injection on.
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
export interface Candidate {
    /**
     * Parsed allowlist rule.
     */
    rule: NetworkRule;

    /**
     * Filter line the rule was parsed from.
     */
    writtenText: string;

    /**
     * Host part of the rule's pattern, or `undefined` when the pattern names
     * no host. Parsed once for all hostnames: the reach of a pattern is a
     * lexical question, and the scan asks it for every host.
     */
    patternHost: PatternHost | undefined;

    /**
     * Whether the engine files the rule in the domains table. Neither the
     * request nor the hostname can change that, and `getRuleTable()` re-runs
     * the table predicates, so the answer is computed once for all hosts.
     */
    inDomainsTable: boolean;
}

/**
 * A candidate whose pattern reaches the host, with how it reaches.
 */
export interface ScopedCandidate {
    /**
     * Candidate rule and the line it was written as.
     */
    candidate: Candidate;

    /**
     * How the pattern relates to the hostname.
     */
    scope: Scope;
}

/**
 * Host part of a pattern together with what follows it.
 */
export interface PatternHost {
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
     * Scheme of an anchored pattern, or `ANY_SCHEME`. A wildcard scheme
     * (`|*://`, `|http*://`, `|h*ps://`) is narrowed to the document schemes
     * it matches, so the exclusion names a concrete scheme or `*`, never a
     * partial glob such as `h*`.
     */
    scheme: string;

    /**
     * Scheme as the pattern spells it, before narrowing: a `$match-case`
     * pattern compares it case-sensitively, so the written spelling decides
     * whether an exclusion can be built at all.
     */
    rawScheme: string;

    /**
     * Whether the pattern anchors the host. A bare `host/path` pattern is a
     * substring search instead, so its host token can also occur inside a
     * longer host or the query of another site.
     */
    anchored: boolean;
}

/**
 * What a pattern can reach, read once per rule.
 */
export enum PatternReach {
    /**
     * The pattern names a host.
     */
    Host = 'host',

    /**
     * The pattern names no host but can match any URL: a regexp, a bare path
     * or a plain substring.
     */
    Hostless = 'hostless',

    /**
     * No http(s) document can match the pattern: `|ftp://…`, `|//…`, `|/…`.
     */
    Unreachable = 'unreachable',
}

/**
 * What a pattern can reach.
 */
export type PatternParse =
    /**
     * The pattern names a host.
     */
    | { kind: PatternReach.Host; host: PatternHost }
    /**
     * The pattern names no host but can match any URL.
     */
    | { kind: PatternReach.Hostless }
    /**
     * No http(s) document can match the pattern.
     */
    | { kind: PatternReach.Unreachable };

/**
 * How a candidate rule relates to the registered hostname.
 */
export enum Scope {
    /**
     * The pattern is pinned to the hostname.
     */
    Host = 'host',

    /**
     * The pattern reaches the hostname but cannot be anchored to its name.
     */
    Unknown = 'unknown',

    /**
     * The pattern belongs to another site.
     */
    Other = 'other',

    /**
     * The pattern names no host at all.
     */
    Hostless = 'hostless',
}
