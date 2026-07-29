/**
 * @file Tests for convenience parsing utilities.
 */
import { describe, expect, test } from 'vitest';

import {
    parseAppList,
    parseDomainList,
    parseMethodList,
    parseModifier,
    parseStealthOptionList,
} from '../../src/ast-utils/parsing';
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

            const result = parseDomainList(value, 0, separator);

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

describe('parseAppList', () => {
    test('parses a pipe-separated app list with negation', () => {
        const list = parseAppList('Example.exe|com.example.osx|~Bad.exe');
        expect(list.type).toBe('AppList');
        expect(list.separator).toBe('|');
        expect(list.children).toEqual([
            { type: 'App', value: 'Example.exe', exception: false },
            { type: 'App', value: 'com.example.osx', exception: false },
            { type: 'App', value: 'Bad.exe', exception: true },
        ]);
    });
});

describe('parseMethodList', () => {
    test('parses a pipe-separated method list with negation', () => {
        const list = parseMethodList('get|post|~put');
        expect(list.type).toBe('MethodList');
        expect(list.children).toEqual([
            { type: 'Method', value: 'get', exception: false },
            { type: 'Method', value: 'post', exception: false },
            { type: 'Method', value: 'put', exception: true },
        ]);
    });
});

describe('parseStealthOptionList', () => {
    test('parses a pipe-separated stealth option list', () => {
        const list = parseStealthOptionList('referrer|~dpi');
        expect(list.type).toBe('StealthOptionList');
        expect(list.children).toEqual([
            { type: 'StealthOption', value: 'referrer', exception: false },
            { type: 'StealthOption', value: 'dpi', exception: true },
        ]);
    });
});

describe('parseModifier', () => {
    test('parses a bare modifier', () => {
        const mod = parseModifier('match-case');
        expect(mod.type).toBe('Modifier');
        expect(mod.name.value).toBe('match-case');
        expect(mod.exception).toBe(false);
        expect(mod.value).toBeUndefined();
    });

    test('parses a negated modifier', () => {
        const mod = parseModifier('~third-party');
        expect(mod.name.value).toBe('third-party');
        expect(mod.exception).toBe(true);
    });

    test('parses a modifier with a value', () => {
        const mod = parseModifier('domain=example.com|~example.org');
        expect(mod.name.value).toBe('domain');
        expect(mod.value?.value).toBe('example.com|~example.org');
        expect(mod.exception).toBe(false);
    });
});
