import { describe, expect, test } from 'vitest';

import { Tokenizer } from '../../../src/tokenizer/tokenizer';

describe('Tokenizer growth', () => {
    test('reset() shrinks back to constructor capacity after growCapacity()', () => {
        const t = new Tokenizer(8);
        t.growCapacity(64);
        expect(t.types.length).toBe(64);
        expect(t.ends.length).toBe(64);
        t.reset();
        expect(t.types.length).toBe(8);
        expect(t.ends.length).toBe(8);
        expect(t.tokenCount).toBe(0);
        expect(t.offset).toBe(0);
    });

    test('growCapacity preserves already-tokenized prefix, retokenize from 0 after growth', () => {
        const t = new Tokenizer(4);
        // 'a,b,c,d,e' produces 9 tokens (5 idents + 4 commas).
        t.source = 'a,b,c,d,e';
        t.offset = 0;
        t.tokenize();
        expect(t.tokenCount).toBe(4);
        expect(t.offset).toBeLessThan(9);

        // Grow the capacity.
        t.growCapacity(16);
        expect(t.types.length).toBe(16);
        expect(t.ends.length).toBe(16);

        // Retokenize from scratch — should produce all 9 tokens.
        t.offset = 0;
        t.tokenize();
        expect(t.offset).toBe(9);
        expect(t.tokenCount).toBe(9);
    });
});
