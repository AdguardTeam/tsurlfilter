import { NetworkRule, RequestType } from '../../../src';
import { Request } from '../../../src/request';
import { createRuleStorage, fillLookupTable } from './lookup-table';
import { TrieLookupTable } from '../../../src/engine/lookup-tables/trie-lookup-table';
import { ByteBuffer } from '../../../src/utils/byte-buffer';

describe('Trie Lookup Table Tests', () => {
    it('adds rule to look up table', () => {
        const ruleStorage = createRuleStorage([]);
        const table = TrieLookupTable.create(ruleStorage, new ByteBuffer());

        expect(table.addRule(new NetworkRule('http://p', 0), 0)).toBeFalsy();
        expect(table.addRule(new NetworkRule('shortcut', 0), 0)).toBeTruthy();
        expect(table.addRule(new NetworkRule('path', 0), 0)).toBeTruthy();
        expect(table.addRule(new NetworkRule('https://domain.com', 0), 0)).toBeTruthy();
        // Rule shortcut is too short
        expect(table.addRule(new NetworkRule('aa$app=com.mobile', 0), 0)).toBeFalsy();

        table.finalize();

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
        const table = TrieLookupTable.create(ruleStorage, new ByteBuffer());

        fillLookupTable(table, ruleStorage);
        table.finalize();
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

    it('deserializes from buffer', () => {
        const rules = [
            'path/one',
            'path/two',
            'path/three',
            'path/three/one',
        ];

        const ruleStorage = createRuleStorage(rules);
        const buffer = new ByteBuffer();
        const table = TrieLookupTable.create(ruleStorage, buffer);
        fillLookupTable(table, ruleStorage);
        table.finalize();

        const request = new Request(
            'http://example.com/path/three/one',
            'http://example.com',
            RequestType.Document,
        );

        expect(table.matchAll(request)).toHaveLength(2);

        const restoredBuffer = new ByteBuffer(buffer.data);
        const restoredTable = new TrieLookupTable(ruleStorage, restoredBuffer, table.offset);
        expect(restoredTable.matchAll(request)).toHaveLength(2);
    });
});
