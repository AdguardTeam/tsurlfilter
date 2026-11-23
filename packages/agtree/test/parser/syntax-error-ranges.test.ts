/**
 * @file Syntactic rejections carry an `AdblockSyntaxError` with a range
 * (F-029, T-017).
 *
 * Tolerant consumers (AGLint) lose the location when a parser throws a plain
 * `Error`. Every rejection that depends on the rule text must carry the range
 * of the offending part.
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { parseDomainList } from '../../src/ast-utils/parsing';
import { AdblockSyntaxError } from '../../src/errors/adblock-syntax-error';

const parser = new RuleParserPipeline();

/**
 * Parses `rule` and returns the thrown `AdblockSyntaxError`.
 *
 * @param rule Rule text expected to be rejected.
 *
 * @returns The thrown error.
 */
const parseError = (rule: string): AdblockSyntaxError => {
    try {
        parser.parse(rule);
    } catch (error) {
        expect(error).toBeInstanceOf(AdblockSyntaxError);
        return error as AdblockSyntaxError;
    }

    throw new Error(`Expected ${rule} to be rejected`);
};

describe('cosmetic header syntax errors carry a range', () => {
    test.each([
        {
            rule: '[$path=/a example.com##.ads',
            message: 'Unclosed AdGuard modifier list: missing ]',
            start: 0,
        },
        {
            rule: '[$]example.com##.ads',
            message: 'AdGuard modifier list [$...] is empty',
            start: 0,
        },
        {
            rule: 'example.com##',
            message: 'Element hiding rule has empty body',
            start: 11,
        },
    ])('rejects $rule with a range', ({ rule, message, start }) => {
        const error = parseError(rule);

        expect(error.message).toBe(message);
        expect(typeof error.start).toBe('number');
        expect(typeof error.end).toBe('number');
        expect(error.start).toBeLessThanOrEqual(error.end);
        if (start !== null) {
            expect(error.start).toBe(start);
        }
    });
});

describe('uBO modifier syntax errors carry a range', () => {
    test.each([
        {
            rule: '##div:style(color: red):has(a)',
            message: ':style() and :remove() can only be used at the end of the selector',
            start: 23,
        },
        {
            rule: 'example.com##div:style(a):style(b)',
            message: ':style() and :remove() can only be used at the end of the selector',
            start: 25,
        },
        {
            rule: 'example.com##div:not(:style(a))',
            message: ':style() cannot be nested inside a pseudo-class',
            start: 21,
        },
        {
            rule: '[$path=/x]##div:style(color: red)',
            message: 'Cannot mix AdGuard modifier list [$...] with uBO pseudo-class modifiers',
            start: 12,
        },
    ])('rejects $rule with a range', ({ rule, message, start }) => {
        const error = parseError(rule);

        expect(error.message).toBe(message);
        expect(error.start).toBe(start);
        expect(error.start).toBeLessThanOrEqual(error.end);
    });
});

describe('domain-list syntax errors carry a range', () => {
    test.each([
        // Cosmetic domain lists go through `DomainListParser`.
        'example.com,,example.org##.ad',
        'example.com,~##.ad',
        'example.com,~ ##.ad',
    ])('rejects %s with a range', (rule) => {
        const error = parseError(rule);

        expect(typeof error.start).toBe('number');
        expect(typeof error.end).toBe('number');
        expect(error.start).toBeLessThanOrEqual(error.end);
    });

    test.each([
        { list: ',a', message: 'Value list cannot start with a separator' },
        { list: 'a,', message: 'Value list cannot end with a separator' },
        { list: 'a,,b', message: 'Empty value specified in the list' },
        { list: '~', message: 'Domain list contains empty item' },
    ])('rejects the list $list with a range', ({ list, message }) => {
        // The legacy list pre-validator used to throw plain `Error`s, so
        // tolerant consumers lost the location.
        let error: unknown;
        try {
            parseDomainList(list, 0, ',');
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AdblockSyntaxError);
        const located = error as AdblockSyntaxError;
        expect(located.message).toContain(message);
        expect(typeof located.start).toBe('number');
        expect(typeof located.end).toBe('number');
        expect(located.start).toBeLessThanOrEqual(located.end);
    });
});
