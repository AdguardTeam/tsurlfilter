import { describe, expect, it } from 'vitest';

import { TrieLookupTable } from '../../../src/engine/lookup-tables/trie-lookup-table';
import { getRuleParts, type NetworkRuleParts } from '../../../src/filterlist/rule-parts';
import { Request } from '../../../src/request';
import { RequestType } from '../../../src/request-type';

import { createRuleStorage, fillLookupTable } from './lookup-table';

describe('Trie Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = new TrieLookupTable(ruleStorage);

        expect(table.addRule(getRuleParts('http://p') as NetworkRuleParts, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(getRuleParts('shortcut') as NetworkRuleParts, 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);

        expect(table.addRule(getRuleParts('path') as NetworkRuleParts, 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(2);

        expect(table.addRule(getRuleParts('https://domain.com') as NetworkRuleParts, 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(3);

        // Rule shortcut is too short
        expect(table.addRule(getRuleParts('aa$app=com.mobile') as NetworkRuleParts, 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(3);
    });

    it('matches rules from lookup table', () => {
        const rules = [
            'path/one',
            'path/two',
            'path/three',
            'path/three/one',
        ];

        const ruleStorage = createRuleStorage(rules);
        const table = new TrieLookupTable(ruleStorage);

        fillLookupTable(table, ruleStorage);
        expect(table.getRulesCount()).toBe(4);

        expect(table.matchAll(new Request('http://other.com/', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new Request('http://example.com/path', '', RequestType.Document))).toHaveLength(0);

        expect(table.matchAll(new Request('http://example.com/path/one', '', RequestType.Document))).toHaveLength(1);
        expect(table.matchAll(new Request('http://example.com/path/two', '', RequestType.Document))).toHaveLength(1);
        expect(table.matchAll(new Request('http://example.com/path/three', '', RequestType.Document))).toHaveLength(1);
        expect(
            table.matchAll(new Request('http://example.com/path/three/one', '', RequestType.Document)),
        ).toHaveLength(2);
    });
});
