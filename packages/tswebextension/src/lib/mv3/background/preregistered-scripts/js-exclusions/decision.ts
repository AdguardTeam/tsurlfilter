import { type NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';

import { isDomainScopedToHost } from './candidates';
import { ANY_SCHEME } from './pattern';
import { type HostRequests } from './requests';
import { reachesRootPage } from './scope';
import { type Candidate, type PatternHost, Scope } from './types';

/**
 * A rule that disables JS injection on some page of the host.
 */
export interface Disabling {
    /**
     * The rule itself.
     */
    rule: NetworkRule;

    /**
     * Host part of its pattern.
     */
    patternHost: PatternHost;

    /**
     * The rule as written, used in the reason and by `$badfilter`.
     */
    writtenText: string;
}

/**
 * A rule that keeps JS injection on: it cannot decide a page, but it can
 * outrank a disabling one.
 */
export interface Keeping {
    /**
     * The rule itself.
     */
    rule: NetworkRule;

    /**
     * The rule as written, used in the reason.
     */
    writtenText: string;
}

/**
 * What one candidate decides for the host.
 */
export type Decision =
    /**
     * The host keeps the dynamic injection path, with the reason.
     */
    | { kind: 'dynamic'; reason: string }
    /**
     * The rule excludes some pages, and the reach is expressible.
     */
    | { kind: 'disabling'; patternHost: PatternHost }
    /**
     * The rule keeps JS on.
     */
    | { kind: 'keeping' }
    /**
     * The rule names no host and matches no page of this one: report only.
     */
    | { kind: 'unanchored' };

/**
 * Decides what one candidate means for the host.
 *
 * The order matters: a rule that keeps JS injection on cannot decide a page
 * whatever its pattern — the engine keeps JS on where such a rule wins the
 * cosmetic slot — so it is answered first, and only a rule that clears the JS
 * bit is classified by its reach.
 *
 * @param candidate Candidate rule.
 * @param scope How its pattern relates to the hostname.
 * @param requests Requests of the host.
 *
 * @returns What the rule decides (see {@link Decision}).
 */
export const decide = (candidate: Candidate, scope: Scope, requests: HostRequests): Decision => {
    const { rule, patternHost, writtenText: text } = candidate;

    // A rule that keeps JS injection on cannot decide a page on its own,
    // whatever its pattern: the engine keeps JS on where such a rule wins the
    // cosmetic slot. It only matters as a shield against a disabling rule, so
    // it never makes a host dynamic by itself, and a host-less
    // `$generichide,domain=…` rule of the base filter must not cost the host
    // its registration.
    if (!rule.isOptionEnabled(NetworkRuleOption.Jsinject)) {
        return { kind: 'keeping' };
    }

    // A pattern that names no host can still match every URL: `@@$document`
    // and `@@$jsinject` decide every page of every host, so no registration of
    // any host is safe there.
    if (!patternHost) {
        if (rule.getPattern() === '' || rule.getPattern() === '*') {
            return { kind: 'dynamic', reason: `${text}: the exception matches every URL` };
        }

        // `$domain` scopes the rule to some hosts, but the pattern is still a
        // substring: the same text can appear in the query of another page, so
        // an exclusion would be narrower than the rule's reach. The whole host
        // falls back, where the engine decides per page.
        if (isDomainScopedToHost(rule, requests.cosmetic)) {
            return {
                kind: 'dynamic',
                reason: `${text}: the exception names no host but its $domain list allows this host`,
            };
        }

        // The extension generates such a rule for its own allowlist: the host
        // pattern with `$document,important` (`createAllowlistRuleNode()` in
        // `@adguard/tsurlfilter`). It names no host but matches the page, so
        // the host cannot stay preregistered.
        if (reachesRootPage(rule, requests.rootPages)) {
            return {
                kind: 'dynamic',
                reason: `${text}: the exception names no host but matches the page`,
            };
        }

        return { kind: 'unanchored' };
    }

    // A pattern that reaches the host but cannot be anchored to its name (a
    // wildcard or a truncated host part) may decide a page of the host, and no
    // exclusion can express it.
    if (scope === Scope.Unknown) {
        return {
            kind: 'dynamic',
            reason: `${text}: the pattern reaches the host but is not anchored to its name`,
        };
    }

    // `''`, `'^'` and `'/'` are the three spellings of "every path" of the
    // host. A scheme-agnostic one would exclude the whole registration, so the
    // host stays on the dynamic path instead; a scheme-anchored one still
    // spares the other scheme, where the engine keeps JS on, and is read as
    // `/` before the pattern is built.
    const coversEveryPath = patternHost.rest === ''
        || patternHost.rest === '^'
        || patternHost.rest === '/';

    if (!coversEveryPath) {
        return { kind: 'disabling', patternHost };
    }

    if (patternHost.scheme === ANY_SCHEME) {
        return { kind: 'dynamic', reason: `${text}: the exception covers every URL of the host` };
    }

    return { kind: 'disabling', patternHost: { ...patternHost, rest: '/' } };
};
