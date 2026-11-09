import { NetworkRule, type Request } from '@adguard/tsurlfilter';

import { convertRuleLine, isExceptionCandidateLine, splitFilterLines } from './filter-lines';
import { hashString } from './hasher';
import { matchesHostScope } from './host-scope';
import { createPreregisteredPageRequest } from './root-request';

/**
 * A filter list together with the id it belongs to.
 */
export type PreregisteredFilterList = {
    /**
     * Filter (ruleset) id.
     */
    filterId: number;

    /**
     * Filter list content as the engine loads it.
     */
    content: string;
};

/**
 * A covered hostname with the synthetic request the page gate decides on.
 */
type HostScope = {
    /**
     * Covered hostname.
     */
    hostname: string;

    /**
     * Document request the gate decides on.
     */
    request: Request;
};

/**
 * Builds the scope entries once per fingerprint, so a rule is not re-checked
 * with a new request object for every hostname.
 *
 * @param hostnames Covered hostnames.
 *
 * @returns Hostname with the document request the gate decides on.
 */
const toHostScopes = (hostnames: readonly string[]): HostScope[] => hostnames.map((hostname) => ({
    hostname,
    request: createPreregisteredPageRequest(hostname),
}));

/**
 * Describes the page exceptions of one raw filter line that can reach at least
 * one of the given hostnames.
 *
 * The line is converted the way the engine's filter-list reader converts it,
 * so a list read before and after `FilterList.prepare()` yields the same
 * text. The whole converted text is the fingerprint input: every modifier
 * value the engine's verdict depends on is already in it, unlike a hand-picked
 * set of flags.
 *
 * @param line Raw filter line.
 * @param filterId Filter the line belongs to.
 * @param hosts Covered hostnames with their root requests.
 *
 * @returns Converted texts of the exception rules the line carries.
 */
const describePageExceptionRules = (
    line: string,
    filterId: number,
    hosts: readonly HostScope[],
): string[] => {
    const ruleTexts: string[] = [];

    for (const ruleText of convertRuleLine(line)) {
        let rule: NetworkRule;
        try {
            rule = new NetworkRule(ruleText, filterId);
        } catch {
            // A rule the engine drops cannot affect its decision.
            continue;
        }

        if (!rule.isAllowlist()) {
            continue;
        }

        if (!rule.hasCosmeticOption() && !rule.isDocumentLevelAllowlistRule()) {
            continue;
        }

        // An exception for a host that is not preregistered cannot change a
        // page of the generation, so an edit to it must not invalidate the
        // baked artifacts.
        //
        // The pattern scope alone is not enough: an unanchored pattern (`*`,
        // an empty one, a bare fragment) can occur inside a URL of any host,
        // so only the modifiers — `$domain` first of all — say whether the
        // rule can decide this host's page. The root request is the same one
        // the runtime exception check uses, and `matchModifiers()` does not
        // look at `$path`/`$url`, so both sides get the same answer.
        const pattern = rule.getPattern();
        const reachesHost = hosts.some(({ hostname, request }) => matchesHostScope(pattern, hostname)
            && rule.matchModifiers(request));
        if (!reachesHost) {
            continue;
        }

        ruleTexts.push(ruleText);
    }

    return ruleTexts;
};

/**
 * Lists every page exception of one filter as the rules the gate depends on.
 *
 * @param content Raw filter list text.
 * @param filterId Id of the filter list the text came from.
 * @param hosts Covered hostnames with their root requests.
 *
 * @returns Facts of the page exceptions found in the text.
 */
const collectExceptionFacts = (
    content: string,
    filterId: number,
    hosts: readonly HostScope[],
): string[] => {
    const facts: string[] = [];

    for (const line of splitFilterLines(content)) {
        // Same prefilter as the build: a page exception is an allowlist rule
        // with modifiers. What the modifiers are is decided by the engine's
        // parser below.
        if (!isExceptionCandidateLine(line)) {
            continue;
        }

        facts.push(...describePageExceptionRules(line, filterId, hosts));
    }

    return facts;
};

/**
 * Fingerprints the page exceptions a generation was baked from, per filter:
 * every allowlist rule with a cosmetic or document-level modifier that can
 * reach one of the covered hostnames.
 *
 * The build writes the map into the manifest, the runtime recomputes it for
 * the filters it has enabled. A filter that is disabled at runtime has no
 * conditions file registered either, so only the enabled filters are
 * compared: a mismatch for one of them means the lists changed since the
 * generation, and its baked exceptions no longer describe the engine.
 *
 * Converted rule text rather than raw text: one side reads the lists before
 * `FilterList.prepare()` and the other after, so the same rule may be spelled
 * differently. It is also the whole rule, so an edit to any modifier value
 * that changes the engine's verdict changes the fingerprint.
 *
 * Only the rules that can reach a covered hostname are hashed: base lists
 * change exceptions for other sites on almost every update, and such an edit
 * must not invalidate the baked artifacts of every host.
 *
 * @param lists Local filter lists with their ids.
 * @param hostnames Hostnames the generation covers.
 *
 * @returns Filter id → fingerprint of that filter's exceptions. Every given
 * list gets an entry, including an empty one.
 */
export const computePageExceptionsFingerprint = async (
    lists: readonly PreregisteredFilterList[],
    hostnames: readonly string[],
): Promise<Record<string, string>> => {
    const hosts = toHostScopes(hostnames);
    const facts = lists.map(({ filterId, content }) => ({
        filterId,
        facts: collectExceptionFacts(content, filterId, hosts),
    }));
    const hashes = await Promise.all(facts.map(async ({ facts: list }) => {
        // The engine's match order does not depend on the list order.
        list.sort();
        return hashString(list.join('\n'));
    }));

    return Object.fromEntries(
        facts.map(({ filterId }, index) => [String(filterId), hashes[index]]),
    );
};
