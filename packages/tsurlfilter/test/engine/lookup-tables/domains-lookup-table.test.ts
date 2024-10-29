import { WebRequest } from '../../../src/web-request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { DomainsLookupTable } from '../../../src/engine/lookup-tables/domains-lookup-table';
import { createNetworkRule } from '../../helpers/rule-creator';
import { RequestType } from '../../../src/request-type';

describe('Domains Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = new DomainsLookupTable(ruleStorage);

        expect(table.addRule(createNetworkRule('path', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('||example.org^', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('path$domain=~example.com', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('path$domain=example.*', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('example.com$domain=/example/', 0), 0)).toBeFalsy();
        expect(table.getRulesCount()).toBe(0);

        expect(table.addRule(createNetworkRule('path$domain=example.com', 0), 0)).toBeTruthy();
        expect(table.getRulesCount()).toBe(1);
    });

    it('matches rules from lookup table', () => {
        const rules = [
            'path',
            '||example.net^',
            'path$domain=~example.net',
            'path$domain=test.*',
            'path$domain=example.com',
            'path$domain=example.org',
        ];

        const ruleStorage = createRuleStorage(rules);
        const table = new DomainsLookupTable(ruleStorage);

        fillLookupTable(table, ruleStorage);
        expect(table.getRulesCount()).toBe(2);

        expect(table.matchAll(new WebRequest('http://other.com/', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new WebRequest('http://other.com/path', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new WebRequest('http://example.net/path', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new WebRequest('http://example.com/path', '', RequestType.Document))).toHaveLength(0);

        expect(
            table.matchAll(new WebRequest('http://example.com/path', 'http://example.com', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new WebRequest('http://example.org/path', 'http://example.org', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new WebRequest('http://test.com/path', 'http://example.org', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new WebRequest('http://test.com/path', 'http://sub.example.org', RequestType.Document)),
        ).toHaveLength(1);
    });

    it('returns only unique rule', () => {
        const rules = [
            'path$domain=base.com|a.base.com|b.base.com',
        ];

        const ruleStorage = createRuleStorage(rules);
        const table = new DomainsLookupTable(ruleStorage);

        fillLookupTable(table, ruleStorage);
        expect(table.getRulesCount()).toBe(1);

        expect(
            table.matchAll(new WebRequest('http://base.com/path', 'http://base.com/', RequestType.Document)),
        ).toHaveLength(1);
    });
});
