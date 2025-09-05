import { describe, expect, it } from 'vitest';

import { SeqScanLookupTable } from '../../../src/engine/lookup-tables/seq-scan-lookup-table';
import { RuleStorage } from '../../../src/filterlist/rule-storage';
import { StringRuleList } from '../../../src/filterlist/string-rule-list';
import { Request } from '../../../src/request';
import { RequestType } from '../../../src/request-type';

import { createRuleStorage, fillLookupTable } from './lookup-table';

describe('Sequence-scan Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const storage = new RuleStorage([
            new StringRuleList(0, [
                'path',
                '||*example.net^',
                '||example.org^',
                '||example.com/path',
            ].join('\n'), false, false, false),
        ]);

        const table = new SeqScanLookupTable(storage);

        fillLookupTable(table, storage);
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
        const table = new SeqScanLookupTable(ruleStorage);

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
