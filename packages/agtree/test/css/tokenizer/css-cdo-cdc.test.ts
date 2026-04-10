import { describe, expect, test } from 'vitest';

import { cssCdcLength, cssCdoLength } from '../../../src/css/tokenizer/css-token-mapping';

import { tokenizeSource } from './helpers/test-utils';

describe('cssCdoLength', () => {
    test('<!-- produces CDO', () => {
        const r = tokenizeSource('<!--');
        expect(cssCdoLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(4);
    });

    test('<!-- followed by text', () => {
        const r = tokenizeSource('<!-- hello');
        const len = cssCdoLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBe(4);
    });

    test('returns 0 for < not followed by !--', () => {
        const r = tokenizeSource('<div');
        expect(cssCdoLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for non-< token', () => {
        const r = tokenizeSource('abc');
        expect(cssCdoLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 when not enough tokens', () => {
        const r = tokenizeSource('<');
        expect(cssCdoLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });
});

describe('cssCdcLength', () => {
    test('--> produces CDC', () => {
        const r = tokenizeSource('-->');
        expect(cssCdcLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(3);
    });

    test('--> followed by text', () => {
        const r = tokenizeSource('--> hello');
        const len = cssCdcLength(r.types, 0, r.tokenCount, r.source, r.ends, 0);
        expect(len).toBe(3);
    });

    test('returns 0 for -- not followed by >', () => {
        const r = tokenizeSource('--x');
        expect(cssCdcLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for single hyphen', () => {
        const r = tokenizeSource('-x');
        expect(cssCdcLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });

    test('returns 0 for non-hyphen start', () => {
        const r = tokenizeSource('abc');
        expect(cssCdcLength(r.types, 0, r.tokenCount, r.source, r.ends, 0)).toBe(0);
    });
});
