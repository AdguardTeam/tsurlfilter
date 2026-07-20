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
    computeJsRuleHash,
    computeScriptletHash,
    hashString,
    normalizeDomain,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/hasher';

describe('hashString', () => {
    it('produces a 64-character lowercase hex SHA-256 digest', async () => {
        const hash = await hashString('hello');
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', async () => {
        expect(await hashString('same')).toBe(await hashString('same'));
    });

    it('produces different hashes for different inputs', async () => {
        expect(await hashString('a')).not.toBe(await hashString('b'));
    });
});

describe('computeScriptletHash / computeJsRuleHash', () => {
    it('produces different hashes for a scriptlet and a JS rule with the same underlying text', async () => {
        // Namespace prefixes (`s:` / `j:`) must prevent cross-kind collisions,
        // since both hash sets are merged into the same runtime dedup Set.
        const name = 'foo';
        const args: string[] = [];
        const scriptletHash = await computeScriptletHash(name, args);
        const jsHash = await computeJsRuleHash(name + JSON.stringify(args));

        expect(scriptletHash).not.toBe(jsHash);
    });

    it('produces different scriptlet hashes for different args', async () => {
        const hash1 = await computeScriptletHash('foo', ['a']);
        const hash2 = await computeScriptletHash('foo', ['b']);
        expect(hash1).not.toBe(hash2);
    });

    it('produces the same scriptlet hash for the same name/args', async () => {
        const hash1 = await computeScriptletHash('foo', ['a', 'b']);
        const hash2 = await computeScriptletHash('foo', ['a', 'b']);
        expect(hash1).toBe(hash2);
    });
});

describe('normalizeDomain', () => {
    it('lower-cases the domain', () => {
        expect(normalizeDomain('YouTube.com')).toBe('youtube.com');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeDomain('  youtube.com  ')).toBe('youtube.com');
    });

    it('strips leading and trailing dots', () => {
        expect(normalizeDomain('.youtube.com.')).toBe('youtube.com');
    });

    it('combines all normalizations at once', () => {
        expect(normalizeDomain('  .YouTube.Com. ')).toBe('youtube.com');
    });

    it('leaves an already-normalized domain unchanged', () => {
        expect(normalizeDomain('youtube.com')).toBe('youtube.com');
    });
});
