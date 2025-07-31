import { describe, expect, it } from 'vitest';

import { HostnameLookupTable } from '../../../src/engine-new/lookup-tables/hostname-lookup-table';
import { getRuleParts, type NetworkRuleParts } from '../../../src/filterlist/rule-parts';
import { Request } from '../../../src/request';
import { RequestType } from '../../../src/request-type';

import { createRuleStorage, fillLookupTable } from './lookup-table';

describe('Hostname Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = new HostnameLookupTable(ruleStorage);

        expect(table.addRule(getRuleParts('path') as NetworkRuleParts, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(getRuleParts('||*example.org^') as NetworkRuleParts, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(getRuleParts('||example^') as NetworkRuleParts, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(getRuleParts('||example.^') as NetworkRuleParts, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(getRuleParts('||example.org^') as NetworkRuleParts, 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);

        expect(table.addRule(getRuleParts('||example.net/path') as NetworkRuleParts, 0)).toBeTruthy();
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
