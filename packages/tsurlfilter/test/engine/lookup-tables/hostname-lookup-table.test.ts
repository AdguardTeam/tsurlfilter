import { describe, it, expect } from 'vitest';

import { RequestType } from '../../../src/request-type';
import { Request } from '../../../src/request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { HostnameLookupTable } from '../../../src/engine/lookup-tables/hostname-lookup-table';
import { tokenize } from '../../../src/filterlist/tokenize';

describe('Hostname Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = new HostnameLookupTable(ruleStorage);

        expect(table.addRule(tokenize('path')!, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(tokenize('||*example.org^')!, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(tokenize('||example^')!, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(tokenize('||example.^')!, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(tokenize('||example.org^')!, 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);

        expect(table.addRule(tokenize('||example.net/path')!, 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(2);
    });

    it('matches rules from lookup table', () => {
        const rules = [
            'path',
            '||*example.net^',
            '||example.org^',
            '||example.com/path',
        ];

        const ruleStorage = createRuleStorage(rules);
        const table = new HostnameLookupTable(ruleStorage);

        fillLookupTable(table, ruleStorage);
        expect(table.getRulesCount()).toBe(2);

        expect(table.matchAll(new Request('http://other.com/', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new Request('http://other.com/path', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new Request('http://example.net/path', '', RequestType.Document))).toHaveLength(0);

        expect(table.matchAll(new Request('http://example.com/path', '', RequestType.Document))).toHaveLength(1);
        expect(
            table.matchAll(new Request('http://example.com/path', 'http://example.com', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new Request('http://example.org/path', 'http://example.org', RequestType.Document)),
        ).toHaveLength(1);
    });
});
