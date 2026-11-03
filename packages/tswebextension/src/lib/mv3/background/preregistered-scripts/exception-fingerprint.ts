/**
 * Copyright (c) 2015-2026 Adguard Software Ltd.
 *
 * @file
 * This file is part of AdGuard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * AdGuard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdGuard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdGuard Browser Extension. If not, see <http://www.gnu.org/licenses/>.
 */

import { RawRuleConverter } from '@adguard/agtree';
import {
    MASK_ALLOWLIST,
    NetworkRule,
    NetworkRuleOption,
    OPTIONS_DELIMITER,
} from '@adguard/tsurlfilter';

import { hashString } from './hasher';

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
 * Line breaks the engine's filter list reader recognizes.
 *
 * @see tsurlfilter `findNextLineBreakIndex`.
 */
const LINE_BREAK = /\r\n|\r|\n|\f/;

/**
 * Describes the page-exception facts of one raw filter line, if it is one.
 *
 * The line is converted the way the engine's filter-list reader converts it,
 * so a list read before and after `FilterList.prepare()` yields the same
 * facts.
 *
 * @param line Raw filter line.
 * @param filterId Filter the line belongs to.
 *
 * @returns Facts of the exception rules the line carries, empty when the line
 * is not a page exception.
 */
const describePageExceptionRules = (
    line: string,
    filterId: number,
): string[] => {
    let ruleTexts: string[];
    try {
        ruleTexts = RawRuleConverter.convertToAdg(line).result;
    } catch {
        ruleTexts = [line];
    }

    const facts: string[] = [];

    for (const ruleText of ruleTexts) {
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

        const cosmetic = rule.hasCosmeticOption();
        const documentLevel = rule.isDocumentLevelAllowlistRule();
        if (!cosmetic && !documentLevel) {
            continue;
        }

        facts.push([
            filterId,
            rule.getPattern(),
            rule.getPriorityWeight(),
            cosmetic ? 1 : 0,
            documentLevel ? 1 : 0,
            rule.isOptionEnabled(NetworkRuleOption.Jsinject) ? 1 : 0,
        ].join('|'));
    }

    return facts;
};

/**
 * Lists every page exception of one filter as a set of comparable facts.
 *
 * @param content Raw filter list text.
 * @param filterId Id of the filter list the text came from.
 *
 * @returns Facts of the page exceptions found in the text.
 */
const collectExceptionFacts = (content: string, filterId: number): string[] => {
    const facts: string[] = [];

    for (const line of content.split(LINE_BREAK)) {
        // Same prefilter as the build: a page exception is an allowlist rule
        // with modifiers. What the modifiers are is decided by the engine's
        // parser below.
        if (!line.includes(MASK_ALLOWLIST) || !line.includes(OPTIONS_DELIMITER)) {
            continue;
        }

        facts.push(...describePageExceptionRules(line, filterId));
    }

    return facts;
};

/**
 * Fingerprints the page exceptions a generation was baked from, per filter:
 * every allowlist rule with a cosmetic or document-level modifier, by the
 * facts the page gate depends on.
 *
 * The build writes the map into the manifest, the runtime recomputes it for
 * the filters it has enabled. A filter that is disabled at runtime has no
 * conditions file registered either, so only the enabled filters are
 * compared: a mismatch for one of them means the lists changed since the
 * generation, and its baked exceptions no longer describe the engine.
 *
 * Parsed facts rather than raw text: one side reads the lists before
 * `FilterList.prepare()` and the other after, so the same rule may be spelled
 * differently — the fingerprint compares what the engine parsed it into.
 *
 * @param lists Local filter lists with their ids.
 *
 * @returns Filter id → fingerprint of that filter's exceptions. Every given
 * list gets an entry, including an empty one.
 */
export const computePageExceptionsFingerprint = async (
    lists: readonly PreregisteredFilterList[],
): Promise<Record<string, string>> => {
    const facts = lists.map(({ filterId, content }) => ({
        filterId,
        facts: collectExceptionFacts(content, filterId),
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
