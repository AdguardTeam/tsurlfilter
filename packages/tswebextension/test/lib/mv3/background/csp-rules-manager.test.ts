import { describe, expect, it } from 'vitest';

import { type IFilter, isUnavailableFilterSourceError } from '@adguard/dnr-converter';

import { CspRulesManager } from '../../../../src/lib/mv3/background/csp-rules-manager';
import { createFilter } from '../helpers';

describe('CspRulesManager', () => {
    it('resolves exceptions globally and preserves the positive rule scope', async () => {
        const staticFilter = createFilter([
            "$csp=img-src 'none'",
        ], 1);
        const dynamicFilter = createFilter([
            "@@||cdn.example.com^$csp=img-src 'none'",
        ], 10_000);

        const result = await CspRulesManager.build([staticFilter], [dynamicFilter]);

        expect(result.staticRules).toHaveLength(1);
        expect(result.staticRules[0].condition.excludedRequestDomains).toEqual(['cdn.example.com']);
        expect(result.dynamicRules).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
    });

    it('keeps dynamic positive rules in the dynamic scope', async () => {
        const dynamicFilter = createFilter([
            "||example.com^$csp=script-src 'none'",
        ], 10_000);

        const result = await CspRulesManager.build([], [dynamicFilter]);

        expect(result.staticRules).toHaveLength(0);
        expect(result.dynamicRules).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
    });

    it('finds the rule source without splitting the filter text into lines', async () => {
        // The parser also breaks lines on `\f`, while a text-based lookup
        // splits on `\n` only, so reading the text would fail to find the
        // source of the rule and fail the whole configuration.
        const dynamicFilter = createFilter([
            "! comment\f||example.com^$csp=script-src 'none'",
        ], 10_000);

        const result = await CspRulesManager.build([], [dynamicFilter]);

        expect(result.dynamicRules).toHaveLength(1);
        expect(result.staticRules).toHaveLength(0);
    });

    it('reports unsupported exceptions from dynamic filters as dynamic errors', async () => {
        const staticFilter = createFilter([
            "||example.com^$csp=script-src 'none'",
        ], 1);
        const dynamicFilter = createFilter([
            "@@||example.com/path$csp=script-src 'none'",
        ], 10_000);

        const result = await CspRulesManager.build([staticFilter], [dynamicFilter]);

        expect(result.errors).toHaveLength(1);
        expect(result.dynamicErrors).toEqual(result.errors);
    });

    it('keeps static CSP errors out of dynamic user-rule diagnostics', async () => {
        const staticFilter = createFilter([
            "$csp=script-src 'none'",
            "@@||example.com/path$csp=script-src 'none'",
        ], 1);

        const result = await CspRulesManager.build([staticFilter], []);

        expect(result.errors).toHaveLength(1);
        expect(result.dynamicErrors).toHaveLength(0);
    });

    it('reports a parse error of a dynamic CSP rule as a dynamic error', async () => {
        const dynamicFilter = createFilter([
            "||example.com^$csp=script-src 'none',removeparam=x",
        ], 10_000);

        const result = await CspRulesManager.build([], [dynamicFilter]);

        expect(result.errors).toHaveLength(1);
        expect(result.dynamicErrors).toEqual(result.errors);
    });

    it('leaves a $badfilter line to the regular pass', async () => {
        // `$badfilter` is not a CSP modifier any more, so the CSP pass does not
        // select such a line and the regular conversion reports its errors.
        const dynamicFilter = createFilter([
            '||example.com^$badfilter,unknown',
        ], 10_000);

        const result = await CspRulesManager.build([], [dynamicFilter]);

        expect(result.errors).toHaveLength(0);
        expect(result.dynamicErrors).toHaveLength(0);
        expect(result.dynamicRules).toHaveLength(0);
    });

    it('keeps parse errors of static CSP rules out of dynamic errors', async () => {
        const staticFilter = createFilter([
            "||example.com^$csp=script-src 'none',removeparam=x",
        ], 1);

        const result = await CspRulesManager.build([staticFilter], []);

        expect(result.errors).toHaveLength(1);
        expect(result.dynamicErrors).toHaveLength(0);
    });

    it('splits CSP errors by the filter scope', async () => {
        const staticFilter = createFilter([
            "||example.com^$csp=script-src 'none',removeparam=x",
        ], 1);
        const dynamicFilter = createFilter([
            "||example.net^$csp=script-src 'none',removeparam=x",
        ], 10_000);

        const result = await CspRulesManager.build([staticFilter], [dynamicFilter]);

        expect(result.errors).toHaveLength(2);
        expect(result.staticErrors).toHaveLength(1);
        expect(result.dynamicErrors).toHaveLength(1);
        expect(result.staticErrors[0]).not.toBe(result.dynamicErrors[0]);
    });

    it('reports an unreadable static filter in the static channel', async () => {
        const unreadableFilter: IFilter = {
            getId: () => 3,
            getRuleByIndex: async () => '',
            getContent: async () => {
                throw new Error('filter source is offline');
            },
            unloadContent: () => {},
        };

        const result = await CspRulesManager.build([unreadableFilter], []);

        expect(result.staticErrors).toHaveLength(1);
        expect(result.dynamicErrors).toHaveLength(0);
        expect(isUnavailableFilterSourceError(result.staticErrors[0])).toBe(true);
        // The caller keeps the rules of such a filter from its own ruleset.
        expect(result.unreadableStaticFilterIds).toEqual([3]);
    });

    it('reports an unreadable dynamic filter in the dynamic channel', async () => {
        const unreadableFilter: IFilter = {
            getId: () => 10_005,
            getRuleByIndex: async () => '',
            getContent: async () => {
                throw new Error('filter source is offline');
            },
            unloadContent: () => {},
        };

        const result = await CspRulesManager.build([], [unreadableFilter]);

        expect(result.dynamicErrors).toHaveLength(1);
        expect(result.staticErrors).toHaveLength(0);
        expect(result.unreadableStaticFilterIds).toEqual([]);
    });
});
