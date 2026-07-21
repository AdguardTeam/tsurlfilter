/**
 * @file Tests for convenience parsing utilities.
 */
import { describe, expect, test } from 'vitest';

import { parseDomainList } from '../../src/ast-utils-new/parsing';
import { COMMA, PIPE_MODIFIER_SEPARATOR } from '../../src/utils/constants';

describe('parseDomainList', () => {
    test('parses a small domain list', () => {
        const result = parseDomainList('example.com|~example.org');

        expect(result.children.map((c) => c.value)).toEqual(['example.com', 'example.org']);
        expect(result.children.map((c) => c.exception)).toEqual([false, true]);
    });

    test.each([
        { count: 400, separator: PIPE_MODIFIER_SEPARATOR },
        { count: 400, separator: COMMA },
        { count: 1000, separator: PIPE_MODIFIER_SEPARATOR },
    ] as const)(
        'does not truncate a large list of $count domains (separator "$separator")',
        ({ count, separator }) => {
            const domains = Array.from({ length: count }, (_, i) => `sub${i}.example${i}.com`);
            const value = domains.join(separator);

            const result = parseDomainList(value, {}, 0, separator);

            // Every domain must be present — the token buffer used to stop at
            // 1024 tokens, silently dropping trailing domains.
            expect(result.children).toHaveLength(count);
            expect(result.children.map((c) => c.value)).toEqual(domains);
        },
    );

    test('preserves a trailing exception domain in a large list', () => {
        const domains = Array.from({ length: 400 }, (_, i) => `sub${i}.example${i}.com`);
        // Last domain is an exclusion; truncation used to drop it and broaden scope.
        const value = `${domains.join(PIPE_MODIFIER_SEPARATOR)}|~tail-exclusion.example.com`;

        const result = parseDomainList(value);

        expect(result.children).toHaveLength(domains.length + 1);
        const last = result.children[result.children.length - 1];
        expect(last.value).toBe('tail-exclusion.example.com');
        expect(last.exception).toBe(true);
    });
});
