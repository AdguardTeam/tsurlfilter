import {
    NetworkRule, RequestType,
} from '../../../src';
import { Request } from '../../../src/request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { HostnameLookupTable } from '../../../src/engine/lookup-tables/hostname-lookup-table';

describe('Hostname Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = new HostnameLookupTable(ruleStorage);

        expect(table.addRule(new NetworkRule('path', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(new NetworkRule('||*example.org^', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(new NetworkRule('||example^', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(new NetworkRule('||example.^', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(new NetworkRule('||example.org^', 0), 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);

        expect(table.addRule(new NetworkRule('||example.net/path', 0), 0)).toBeTruthy();
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

        expect(table.matchAll(new Request(
            'http://other.com/', '', RequestType.Document,
        ))).toHaveLength(0);
        expect(table.matchAll(new Request(
            'http://other.com/path', '', RequestType.Document,
        ))).toHaveLength(0);
        expect(table.matchAll(new Request(
            'http://example.net/path', '', RequestType.Document,
        ))).toHaveLength(0);

        expect(table.matchAll(new Request(
            'http://example.com/path', '', RequestType.Document,
        ))).toHaveLength(1);
        expect(table.matchAll(new Request(
            'http://example.com/path', 'http://example.com', RequestType.Document,
        ))).toHaveLength(1);
        expect(table.matchAll(new Request(
            'http://example.org/path', 'http://example.org', RequestType.Document,
        ))).toHaveLength(1);
    });
});
