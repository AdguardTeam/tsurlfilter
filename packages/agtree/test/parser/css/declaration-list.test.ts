/**
 * @file Parser-level unit tests for `DeclarationListParser`.
 *
 * Each test tokenises a CSS declaration string, runs
 * `DeclarationListParser.parse()`, then inspects the flat `Int32Array`
 * data buffer directly — no AST construction involved.
 *
 * Helper pattern
 * --------------
 * `p(source)` tokenises, prepares context, and calls `parse`.
 * `decl(i)` returns a helper object with typed field accessors for the
 * i-th declaration record.
 */

import { describe, expect, test } from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { createParserContext, initParserContext } from '../../../src/parser/context';
import {
    DECL_FIELD_IMPORTANT,
    DECL_FIELD_PROPERTY_END,
    DECL_FIELD_PROPERTY_START,
    DECL_FIELD_VALUE_END,
    DECL_FIELD_VALUE_START,
    DECL_STRIDE,
    DeclarationListParser,
    DL_COUNT_OFFSET,
    DL_HEADER_SIZE,
} from '../../../src/parser/css/declaration-list';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createParserContext();

/**
 * Data offset used in all tests (write at start of ctx.data).
 */
const DATA_OFFSET = 0;

/**
 * Tokenise `source` and run `DeclarationListParser.parse()`.
 *
 * @param source CSS declaration list string.
 * @param maxDeclarations Optional max declarations override.
 */
function p(source: string, maxDeclarations?: number): void {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    DeclarationListParser.parse(ctx, 0, ctx.tokenCount, DATA_OFFSET, maxDeclarations);
}

/**
 * Returns the declaration count from the header.
 *
 * @returns Number of declarations parsed.
 */
function count(): number {
    return ctx.data[DATA_OFFSET + DL_COUNT_OFFSET];
}

/**
 * Access fields of the i-th declaration record.
 *
 * @param i Declaration record index (0-based).
 *
 * @returns Object exposing each declaration field.
 */
function decl(i: number): {
    propertyStart: number;
    propertyEnd: number;
    valueStart: number;
    valueEnd: number;
    important: number;
    propertyStr: string;
    valueStr: string;
} {
    const base = DATA_OFFSET + DL_HEADER_SIZE + i * DECL_STRIDE;
    const propStart = ctx.data[base + DECL_FIELD_PROPERTY_START];
    const propEnd = ctx.data[base + DECL_FIELD_PROPERTY_END];
    const valStart = ctx.data[base + DECL_FIELD_VALUE_START];
    const valEnd = ctx.data[base + DECL_FIELD_VALUE_END];
    return {
        propertyStart: propStart,
        propertyEnd: propEnd,
        valueStart: valStart,
        valueEnd: valEnd,
        important: ctx.data[base + DECL_FIELD_IMPORTANT],
        propertyStr: ctx.source.slice(propStart, propEnd),
        valueStr: ctx.source.slice(valStart, valEnd),
    };
}

