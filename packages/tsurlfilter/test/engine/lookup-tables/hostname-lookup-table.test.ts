import { WebRequest } from '../../../src/web-request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { HostnameLookupTable } from '../../../src/engine/lookup-tables/hostname-lookup-table';
import { createNetworkRule } from '../../helpers/rule-creator';
import { RequestType } from '../../../src/request-type';

describe('Hostname Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = new HostnameLookupTable(ruleStorage);

        expect(table.addRule(createNetworkRule('path', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('||*example.org^', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('||example^', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('||example.^', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('||example.org^', 0), 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);

        expect(table.addRule(createNetworkRule('||example.net/path', 0), 0)).toBeTruthy();
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

        expect(table.matchAll(new WebRequest('http://other.com/', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new WebRequest('http://other.com/path', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new WebRequest('http://example.net/path', '', RequestType.Document))).toHaveLength(0);

        expect(table.matchAll(new WebRequest('http://example.com/path', '', RequestType.Document))).toHaveLength(1);
        expect(
            table.matchAll(new WebRequest('http://example.com/path', 'http://example.com', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new WebRequest('http://example.org/path', 'http://example.org', RequestType.Document)),
        ).toHaveLength(1);
    });
});
