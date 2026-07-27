import { describe, expect, it } from 'vitest';

import {
    computeJsRuleHash,
    computeRuleHash,
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

describe('computeRuleHash', () => {
    const jsRule = (content: string, pathModifier?: { pattern: string }): any => ({
        isScriptlet: false,
        getContent: (): string => content,
        pathModifier,
    });

    const scriptletRule = (name: string, args: string[], pathModifier?: { pattern: string }): any => ({
        isScriptlet: true,
        getScriptletData: (): object => ({ params: { name, args } }),
        pathModifier,
    });

    it('produces the same hash for a JS rule with no $path modifier as computeJsRuleHash', async () => {
        expect(await computeRuleHash(jsRule('window._foo = 1;'))).toBe(
            await computeJsRuleHash('window._foo = 1;'),
        );
    });

    it('produces a different hash for a JS rule with a $path modifier than without one', async () => {
        const withoutPath = await computeRuleHash(jsRule('window._foo = 1;'));
        const withPath = await computeRuleHash(jsRule('window._foo = 1;', { pattern: '/watch' }));
        expect(withPath).not.toBe(withoutPath);
    });

    it('produces different hashes for the same JS rule body with different $path patterns', async () => {
        const hash1 = await computeRuleHash(jsRule('window._foo = 1;', { pattern: '/watch' }));
        const hash2 = await computeRuleHash(jsRule('window._foo = 1;', { pattern: '/embed' }));
        expect(hash1).not.toBe(hash2);
    });

    it('produces the same hash for a scriptlet rule with no $path modifier as computeScriptletHash', async () => {
        expect(await computeRuleHash(scriptletRule('set-cookie', ['a']))).toBe(
            await computeScriptletHash('set-cookie', ['a']),
        );
    });

    it('produces a different hash for a scriptlet rule with a $path modifier than without one', async () => {
        const withoutPath = await computeRuleHash(scriptletRule('set-cookie', ['a']));
        const withPath = await computeRuleHash(scriptletRule('set-cookie', ['a'], { pattern: '/watch' }));
        expect(withPath).not.toBe(withoutPath);
    });

    it('throws when a scriptlet rule has no scriptlet data', async () => {
        const badRule: any = { isScriptlet: true, getScriptletData: (): null => null };
        await expect(computeRuleHash(badRule)).rejects.toThrow();
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

    it('strips a leading www prefix', () => {
        expect(normalizeDomain('www.youtube.com')).toBe('youtube.com');
    });

    it('combines all normalizations at once', () => {
        expect(normalizeDomain('  .WWW.YouTube.Com. ')).toBe('youtube.com');
    });

    it('leaves an already-normalized domain unchanged', () => {
        expect(normalizeDomain('youtube.com')).toBe('youtube.com');
    });
});
