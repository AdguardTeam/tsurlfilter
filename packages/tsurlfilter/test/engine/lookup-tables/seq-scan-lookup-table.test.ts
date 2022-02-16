import {
    NetworkRule, RequestType,
} from '../../../src';
import { Request } from '../../../src/request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { SeqScanLookupTable } from '../../../src/engine/lookup-tables/seq-scan-lookup-table';

describe('Sequence-scan Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const table = new SeqScanLookupTable();

        expect(table.addRule(new NetworkRule('path', 0))).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);

        expect(table.addRule(new NetworkRule('||*example.org^', 0))).toBeTruthy();
        expect(table.getRulesCount()).toBe(2);

        expect(table.addRule(new NetworkRule('||example.org^', 0))).toBeTruthy();
        expect(table.getRulesCount()).toBe(3);

        expect(table.addRule(new NetworkRule('||example.net/path', 0))).toBeTruthy();
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
