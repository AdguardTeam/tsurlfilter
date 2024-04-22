import { NetworkRule, RequestType } from '../../../src';
import { Request } from '../../../src/request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { DomainsLookupTable } from '../../../src/engine/lookup-tables/domains-lookup-table';
import { ByteBuffer } from '../../../src/utils/byte-buffer';

describe('Domains Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = new DomainsLookupTable(ruleStorage, new ByteBuffer());

        expect(table.addRule(new NetworkRule('path', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('||example.org^', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('path$domain=~example.com', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('path$domain=example.*', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('path$domain=example.com', 0), 0)).toBeTruthy();

        table.finalize();

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
        const table = new DomainsLookupTable(ruleStorage, new ByteBuffer());

        fillLookupTable(table, ruleStorage);
        table.finalize();
        expect(table.getRulesCount()).toBe(2);

        expect(table.matchAll(new Request('http://other.com/', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new Request('http://other.com/path', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new Request('http://example.net/path', '', RequestType.Document))).toHaveLength(0);
        expect(table.matchAll(new Request('http://example.com/path', '', RequestType.Document))).toHaveLength(0);

        expect(
            table.matchAll(new Request('http://example.com/path', 'http://example.com', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new Request('http://example.org/path', 'http://example.org', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new Request('http://test.com/path', 'http://example.org', RequestType.Document)),
        ).toHaveLength(1);
        expect(
            table.matchAll(new Request('http://test.com/path', 'http://sub.example.org', RequestType.Document)),
        ).toHaveLength(1);
    });

    it('returns only unique rule', () => {
        const rules = [
            'path$domain=base.com|a.base.com|b.base.com',
        ];

        const ruleStorage = createRuleStorage(rules);
        const table = new DomainsLookupTable(ruleStorage, new ByteBuffer());

        fillLookupTable(table, ruleStorage);
        table.finalize();
        // expect(table.getRulesCount()).toBe(1);

        expect(
            table.matchAll(new Request('http://base.com/path', 'http://base.com/', RequestType.Document)),
        ).toHaveLength(1);
    });

    it('deserializes from buffer', () => {
        const rules = [
            'path',
            '||example.net^',
            'path$domain=~example.net',
            'path$domain=test.*',
            'path$domain=example.com',
            'path$domain=example.org',
        ];

        const ruleStorage = createRuleStorage(rules);
        const buffer = new ByteBuffer();
        const domainsLookupTable = new DomainsLookupTable(ruleStorage, buffer);
        fillLookupTable(domainsLookupTable, ruleStorage);
        domainsLookupTable.finalize();
        const position = domainsLookupTable.serialize();
        expect(
            domainsLookupTable.matchAll(
                new Request(
                    'http://test.com/path',
                    'http://sub.example.org',
                    RequestType.Document,
                ),
            ),
        ).toHaveLength(1);

        const buffer2 = new ByteBuffer(buffer.chunks);
        const domainsLookupTable2 = DomainsLookupTable.deserialize(ruleStorage, buffer2, position);
        expect(
            domainsLookupTable2.matchAll(
                new Request(
                    'http://test.com/path',
                    'http://sub.example.org',
                    RequestType.Document,
                ),
            ),
        ).toHaveLength(1);
    });
});
