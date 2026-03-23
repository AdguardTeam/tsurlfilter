import { describe, expect, it } from 'vitest';

import {
    cosmeticSepLength,
    cosmeticSepTokenCount,
    cosmeticSepToString,
} from '../../../src/preparser/cosmetic/constants';
import { CosmeticSepKind } from '../../../src/preparser/cosmetic-separator';
import { tokenizeLine } from '../../../src/tokenizer/tokenizer';

describe('cosmeticSepTokenCount', () => {
    it('should return correct token count for all separator kinds', () => {
        const testCases: Array<{
            kind: CosmeticSepKind;
            separator: string;
        }> = [
            { kind: CosmeticSepKind.ElementHiding, separator: '##' },
            { kind: CosmeticSepKind.ElementHidingException, separator: '#@#' },
            { kind: CosmeticSepKind.ExtendedElementHiding, separator: '#?#' },
            { kind: CosmeticSepKind.ExtendedElementHidingException, separator: '#@?#' },
            { kind: CosmeticSepKind.AbpSnippet, separator: '#$#' },
            { kind: CosmeticSepKind.AbpSnippetException, separator: '#@$#' },
            { kind: CosmeticSepKind.AdgExtendedCssInjection, separator: '#$?#' },
            { kind: CosmeticSepKind.AdgExtendedCssInjectionException, separator: '#@$?#' },
            { kind: CosmeticSepKind.AdgJsInjection, separator: '#%#' },
            { kind: CosmeticSepKind.AdgJsInjectionException, separator: '#@%#' },
            { kind: CosmeticSepKind.AdgHtmlFiltering, separator: '$$' },
            { kind: CosmeticSepKind.AdgHtmlFilteringException, separator: '$@$' },
        ];

        testCases.forEach(({ kind, separator }) => {
            const result = {
                tokenCount: 0,
                types: new Uint8Array(1024),
                ends: new Uint32Array(1024),
                actualEnd: 0,
                overflowed: 0 as const,
            };
            tokenizeLine(separator, 0, result);

            expect(cosmeticSepTokenCount(kind)).toBe(result.tokenCount);
            expect(cosmeticSepToString(kind)).toBe(separator);
        });
    });

    it('should return 0 for unknown separator kind', () => {
        expect(cosmeticSepTokenCount(999 as CosmeticSepKind)).toBe(0);
        expect(cosmeticSepLength(999 as CosmeticSepKind)).toBe(0);
    });
});
