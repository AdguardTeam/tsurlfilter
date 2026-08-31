/**
 * @file Tests for the CssCursor class.
 */
import { describe, expect, test } from 'vitest';

import { CssCursor } from '../../../src/converter/css/css-cursor';
import { CssTokenKind } from '../../../src/converter/css/css-token-kind';

describe('CssCursor', () => {
    const cursor = new CssCursor();

    describe('basic classification', () => {
        test('empty string produces Eof', () => {
            cursor.reset('');
            expect(cursor.kind).toBe(CssTokenKind.Eof);
            expect(cursor.isEof()).toBe(true);
        });

        test('simple ident', () => {
            cursor.reset('div');
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('div');
            cursor.advance();
            expect(cursor.isEof()).toBe(true);
        });

        test('hyphenated ident', () => {
            cursor.reset('-ext-has');
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('-ext-has');
        });

        test('function token', () => {
            cursor.reset('contains(');
            expect(cursor.kind).toBe(CssTokenKind.Function);
            expect(cursor.value).toBe('contains(');
        });

        test('colon', () => {
            cursor.reset(':');
            expect(cursor.kind).toBe(CssTokenKind.Colon);
            expect(cursor.value).toBe(':');
        });

        test('string with double quotes', () => {
            cursor.reset('"hello"');
            expect(cursor.kind).toBe(CssTokenKind.String);
            expect(cursor.value).toBe('"hello"');
        });

        test('string with single quotes', () => {
            cursor.reset("'world'");
            expect(cursor.kind).toBe(CssTokenKind.String);
            expect(cursor.value).toBe("'world'");
        });

        test('whitespace', () => {
            cursor.reset('  \t');
            expect(cursor.kind).toBe(CssTokenKind.Whitespace);
        });

        test('open/close square brackets', () => {
            cursor.reset('[');
            expect(cursor.kind).toBe(CssTokenKind.OpenSquareBracket);
            cursor.reset(']');
            expect(cursor.kind).toBe(CssTokenKind.CloseSquareBracket);
        });

        test('hash token', () => {
            cursor.reset('#foo');
            expect(cursor.kind).toBe(CssTokenKind.Hash);
            expect(cursor.value).toBe('#foo');
        });

        test('delim for unrecognized chars', () => {
            cursor.reset('=');
            expect(cursor.kind).toBe(CssTokenKind.Delim);
            expect(cursor.value).toBe('=');
        });
    });

    describe('sequence iteration', () => {
        test('selector: div.class', () => {
            cursor.reset('div.class');
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('div');
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.Delim); // dot
            expect(cursor.value).toBe('.');
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('class');
            cursor.advance();
            expect(cursor.isEof()).toBe(true);
        });

        test('pseudo-class: :contains(text)', () => {
            cursor.reset(':contains(text)');
            expect(cursor.kind).toBe(CssTokenKind.Colon);
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.Function);
            expect(cursor.value).toBe('contains(');
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('text');
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.CloseParenthesis);
            cursor.advance();
            expect(cursor.isEof()).toBe(true);
        });

        test('attribute selector: [attr=value]', () => {
            cursor.reset('[attr=value]');
            expect(cursor.kind).toBe(CssTokenKind.OpenSquareBracket);
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('attr');
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.Delim);
            expect(cursor.value).toBe('=');
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('value');
            cursor.advance();
            expect(cursor.kind).toBe(CssTokenKind.CloseSquareBracket);
            cursor.advance();
            expect(cursor.isEof()).toBe(true);
        });
    });

    describe('nesting depth', () => {
        test('tracks parenthesis depth', () => {
            cursor.reset(':has(:contains(x))');
            // :
            expect(cursor.depth).toBe(0);
            cursor.advance();
            // has(  — Function opens a paren
            expect(cursor.kind).toBe(CssTokenKind.Function);
            cursor.advance();
            expect(cursor.depth).toBe(1);
            // :
            cursor.advance();
            // contains(
            expect(cursor.kind).toBe(CssTokenKind.Function);
            cursor.advance();
            expect(cursor.depth).toBe(2);
            // x
            cursor.advance();
            // ) — closes contains
            expect(cursor.kind).toBe(CssTokenKind.CloseParenthesis);
            cursor.advance();
            expect(cursor.depth).toBe(1);
            // ) — closes has
            expect(cursor.kind).toBe(CssTokenKind.CloseParenthesis);
            cursor.advance();
            expect(cursor.depth).toBe(0);
        });

        test('tracks bracket depth', () => {
            cursor.reset('[attr]');
            expect(cursor.bracketNesting).toBe(0);
            // [
            cursor.advance();
            expect(cursor.bracketNesting).toBe(1);
            // attr
            cursor.advance();
            // ]
            expect(cursor.kind).toBe(CssTokenKind.CloseSquareBracket);
            cursor.advance();
            expect(cursor.bracketNesting).toBe(0);
        });
    });

    describe('skipWhitespace', () => {
        test('skips multiple whitespace tokens', () => {
            cursor.reset('  div');
            expect(cursor.kind).toBe(CssTokenKind.Whitespace);
            cursor.skipWhitespace();
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('div');
        });

        test('no-op when not on whitespace', () => {
            cursor.reset('div');
            cursor.skipWhitespace();
            expect(cursor.kind).toBe(CssTokenKind.Ident);
            expect(cursor.value).toBe('div');
        });
    });

    describe('reuse', () => {
        test('reset allows reuse without allocation', () => {
            cursor.reset('first');
            expect(cursor.value).toBe('first');
            cursor.reset('second');
            expect(cursor.value).toBe('second');
        });
    });

    describe('capacity handling', () => {
        test('does not truncate selectors exceeding the initial buffer capacity', () => {
            // Small initial capacity to force a grow-and-retokenize.
            const smallCursor = new CssCursor(8);
            const selector = '.a'.repeat(600);

            smallCursor.reset(selector);

            let last = 0;
            while (!smallCursor.isEof()) {
                last = smallCursor.end;
                smallCursor.advance();
            }

            // The last token must reach the end of the whole selector,
            // proving nothing was silently dropped.
            expect(last).toBe(selector.length);
        });
    });
});
