import { NetworkRule } from '@adguard/tsurlfilter';

import { convertRuleLine, isExceptionCandidateLine, splitFilterLines } from './filter-lines';
import { hashString } from './hasher';
import { matchesHostScope } from './host-scope';

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
 * @param hostnames Preconfigured hostnames the generation covers.
 *
 * @returns Converted texts of the exception rules the line carries.
 */
const describePageExceptionRules = (
    line: string,
    filterId: number,
    hostnames: readonly string[],
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
        const pattern = rule.getPattern();
        if (!hostnames.some((hostname) => matchesHostScope(pattern, hostname))) {
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
 * @param hostnames Preconfigured hostnames the generation covers.
 *
 * @returns Facts of the page exceptions found in the text.
 */
const collectExceptionFacts = (
    content: string,
    filterId: number,
    hostnames: readonly string[],
): string[] => {
    const facts: string[] = [];

    for (const line of splitFilterLines(content)) {
        // Same prefilter as the build: a page exception is an allowlist rule
        // with modifiers. What the modifiers are is decided by the engine's
        // parser below.
        if (!isExceptionCandidateLine(line)) {
            continue;
        }

        facts.push(...describePageExceptionRules(line, filterId, hostnames));
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
    const facts = lists.map(({ filterId, content }) => ({
        filterId,
        facts: collectExceptionFacts(content, filterId, hostnames),
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
