import { describe, it, expect } from 'vitest';

import { RequestType } from '../../../src';
import { Request } from '../../../src/request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { TrieLookupTable } from '../../../src/engine/lookup-tables/trie-lookup-table';
import { createNetworkRule } from '../../helpers/rule-creator';

describe('Trie Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = new TrieLookupTable(ruleStorage);

        expect(table.addRule(createNetworkRule('http://p', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('shortcut', 0), 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);

        expect(table.addRule(createNetworkRule('path', 0), 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(2);

        expect(table.addRule(createNetworkRule('https://domain.com', 0), 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(3);

        // Rule shortcut is too short
        expect(table.addRule(createNetworkRule('aa$app=com.mobile', 0), 0)).toBeFalsy();
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
