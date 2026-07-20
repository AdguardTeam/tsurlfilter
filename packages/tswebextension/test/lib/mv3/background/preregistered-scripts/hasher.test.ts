import { describe, expect, it } from 'vitest';

import {
    computeJsRuleHash,
    computeScriptletHash,
    hashString,
    normalizeDomain,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/hasher';

describe('hashString', () => {
    it('produces a 16-character lowercase hex digest (truncated SHA-256)', async () => {
        const hash = await hashString('hello');
        expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('is deterministic for the same input', async () => {
        expect(await hashString('same')).toBe(await hashString('same'));
    });

    it('produces different hashes for different inputs', async () => {
        expect(await hashString('a')).not.toBe(await hashString('b'));
    });
});

describe('computeScriptletHash / computeJsRuleHash', () => {
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

    it('produces the same JS rule hash for the same body', async () => {
        const hash1 = await computeJsRuleHash('window._foo = 1;');
        const hash2 = await computeJsRuleHash('window._foo = 1;');
        expect(hash1).toBe(hash2);
    });

    it('produces different JS rule hashes for different bodies', async () => {
        const hash1 = await computeJsRuleHash('window._foo = 1;');
        const hash2 = await computeJsRuleHash('window._foo = 2;');
        expect(hash1).not.toBe(hash2);
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
