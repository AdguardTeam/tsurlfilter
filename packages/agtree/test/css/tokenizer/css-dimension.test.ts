import { describe, expect, test } from 'vitest';

import { cssDimensionLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssDimensionLength', () => {
    test('10px', () => {
        const r = tokenizeSource('10px');
        // Digit(10), Letter(px)
        expect(cssDimensionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(2);
    });

    test('3.14em', () => {
        const r = tokenizeSource('3.14em');
        // Digit(3), Dot, Digit(14), Letter(em)
        expect(cssDimensionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(4);
    });

    test('.5rem', () => {
        const r = tokenizeSource('.5rem');
        // Dot, Digit(5), Letter(rem)
        expect(cssDimensionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('-1px', () => {
        const r = tokenizeSource('-1px');
        // Hyphen, Digit(1), Letter(px)
        expect(cssDimensionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('+2.5vw', () => {
        const r = tokenizeSource('+2.5vw');
        // PlusSign, Digit(2), Dot, Digit(5), Letter(vw)
        expect(cssDimensionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(5);
    });

    test('number without unit returns 0', () => {
        const r = tokenizeSource('42 ');
        expect(cssDimensionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for just ident', () => {
        const r = tokenizeSource('px');
        expect(cssDimensionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for non-number start', () => {
        const r = tokenizeSource('abc');
        expect(cssDimensionLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });
});