describe('DeclarationListParser', () => {
    describe('Basic declaration parsing', () => {
        test('parses single declaration', () => {
            p('display: none');
            expect(count()).toBe(1);
            expect(decl(0).propertyStr).toBe('display');
            expect(decl(0).valueStr).toBe('none');
            expect(decl(0).important).toBe(0);
        });

        test('parses two declarations', () => {
            p('display: none; padding: 10px');
            expect(count()).toBe(2);
            expect(decl(0).propertyStr).toBe('display');
            expect(decl(0).valueStr).toBe('none');
            expect(decl(1).propertyStr).toBe('padding');
            expect(decl(1).valueStr).toBe('10px');
        });

        test('parses three declarations', () => {
            p('display: none; padding: 10px; margin: 0');
            expect(count()).toBe(3);
            expect(decl(0).propertyStr).toBe('display');
            expect(decl(1).propertyStr).toBe('padding');
            expect(decl(2).propertyStr).toBe('margin');
            expect(decl(2).valueStr).toBe('0');
        });

        test('parses declaration without spaces', () => {
            p('display:none');
            expect(count()).toBe(1);
            expect(decl(0).propertyStr).toBe('display');
            expect(decl(0).valueStr).toBe('none');
        });

        test('parses five declarations', () => {
            p('color: red; background: blue; font-size: 12px; margin: 0; padding: 5px');
            expect(count()).toBe(5);
            expect(decl(0).propertyStr).toBe('color');
            expect(decl(0).valueStr).toBe('red');
            expect(decl(1).propertyStr).toBe('background');
            expect(decl(1).valueStr).toBe('blue');
            expect(decl(2).propertyStr).toBe('font-size');
            expect(decl(2).valueStr).toBe('12px');
            expect(decl(3).propertyStr).toBe('margin');
            expect(decl(3).valueStr).toBe('0');
            expect(decl(4).propertyStr).toBe('padding');
            expect(decl(4).valueStr).toBe('5px');
        });
    });

    describe('!important flag detection', () => {
        test('detects !important flag', () => {
            p('display: none !important');
            expect(count()).toBe(1);
            expect(decl(0).important).toBe(1);
            expect(decl(0).valueStr).toBe('none');
        });

        test('detects ! important with space', () => {
            p('display: none ! important');
            expect(count()).toBe(1);
            expect(decl(0).important).toBe(1);
            expect(decl(0).valueStr).toBe('none');
        });

        test('detects !IMPORTANT (uppercase)', () => {
            p('display: none !IMPORTANT');
            expect(decl(0).important).toBe(1);
        });

        test('detects !ImPoRtAnT (mixed case)', () => {
            p('display: none !ImPoRtAnT');
            expect(decl(0).important).toBe(1);
        });

        test('second declaration important, first not', () => {
            p('display: none; padding: 10px !important');
            expect(count()).toBe(2);
            expect(decl(0).important).toBe(0);
            expect(decl(1).important).toBe(1);
            expect(decl(1).valueStr).toBe('10px');
        });

        test('first declaration important, second not', () => {
            p('display: none !important; padding: 10px');
            expect(count()).toBe(2);
            expect(decl(0).important).toBe(1);
            expect(decl(0).valueStr).toBe('none');
            expect(decl(1).important).toBe(0);
        });

        test('both declarations important', () => {
            p('display: none !important; padding: 10px !important');
            expect(count()).toBe(2);
            expect(decl(0).important).toBe(1);
            expect(decl(1).important).toBe(1);
        });

        test('! not followed by important is part of value', () => {
            p('content: !test');
            expect(count()).toBe(1);
            expect(decl(0).important).toBe(0);
            expect(decl(0).valueStr).toBe('!test');
        });
    });

    describe('Whitespace handling', () => {
        test('trims whitespace around property and value', () => {
            p('  display : none  ');
            expect(count()).toBe(1);
            expect(decl(0).propertyStr).toBe('display');
            expect(decl(0).valueStr).toBe('none');
        });

        test('no spaces around colon', () => {
            p('display:none');
            expect(decl(0).propertyStr).toBe('display');
            expect(decl(0).valueStr).toBe('none');
        });

        test('extra spaces everywhere', () => {
            p('  display  :  none  ');
            expect(decl(0).propertyStr).toBe('display');
            expect(decl(0).valueStr).toBe('none');
        });

        test('whitespace around semicolons', () => {
            p('display: none  ;  padding: 10px');
            expect(count()).toBe(2);
            expect(decl(0).valueStr).toBe('none');
            expect(decl(1).valueStr).toBe('10px');
        });
    });

    describe('Semicolon handling', () => {
        test('trailing semicolon', () => {
            p('display: none;');
            expect(count()).toBe(1);
        });

        test('double trailing semicolons', () => {
            p('display: none;;');
            expect(count()).toBe(1);
        });

        test('leading semicolon', () => {
            p(';display: none');
            expect(count()).toBe(1);
        });

        test('leading and trailing semicolons', () => {
            p(';;display: none;;');
            expect(count()).toBe(1);
        });

        test('semicolons and whitespace between declarations', () => {
            p('; ; display: none ; ; padding: 10px ; ;');
            expect(count()).toBe(2);
        });

        test('no space after semicolon', () => {
            p('display: none;padding: 10px');
            expect(count()).toBe(2);
        });
    });

    describe('Empty / whitespace-only input', () => {
        test('empty string', () => {
            p('');
            expect(count()).toBe(0);
        });

        test('whitespace only', () => {
            p('   ');
            expect(count()).toBe(0);
        });

        test('semicolons only', () => {
            p(';;;');
            expect(count()).toBe(0);
        });

        test('whitespace and semicolons', () => {
            p('  ;  ;  ');
            expect(count()).toBe(0);
        });
    });

    describe('Balanced bracket tracking', () => {
        test('value with parenthesized function', () => {
            p('background: url(foo.png)');
            expect(count()).toBe(1);
            expect(decl(0).valueStr).toBe('url(foo.png)');
        });

        test('semicolon inside parentheses does not split', () => {
            p('background: url(data:text/css;base64,abc)');
            expect(count()).toBe(1);
            expect(decl(0).valueStr).toBe('url(data:text/css;base64,abc)');
        });

        test('parenthesized value followed by another declaration', () => {
            p('background: url(foo.png); color: red');
            expect(count()).toBe(2);
            expect(decl(0).valueStr).toBe('url(foo.png)');
            expect(decl(1).valueStr).toBe('red');
        });

        test('function with comma-separated args', () => {
            p('transform: translate(10px, 20px)');
            expect(count()).toBe(1);
            expect(decl(0).valueStr).toBe('translate(10px, 20px)');
        });

        test('square brackets in value', () => {
            p('grid: [row1] 100px [row2] auto');
            expect(count()).toBe(1);
            expect(decl(0).valueStr).toBe('[row1] 100px [row2] auto');
        });

        test('multiple functions with semicolons inside', () => {
            p('background: url(a;b); color: rgb(1, 2, 3); display: none');
            expect(count()).toBe(3);
        });

        test('nested parentheses with semicolons', () => {
            p('background: url(a(b;c)d); color: red');
            expect(count()).toBe(2);
        });
    });

    describe('Complex values', () => {
        test('multi-part value with function', () => {
            p('background: url(foo.png) no-repeat center');
            expect(decl(0).valueStr).toBe('url(foo.png) no-repeat center');
        });

        test('font shorthand', () => {
            p('font: bold 12px/1.5 Arial, sans-serif');
            expect(decl(0).valueStr).toBe('bold 12px/1.5 Arial, sans-serif');
        });

        test('quoted string value', () => {
            p("content: 'hello world'");
            expect(decl(0).valueStr).toBe("'hello world'");
        });

        test('border shorthand', () => {
            p('border: 1px solid #ccc');
            expect(decl(0).valueStr).toBe('1px solid #ccc');
        });

        test('multi-value margin', () => {
            p('margin: 10px 20px 30px 40px');
            expect(decl(0).valueStr).toBe('10px 20px 30px 40px');
        });

        test('linear-gradient function', () => {
            p('background: linear-gradient(to right, red, blue)');
            expect(decl(0).valueStr).toBe('linear-gradient(to right, red, blue)');
        });
    });

    describe('Custom properties', () => {
        test('custom property', () => {
            p('--my-var: red');
            expect(count()).toBe(1);
            expect(decl(0).propertyStr).toBe('--my-var');
            expect(decl(0).valueStr).toBe('red');
        });

        test('multiple custom properties', () => {
            p('--spacing: 10px; --color: blue');
            expect(count()).toBe(2);
            expect(decl(0).propertyStr).toBe('--spacing');
            expect(decl(1).propertyStr).toBe('--color');
        });

        test('vendor-prefixed property', () => {
            p('-webkit-transform: rotate(45deg)');
            expect(count()).toBe(1);
            expect(decl(0).propertyStr).toBe('-webkit-transform');
        });
    });

    describe('Values with colons', () => {
        test('URL with protocol colon', () => {
            p('background: url(https://example.com)');
            expect(decl(0).valueStr).toBe('url(https://example.com)');
        });

        test('grid template with slash', () => {
            p("grid-template: 'a a' 1fr / 100px");
            expect(count()).toBe(1);
        });
    });

    describe('Error cases', () => {
        test('throws on missing colon', () => {
            expect(() => p('display')).toThrow(AdblockSyntaxError);
        });

        test('throws on colon without property', () => {
            expect(() => p(': none')).toThrow(AdblockSyntaxError);
        });

        test('throws on at-rule (@ is not a valid property start)', () => {
            expect(() => p('@media screen')).toThrow(AdblockSyntaxError);
        });

        test('throws on number as property', () => {
            expect(() => p('123: value')).toThrow(AdblockSyntaxError);
        });

        test('throws on colon without property after valid declaration', () => {
            expect(() => p('display: none; : value')).toThrow(AdblockSyntaxError);
        });

        test('throws on at-rule after valid declaration (@ is not a valid property start)', () => {
            expect(() => p('display: none; @import url(foo)')).toThrow(AdblockSyntaxError);
        });

        test('throws on unmatched closing parenthesis', () => {
            expect(() => p('color: red)')).toThrow(AdblockSyntaxError);
        });

        test('throws on unmatched closing square bracket', () => {
            expect(() => p('background: ]')).toThrow(AdblockSyntaxError);
        });

        test('throws on unclosed parenthesis', () => {
            expect(() => p('background: url(foo')).toThrow(AdblockSyntaxError);
        });

        test('throws on unclosed square bracket', () => {
            expect(() => p('grid: [row1 100px')).toThrow(AdblockSyntaxError);
        });

        test('throws on unclosed parenthesis in multi-declaration input', () => {
            expect(() => p('color: red; background: url(foo')).toThrow(AdblockSyntaxError);
        });
    });

    describe('Capacity overflow', () => {
        test('signals ctx.status=1 when exceeding maxDeclarations', () => {
            ctx.status = 0;
            p('a: 1; b: 2', 1);
            expect(ctx.status).toBe(1);
        });
    });
});
