import { describe, expect, test } from 'vitest';

import { cssPercentageLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssPercentageLength', () => {
    test('50%', () => {
        const r = tokenizeSource('50%');
        expect(cssPercentageLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('100%', () => {
        const r = tokenizeSource('100%');
        expect(cssPercentageLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('.5%', () => {
        const r = tokenizeSource('.5%');
        // Dot, Digit(5), Percent
        expect(cssPercentageLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('-10%', () => {
        const r = tokenizeSource('-10%');
        // Hyphen, Digit(10), Percent
        expect(cssPercentageLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('+75.5%', () => {
        const r = tokenizeSource('+75.5%');
        // PlusSign, Digit(75), Dot, Digit(5), Percent
        expect(cssPercentageLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(5);
    });

    test('number without percent returns 0', () => {
        const r = tokenizeSource('42 ');
        expect(cssPercentageLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for non-number', () => {
        const r = tokenizeSource('abc');
        expect(cssPercentageLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('percent alone returns 0', () => {
        const r = tokenizeSource('%');
        expect(cssPercentageLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });
});
