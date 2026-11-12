import { describe, expect, test } from 'vitest';

import { isExtendedCssPseudoClass } from '../../src/utils/extended-css-pseudo-classes';

/**
 * Checks the whole string as a pseudo-class name.
 *
 * @param name Pseudo-class name.
 *
 * @returns `true` if the name is an Extended CSS pseudo-class.
 */
function isExtended(name: string): boolean {
    return isExtendedCssPseudoClass(name, 0, name.length);
}

describe('isExtendedCssPseudoClass', () => {
    test.each([
        'xpath',
        'contains',
        'has-text',
        'matches-css',
        'matches-attr',
        '-abp-contains',
        'matches-property',
        'matches-css-after',
        'matches-css-before',
    ])('%s is an Extended CSS pseudo-class with a raw argument', (name) => {
        expect(isExtended(name)).toBe(true);
    });

    test.each([
        'matches-path',
        'matches-media',
        'style',
        'remove',
        'if-not',
        'nth-ancestor',
        'not',
        'has',
        'containsx',
        'has-text-extra',
        'Contains',
        'XPATH',
        '',
    ])('%s is not an Extended CSS pseudo-class with a raw argument', (name) => {
        expect(isExtended(name)).toBe(false);
    });

    test('matches the name at the requested offsets only', () => {
        const source = 'div:has-text(x)';

        expect(isExtendedCssPseudoClass(source, 4, 12)).toBe(true);
        expect(isExtendedCssPseudoClass(source, 3, 12)).toBe(false);
        expect(isExtendedCssPseudoClass(source, 4, 11)).toBe(false);
    });
});
