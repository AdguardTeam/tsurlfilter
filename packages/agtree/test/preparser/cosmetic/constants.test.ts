import { describe, expect, it } from 'vitest';

import {
    cosmeticSepLength,
    cosmeticSepTokenCount,
    cosmeticSepToString,
} from '../../../src/preparser/cosmetic/constants';
import { CosmeticSepKind } from '../../../src/preparser/cosmetic-separator';

describe('cosmeticSepTokenCount', () => {
    it('should return correct token count for all separator kinds', () => {
        const testCases: Array<{
            kind: CosmeticSepKind;
            separator: string;
        }> = [
            { kind: CosmeticSepKind.HashHash, separator: '##' },
            { kind: CosmeticSepKind.HashAtHash, separator: '#@#' },
            { kind: CosmeticSepKind.HashQuestionHash, separator: '#?#' },
            { kind: CosmeticSepKind.HashAtQuestionHash, separator: '#@?#' },
            { kind: CosmeticSepKind.HashDollarHash, separator: '#$#' },
            { kind: CosmeticSepKind.HashAtDollarHash, separator: '#@$#' },
            { kind: CosmeticSepKind.HashDollarQuestionHash, separator: '#$?#' },
            { kind: CosmeticSepKind.HashAtDollarQuestionHash, separator: '#@$?#' },
            { kind: CosmeticSepKind.HashPercentHash, separator: '#%#' },
            { kind: CosmeticSepKind.HashAtPercentHash, separator: '#@%#' },
            { kind: CosmeticSepKind.DollarDollar, separator: '$$' },
            { kind: CosmeticSepKind.DollarAtDollar, separator: '$@$' },
        ];

        testCases.forEach(({ kind, separator }) => {
            expect(cosmeticSepTokenCount(kind)).toBe(separator.length);
            expect(cosmeticSepToString(kind)).toBe(separator);
        });
    });

    it('should return 0 for unknown separator kind', () => {
        expect(cosmeticSepTokenCount(999 as CosmeticSepKind)).toBe(0);
        expect(cosmeticSepLength(999 as CosmeticSepKind)).toBe(0);
    });
});
