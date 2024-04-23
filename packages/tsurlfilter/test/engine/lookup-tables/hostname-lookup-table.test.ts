import { NetworkRule, RequestType } from '../../../src';
import { Request } from '../../../src/request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { HostnameLookupTable } from '../../../src/engine/lookup-tables/hostname-lookup-table';
import { ByteBuffer } from '../../../src/utils/byte-buffer';

describe('Hostname Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = HostnameLookupTable.create(ruleStorage, new ByteBuffer());

        expect(table.addRule(new NetworkRule('path', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('||*example.org^', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('||example^', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('||example.^', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('||example.org^', 0), 0)).toBeTruthy();
        expect(table.addRule(new NetworkRule('||example.net/path', 0), 0)).toBeTruthy();

        table.finalize();

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
        const table = HostnameLookupTable.create(ruleStorage, new ByteBuffer());

        fillLookupTable(table, ruleStorage);
        table.finalize();
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

    it('deserializes from buffer', () => {
        const rules = [
            'path',
            '||*example.net^',
            '||example.org^',
            '||example.com/path',
        ];

        const ruleStorage = createRuleStorage(rules);
        const buffer = new ByteBuffer();
        const table = HostnameLookupTable.create(ruleStorage, buffer);
        fillLookupTable(table, ruleStorage);
        table.finalize();

        const request = new Request(
            'http://example.org/path',
            'http://example.org',
            RequestType.Document,
        );

        expect(table.matchAll(request)).toHaveLength(1);

        const restoredBuffer = new ByteBuffer(buffer.chunks);
        const restoredTable = new HostnameLookupTable(ruleStorage, restoredBuffer, table.offset);
        expect(restoredTable.matchAll(request)).toHaveLength(1);
    });
});
