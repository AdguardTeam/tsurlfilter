import { describe, expect, it } from 'vitest';

import {
    cosmeticSepStartIndex,
    cosmeticSepTokenCount,
    findCosmeticSeparator,
} from '../../../src/preparser/cosmetic-separator';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

describe('findCosmeticSeparator', () => {
    const tokenizer = new Tokenizer(1024);

    /**
     * Helper: tokenize and find the cosmetic separator.
     *
     * @param rule Rule string.
     *
     * @returns Object with startIndex (token), tokenCount, and raw separator string, or null.
     */
    function find(rule: string) {
        tokenizer.setSource(rule);
        const packed = findCosmeticSeparator(tokenizer.types, tokenizer.tokenCount);
        if (packed === -1) {
            return null;
        }
        const idx = cosmeticSepStartIndex(packed);
        const count = cosmeticSepTokenCount(packed);
        // Compute separator source range from token ends
        const sepStart = idx === 0 ? 0 : tokenizer.ends[idx - 1];
        const sepEnd = tokenizer.ends[idx + count - 1];
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
