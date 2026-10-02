import { describe, expect, it } from 'vitest';

import { MAX_METADATA_VALUE_BYTES, MetadataChunks } from '../../../src/ruleset/metadata-chunks';

describe('metadata chunks byte accounting', () => {
    it('exposes the 64 KiB bound', () => {
        expect(MAX_METADATA_VALUE_BYTES).toBe(65536);
    });

    it('counts UTF-8 bytes', () => {
        expect(MetadataChunks.utf8ByteLength('')).toBe(0);
        expect(MetadataChunks.utf8ByteLength('abc')).toBe(3);
        expect(MetadataChunks.utf8ByteLength('é')).toBe(2);
        expect(MetadataChunks.utf8ByteLength('€')).toBe(3);
        expect(MetadataChunks.utf8ByteLength('😀')).toBe(4);
    });

    it('matches JSON.stringify escaping for every UTF-16 code unit', () => {
        for (let code = 0; code <= 0xffff; code += 1) {
            const expected = MetadataChunks.utf8ByteLength(JSON.stringify(String.fromCharCode(code))) - 2;
            expect(MetadataChunks.escapedByteCost(code), `code unit 0x${code.toString(16)}`).toBe(expected);
        }
    });

    it('renders the compact metadata value exactly as JSON.stringify does', () => {
        const chunk = 'a"b\\c\n😀';

        expect(MetadataChunks.renderValue(chunk, false)).toBe(JSON.stringify({ chunk }));
    });

    it('renders the pretty metadata value at the depth of a rule inside the ruleset array', () => {
        const chunk = 'x';
        const file = JSON.stringify([{ metadata: { chunk } }], null, '\t');

        expect(MetadataChunks.renderValue(chunk, true)).toBe('{\n\t\t\t"chunk": "x"\n\t\t}');
        expect(file).toContain(MetadataChunks.renderValue(chunk, true));
    });
});

describe('MetadataChunks.split', () => {
    // Bytes available for the escaped fragment in one value: 65,536 minus
    // the 12-byte compact wrapper `{"chunk":""}`, or minus the 20-byte pretty
    // wrapper (`{`, newline, 3 tabs, `"chunk": ""`, newline, 2 tabs, `}`).
    const COMPACT_BUDGET = 65_524;
    const PRETTY_BUDGET = 65_516;

    it.each([
        ['compact', false, COMPACT_BUDGET],
        ['pretty', true, PRETTY_BUDGET],
    ])('keeps a payload that fits exactly in one fragment (%s)', (_, pretty, budget) => {
        const payload = 'a'.repeat(budget);

        expect(MetadataChunks.split(payload, pretty)).toEqual([payload]);
        const rendered = MetadataChunks.renderValue(payload, pretty);
        expect(MetadataChunks.utf8ByteLength(rendered)).toBe(MAX_METADATA_VALUE_BYTES);
    });

    it('splits one byte over the bound into two fragments', () => {
        const payload = 'a'.repeat(COMPACT_BUDGET + 1);
        const fragments = MetadataChunks.split(payload, false);

        expect(fragments).toHaveLength(2);
        expect(fragments[1]).toBe('a');
        expect(fragments.join('')).toBe(payload);
    });

    it('accounts for pretty-print whitespace', () => {
        const payload = 'a'.repeat(COMPACT_BUDGET);

        expect(MetadataChunks.split(payload, false)).toHaveLength(1);
        expect(MetadataChunks.split(payload, true)).toHaveLength(2);
    });

    it('counts escaped characters by their escaped size', () => {
        // Each `"` costs two bytes once escaped.
        const payload = '"'.repeat(Math.floor(COMPACT_BUDGET / 2) + 1);
        const fragments = MetadataChunks.split(payload, false);

        expect(fragments).toHaveLength(2);
        expect(fragments[1]).toBe('"');
    });

    it('never splits a surrogate pair', () => {
        // Two bytes left in the first fragment, the pair needs four.
        const filler = 'a'.repeat(COMPACT_BUDGET - 2);
        const payload = `${filler}😀b`;
        const fragments = MetadataChunks.split(payload, false);

        expect(fragments).toEqual([filler, '😀b']);
    });

    it('never splits a multi-byte character', () => {
        const filler = 'a'.repeat(COMPACT_BUDGET - 1);
        const payload = `${filler}€`;

        expect(MetadataChunks.split(payload, false)).toEqual([filler, '€']);
    });

    it('keeps every fragment within the bound for mixed content in both modes', () => {
        const unit = 'ab"\\\n\té€😀\u0001';
        const payload = unit.repeat(20_000);

        for (const pretty of [false, true]) {
            const fragments = MetadataChunks.split(payload, pretty);

            expect(fragments.length).toBeGreaterThan(1);
            expect(fragments.join('')).toBe(payload);

            for (const fragment of fragments) {
                expect(MetadataChunks.utf8ByteLength(MetadataChunks.renderValue(fragment, pretty)))
                    .toBeLessThanOrEqual(MAX_METADATA_VALUE_BYTES);
                expect(JSON.parse(JSON.stringify(fragment))).toBe(fragment);
            }
        }
    });

    it('returns a single empty fragment for an empty payload', () => {
        expect(MetadataChunks.split('', false)).toEqual(['']);
    });

    it('is deterministic', () => {
        const payload = 'x'.repeat(200_000);

        expect(MetadataChunks.split(payload, true)).toEqual(MetadataChunks.split(payload, true));
    });
});

describe('MetadataChunks.allocateIds', () => {
    it('starts from 1 when nothing is used', () => {
        expect(MetadataChunks.allocateIds(3, new Set())).toEqual([1, 2, 3]);
    });

    it('skips ids used by other rules', () => {
        expect(MetadataChunks.allocateIds(3, new Set([1, 2, 4]))).toEqual([3, 5, 6]);
    });

    it('returns an empty list for zero rules', () => {
        expect(MetadataChunks.allocateIds(0, new Set([1]))).toEqual([]);
    });
});
