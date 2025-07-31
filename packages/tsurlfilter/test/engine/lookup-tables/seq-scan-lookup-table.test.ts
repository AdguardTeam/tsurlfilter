import { describe, expect, it } from 'vitest';

import { SeqScanLookupTable } from '../../../src/engine/lookup-tables/seq-scan-lookup-table';
import { Request } from '../../../src/request';
import { RequestType } from '../../../src/request-type';
import { createNetworkRule } from '../../helpers/rule-creator';

import { createRuleStorage, fillLookupTable } from './lookup-table';

describe('Sequence-scan Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const table = new SeqScanLookupTable();

        expect(table.addRule(createNetworkRule('path', 0))).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);

        expect(table.addRule(createNetworkRule('||*example.org^', 0))).toBeTruthy();
        expect(table.getRulesCount()).toBe(2);

        expect(table.addRule(createNetworkRule('||example.org^', 0))).toBeTruthy();
        expect(table.getRulesCount()).toBe(3);

        expect(table.addRule(createNetworkRule('||example.net/path', 0))).toBeTruthy();
        expect(table.getRulesCount()).toBe(4);
    });

    it('matches rules from lookup table', () => {
        const rules = [
            'path',
            '||*example.net^',
            '||example.org^',
            '||example.com/path',
        ];

        const ruleStorage = createRuleStorage(rules);
        const table = new SeqScanLookupTable();

        fillLookupTable(table, ruleStorage);
        expect(table.getRulesCount()).toBe(4);

        expect(table.matchAll(new Request('http://other.com/', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new Request('http://other.com/path', '', RequestType.Document))).toHaveLength(1);
        expect(table.matchAll(new Request('http://example.net/path', '', RequestType.Document))).toHaveLength(2);
        expect(table.matchAll(new Request('http://example.com/path', '', RequestType.Document))).toHaveLength(2);

        expect(
            table.matchAll(new Request('http://example.com/path', 'http://example.com', RequestType.Document)),
        ).toHaveLength(2);
        expect(
            table.matchAll(new Request('http://example.org/path', 'http://example.org', RequestType.Document)),
        ).toHaveLength(2);
        expect(
            table.matchAll(new Request('http://test.com/path', 'http://example.org', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new Request('http://test.com/path', 'http://sub.example.org', RequestType.Document)),
        ).toHaveLength(1);
    });
});
