import { describe, expect, it } from 'vitest';

import { getRuleSourceText } from '../../../src/filterlist/source-map/utils';

const FIRST_RULE = '||example.com^';
const MIDDLE_RULE = '||example.org^';
const LAST_RULE = '||example.net^';
const source = [FIRST_RULE, MIDDLE_RULE, LAST_RULE].join('\n');

describe('getRuleSourceText', () => {
    it('returns the first line', () => {
        expect(getRuleSourceText(0, source)).toBe(FIRST_RULE);
    });

    it('returns a middle line', () => {
        expect(getRuleSourceText(source.indexOf(MIDDLE_RULE), source)).toBe(MIDDLE_RULE);
    });

    it('returns the last line without a trailing line break', () => {
        expect(getRuleSourceText(source.indexOf(LAST_RULE), source)).toBe(LAST_RULE);
    });

    it('returns null when the start index is at a line end', () => {
        expect(getRuleSourceText(source.indexOf('\n'), source)).toBeNull();
    });
});
