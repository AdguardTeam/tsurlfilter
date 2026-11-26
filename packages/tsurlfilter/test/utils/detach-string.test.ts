import { describe, expect, it } from 'vitest';

import { detachString } from '../../src/utils/detach-string';

describe('detachString', () => {
    it('returns a string equal to the argument', () => {
        expect(detachString('||example.org^$third-party')).toBe('||example.org^$third-party');
    });

    it('returns an empty string for an empty string', () => {
        expect(detachString('')).toBe('');
    });

    it('keeps non-Latin characters and surrogate pairs', () => {
        const text = 'example.org##.реклама-баннер-広告-😀';

        expect(detachString(text)).toBe(text);
    });
});
