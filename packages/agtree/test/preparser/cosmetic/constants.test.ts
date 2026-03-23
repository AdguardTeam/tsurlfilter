import { describe, expect, it } from 'vitest';

import {
    cosmeticSepStartIndex,
    cosmeticSepTokenCount,
    findCosmeticSeparator,
} from '../../../src/preparser/cosmetic-separator';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import { tokenizeLine } from '../../../src/tokenizer/tokenizer';

describe('findCosmeticSeparator', () => {
    const out: TokenizeResult = {
        tokenCount: 0,
        types: new Uint8Array(1024),
        ends: new Uint32Array(1024),
        actualEnd: 0,
        overflowed: 0,
    };

    /**
     * Helper: tokenize and find the cosmetic separator.
     *
     * @param rule Rule string.
     *
     * @returns Object with startIndex (token), tokenCount, and raw separator string, or null.
     */
    function find(rule: string) {
        tokenizeLine(rule, 0, out);
        const packed = findCosmeticSeparator(out.types, out.tokenCount);
        if (packed === -1) {
            return null;
        }
        const idx = cosmeticSepStartIndex(packed);
        const count = cosmeticSepTokenCount(packed);
        // Compute separator source range from token ends
        const sepStart = idx === 0 ? 0 : out.ends[idx - 1];
        const sepEnd = out.ends[idx + count - 1];
        return { startIndex: idx, tokenCount: count, separator: rule.slice(sepStart, sepEnd) };
    }

    it('should find all separator types with correct token count', () => {
        const testCases = [
            { rule: 'example.com##.ad', separator: '##', tokenCount: 2 },
            { rule: 'example.com#@#.ad', separator: '#@#', tokenCount: 3 },
            { rule: 'example.com#?#.ad', separator: '#?#', tokenCount: 3 },
            { rule: 'example.com#@?#.ad', separator: '#@?#', tokenCount: 4 },
            { rule: 'example.com#$#body { padding: 0; }', separator: '#$#', tokenCount: 3 },
            { rule: 'example.com#@$#body { padding: 0; }', separator: '#@$#', tokenCount: 4 },
            { rule: 'example.com#$?#.ad', separator: '#$?#', tokenCount: 4 },
            { rule: 'example.com#@$?#.ad', separator: '#@$?#', tokenCount: 5 },
            { rule: 'example.com#%#//scriptlet', separator: '#%#', tokenCount: 3 },
            { rule: 'example.com#@%#//scriptlet', separator: '#@%#', tokenCount: 4 },
            { rule: 'example.com$$script', separator: '$$', tokenCount: 2 },
            { rule: 'example.com$@$script', separator: '$@$', tokenCount: 3 },
        ];

        testCases.forEach(({ rule, separator, tokenCount: expectedCount }) => {
            const result = find(rule);
            expect(result, `Failed for rule: ${rule}`).not.toBeNull();
            expect(result!.separator).toBe(separator);
            expect(result!.tokenCount).toBe(expectedCount);
        });
    });

    it('should return -1 for rules without cosmetic separators', () => {
        expect(find('||example.com^')).toBeNull();
        expect(find('! comment')).toBeNull();
        expect(find('# host comment')).toBeNull();
    });
});
