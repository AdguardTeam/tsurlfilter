import { describe, expect, it } from 'vitest';

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
});
