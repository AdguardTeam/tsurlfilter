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

import { describe, expect, it } from 'vitest';

import {
    collectExceptionLines,
    findHostsWithRuntimeExceptions,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/runtime-exceptions';

const HOSTNAMES = ['youtube.com', 'www.youtube.com', 'example.org'];

/**
 * Runs the check over raw runtime lists.
 *
 * @param rules Rule texts of the runtime-only lists.
 * @param hostnames Hostnames to check.
 *
 * @returns Hostnames the rules can affect.
 */
const affected = (rules: string[], hostnames: string[] = HOSTNAMES): string[] => (
    [...findHostsWithRuntimeExceptions(collectExceptionLines(rules.join('\n')), hostnames)].sort()
);

describe('findHostsWithRuntimeExceptions', () => {
    it('flags the host of a document exception and its subdomains', () => {
        expect(affected(['@@||youtube.com/feed/trending$document']))
            .toEqual(['www.youtube.com', 'youtube.com']);
    });

    it('flags a higher-priority cosmetic exception', () => {
        // It outranks the baked `$document` entry, so the engine would keep
        // JS injection enabled on the whole host.
        expect(affected(['@@||youtube.com^$generichide,important']))
            .toEqual(['www.youtube.com', 'youtube.com']);
    });

    it('flags a `$badfilter` of a baked exception', () => {
        // `@@` with a document option still counts, whatever `badfilter` does
        // to the target rule.
        expect(affected(['@@||youtube.com^$document,badfilter']))
            .toEqual(['www.youtube.com', 'youtube.com']);
    });

    it('flags a domain-scoped exception of the host', () => {
        expect(affected(['@@*$jsinject,domain=youtube.com']))
            .toEqual(['www.youtube.com', 'youtube.com']);
    });

    it('flags a path-scoped exception, because the page URL is unknown', () => {
        expect(affected(['@@||youtube.com/embed/$jsinject']))
            .toEqual(['www.youtube.com', 'youtube.com']);
    });

    it('keeps a host the rule cannot reach', () => {
        expect(affected(['@@||youtube.com/feed$document'])).not.toContain('example.org');
        expect(affected(['@@||elsewhere.test^$document'])).toEqual([]);
    });

    it('ignores an exception whose `$domain` excludes the host', () => {
        expect(affected(['@@*$jsinject,domain=example.org'])).toEqual(['example.org']);
    });

    it('counts an allowlist rule that can win the document slot', () => {
        // `$urlblock` carries no cosmetic option, but it is a document-level
        // allowlist rule: with `$important` it outranks the baked `$document`
        // entry and re-enables JS injection.
        expect(affected(['@@||youtube.com^$urlblock,important']))
            .toEqual(['www.youtube.com', 'youtube.com']);
    });

    it('ignores rules that cannot change the JS verdict', () => {
        // `$stealth` is allowlist-only and touches neither cosmetic nor
        // document-level options, blocking rules cannot win a cosmetic slot,
        // and a hiding rule is not a network exception.
        expect(affected([
            '@@||youtube.com^$stealth',
            '||ads.test^',
            'youtube.com##.banner',
        ])).toEqual([]);
    });

    it('ignores lines the engine would drop', () => {
        expect(affected(['@@||youtube.com^$unknown-option', '! comment @@ $'])).toEqual([]);
    });

    it('returns nothing without hosts or rules', () => {
        expect(affected([], HOSTNAMES)).toEqual([]);
        expect(affected(['@@||youtube.com^$document'], [])).toEqual([]);
    });
});
