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
    OPTIONS_DELIMITER,
    Request,
    RequestType,
} from '@adguard/tsurlfilter';

import { matchesHostScope } from './host-scope';

/**
 * Line breaks the engine's filter list reader recognizes.
 *
 * @see tsurlfilter `findNextLineBreakIndex`.
 */
const LINE_BREAK = /\r\n|\r|\n|\f/;

/**
 * Keeps the lines that can carry a page exception: an allowlist rule with
 * modifiers. Used to avoid keeping whole runtime lists in memory.
 *
 * @param content Raw filter list text.
 *
 * @returns Candidate lines.
 */
export const collectExceptionLines = (content: string): string[] => {
    const lines: string[] = [];

    for (const line of content.split(LINE_BREAK)) {
        if (line.includes(MASK_ALLOWLIST) && line.includes(OPTIONS_DELIMITER)) {
            lines.push(line);
        }
    }

    return lines;
};

/**
 * Converts a raw rule line the way the engine's filter list does: on failure
 * the original line is kept.
 *
 * @param line Raw rule line.
 *
 * @returns Rule texts to parse.
 */
const convertLine = (line: string): string[] => {
    try {
        return RawRuleConverter.convertToAdg(line).result;
    } catch {
        return [line];
    }
};

/**
 * Collects the runtime page exceptions that can change the JS verdict of the
 * given hostnames.
 *
 * A page exception is an allowlist rule with a cosmetic or document-level
 * option: only such rules can win the `cosmeticExceptionRule` or
 * `documentRule` slot, which decides whether JS injection is disabled.
 * Blocking rules and cosmetic rules without these options cannot change that
 * verdict, so they do not count.
 *
 * `$path`/`$url` conditions are ignored: the page URL is unknown here, so a
 * rule that may apply to some URL of the host counts. Over-inclusion is the
 * safe direction — the host then keeps the dynamic path, where the engine
 * decides on the real URL.
 *
 * @param exceptionLines Candidate lines of the runtime-only lists (see
 * {@link collectExceptionLines}).
 * @param hostnames Hostnames to check.
 *
 * @returns Hostnames whose baked conditions cannot be trusted.
 */
export const findHostsWithRuntimeExceptions = (
    exceptionLines: readonly string[],
    hostnames: readonly string[],
): Set<string> => {
    const affected = new Set<string>();
    if (hostnames.length === 0) {
        return affected;
    }

    // Rules that can change the verdict, with their pattern scope.
    const rules: { rule: NetworkRule; pattern: string }[] = [];

    for (const line of exceptionLines) {
        for (const ruleText of convertLine(line)) {
            let rule: NetworkRule;
            try {
                rule = new NetworkRule(ruleText, 0);
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

            rules.push({ rule, pattern: rule.getPattern() });
        }
    }

    if (rules.length === 0) {
        return affected;
    }

    for (const hostname of hostnames) {
        const rootUrl = `https://${hostname}/`;
        // The gate only decides document requests, so the modifiers are
        // checked against one.
        const request = new Request(rootUrl, rootUrl, RequestType.Document);

        const affectsHost = rules.some(({ rule, pattern }) => matchesHostScope(pattern, hostname)
            && rule.matchModifiers(request));

        if (affectsHost) {
            affected.add(hostname);
        }
    }

    return affected;
};
