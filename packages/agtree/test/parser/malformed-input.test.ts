/**
 * @file Malformed-input strictness table (D-20, F-026, F-027, F-028).
 *
 * 4.x rejects these inputs; v5 used to accept them, sometimes with data loss
 * (an empty modifier slot dropped every later modifier, so
 * `$script,,domain=x.com` became an unrestricted `$script` rule).
 *
 * Every row lists the v5 outcome and, where it differs from 4.x on purpose,
 * the reason is spelled out.
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { RuleGenerator } from '../../src/generator/rule-generator';

const parser = new RuleParserPipeline();

const MODIFIER_NAME_EMPTY = 'Modifier name cannot be empty';
const MODIFIER_VALUE_EMPTY = 'Modifier value cannot be empty';
const EMPTY_MODIFIERS = 'Empty modifiers are not allowed';

describe('malformed input is rejected like 4.x (D-20)', () => {
    test.each([
        // F-026: an empty slot used to drop every later modifier.
        '||example.com^$script,,domain=x.com',
        // F-027: an empty slot at the end or right after the separator.
        '||example.com^$script,',
        '||example.com^$,',
        '||example.com^$~',
        '||example.com^$script,~',
    ])('rejects an empty modifier slot: %s', (rule) => {
        expect(() => parser.parse(rule)).toThrow(MODIFIER_NAME_EMPTY);
    });

    test('rejects a separator without modifiers', () => {
        expect(() => parser.parse('||example.com^$')).toThrow(EMPTY_MODIFIERS);
    });

    test.each([
        '||example.com^$domain=',
        '||example.com^$removeparam=',
        '||example.com^$replace=',
        '||example.com^$script=',
    ])('rejects an empty modifier value: %s', (rule) => {
        expect(() => parser.parse(rule)).toThrow(MODIFIER_VALUE_EMPTY);
    });

    test('rejects a bare exception marker', () => {
        expect(() => parser.parse('@@')).toThrow('Network rule must have a pattern or modifiers');
    });

    test('rejects a filter-list header with two versions', () => {
        expect(() => parser.parse('[Adblock Plus 2.0 3.1]'))
            .toThrow('Duplicated versions are not allowed');
    });

    test.each(['!+ HINT(', '!+ HINT(foo'])('rejects an unclosed hint: %s', (rule) => {
        expect(() => parser.parse(rule)).toThrow('Missing closing parenthesis for hint "HINT"');
    });

    test.each(['[]', '[ ]'])('rejects an empty agent list: %s', (rule) => {
        expect(() => parser.parse(rule)).toThrow('Empty agent list');
    });

    test.each(['[;]', '[ ; ]'])('rejects an empty agent slot: %s', (rule) => {
        expect(() => parser.parse(rule)).toThrow('Agent name cannot be empty');
    });

    test.each(['!#if', '!#include'])('rejects a directive without parameters: %s', (rule) => {
        expect(() => parser.parse(rule)).toThrow('requires parameters');
    });
});

describe('malformed input that stays accepted (INTENTIONAL)', () => {
    test('a non-regexp `$replace` value stays the value of the modifier', () => {
        // 4.x keeps `replace=important` too; v5 used to split it into an empty
        // `replace` plus a stray `important` modifier.
        const rule = '||example.com^$replace=important';
        const ast = parser.parse(rule);

        expect(RuleGenerator.generate(ast)).toBe(rule);
    });

    test('a trailing `/` after a valueless modifier is accepted', () => {
        // 4.x accepts `$script/` as well: the `/` is not a separator there.
        expect(RuleGenerator.generate(parser.parse('||example.com^$script/')))
            .toBe('||example.com^$script/');
    });

    test('`!# if` is regenerated as `!#if`', () => {
        // Pre-existing in 4.x: the space after `!#` is insignificant.
        expect(RuleGenerator.generate(parser.parse('!# if (adguard)'))).toBe('!#if (adguard)');
    });
});
