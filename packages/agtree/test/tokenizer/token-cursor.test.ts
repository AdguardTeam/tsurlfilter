import { describe, test, expect } from 'vitest';

import { TokenBuffer } from '../../src/tokenizer/token-buffer';
import { TokenCursor, type CursorState } from '../../src/tokenizer/token-cursor';
import { TokenType } from '../../src/tokenizer/token-types';

/**
 * Helper to create a cursor with sample tokens
 * Input: "hello world"
 * Tokens: [Ident(0-5), Whitespace(5-6), Ident(6-11)]
 *
 * @returns TokenCursor with sample tokens
 * @example
 * const cursor = createSampleCursor();
 * cursor.current(); // TokenType.Ident
 * cursor.text(); // "hello"
 */
function createSampleCursor(): TokenCursor {
    const input = 'hello world';
    const buf = new TokenBuffer();
    buf.push(TokenType.Ident, 5); // "hello"
    buf.push(TokenType.Whitespace, 6); // " "
    buf.push(TokenType.Ident, 11); // "world"
    return new TokenCursor(input, buf);
}

/**
 * Helper to create a cursor with line breaks
 * Input: "a\nb\nc"
 * Tokens: [Ident(0-1), LineBreak(1-2), Ident(2-3), LineBreak(3-4), Ident(4-5)]
 *
 * @returns TokenCursor with multiple lines
 * @example
 * const cursor = createMultiLineCursor();
 * cursor.current(); // TokenType.Ident
 * cursor.text(); // "a"
 */
function createMultiLineCursor(): TokenCursor {
    const input = 'a\nb\nc';
    const buf = new TokenBuffer();
    buf.push(TokenType.Ident, 1); // "a"
    buf.push(TokenType.LineBreak, 2); // "\n"
    buf.push(TokenType.Ident, 3); // "b"
    buf.push(TokenType.LineBreak, 4); // "\n"
    buf.push(TokenType.Ident, 5); // "c"
    return new TokenCursor(input, buf);
}

describe('TokenCursor', () => {
    describe('constructor', () => {
        test('should initialize with input and buffer', () => {
            const input = 'test';
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 4);
            const cursor = new TokenCursor(input, buf);

            expect(cursor.input).toBe(input);
            expect(cursor.buf).toBe(buf);
            expect(cursor.pos).toBe(0);
            expect(cursor.lo).toBe(0);
            expect(cursor.hi).toBe(1);
        });

        test('should set hi to buffer count', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 6);
            buf.push(TokenType.Ident, 11);
            const cursor = new TokenCursor('hello world', buf);

            expect(cursor.hi).toBe(3);
        });

        test('should initialize with empty buffer', () => {
            const buf = new TokenBuffer();
            const cursor = new TokenCursor('', buf);

            expect(cursor.pos).toBe(0);
            expect(cursor.lo).toBe(0);
            expect(cursor.hi).toBe(0);
        });
    });

    describe('atEnd', () => {
        test('should return true when at end', () => {
            const cursor = createSampleCursor();
            cursor.pos = 3;
            expect(cursor.atEnd).toBe(true);
        });

        test('should return false when not at end', () => {
            const cursor = createSampleCursor();
            expect(cursor.atEnd).toBe(false);
        });

        test('should return true for empty view', () => {
            const buf = new TokenBuffer();
            const cursor = new TokenCursor('', buf);
            expect(cursor.atEnd).toBe(true);
        });
    });

    describe('remaining', () => {
        test('should return correct count of remaining tokens', () => {
            const cursor = createSampleCursor();
            expect(cursor.remaining()).toBe(3);

            cursor.advance(1);
            expect(cursor.remaining()).toBe(2);

            cursor.advance(2);
            expect(cursor.remaining()).toBe(0);
        });

        test('should return 0 when at end', () => {
            const cursor = createSampleCursor();
            cursor.pos = 3;
            expect(cursor.remaining()).toBe(0);
        });

        test('should never return negative', () => {
            const cursor = createSampleCursor();
            cursor.pos = 10;
            expect(cursor.remaining()).toBe(0);
        });
    });

    describe('count', () => {
        test('should return total tokens in view', () => {
            const cursor = createSampleCursor();
            expect(cursor.count()).toBe(3);
        });

        test('should return correct count for restricted view', () => {
            const cursor = createSampleCursor();
            cursor.setView(1, 2);
            expect(cursor.count()).toBe(1);
        });

        test('should return 0 for empty view', () => {
            const cursor = createSampleCursor();
            cursor.setView(1, 1);
            expect(cursor.count()).toBe(0);
        });
    });

    describe('isEmpty', () => {
        test('should return false for non-empty view', () => {
            const cursor = createSampleCursor();
            expect(cursor.isEmpty()).toBe(false);
        });

        test('should return true for empty view', () => {
            const cursor = createSampleCursor();
            cursor.setView(1, 1);
            expect(cursor.isEmpty()).toBe(true);
        });

        test('should return true when lo >= hi', () => {
            const cursor = createSampleCursor();
            cursor.lo = 2;
            cursor.hi = 1;
            expect(cursor.isEmpty()).toBe(true);
        });
    });

    describe('reset', () => {
        test('should reset position to lo', () => {
            const cursor = createSampleCursor();
            cursor.advance(2);
            expect(cursor.pos).toBe(2);

            cursor.reset();
            expect(cursor.pos).toBe(0);
        });

        test('should reset to view start when view is restricted', () => {
            const cursor = createSampleCursor();
            cursor.setView(1, 3);
            cursor.advance(1);
            expect(cursor.pos).toBe(2);

            cursor.reset();
            expect(cursor.pos).toBe(1);
        });
    });

    describe('reInit', () => {
        test('should reinitialize with new input', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            const cursor = new TokenCursor('hello', buf);

            buf.reset();
            buf.push(TokenType.Ident, 5);
            cursor.reInit('world');

            expect(cursor.input).toBe('world');
            expect(cursor.pos).toBe(0);
            expect(cursor.lo).toBe(0);
            expect(cursor.hi).toBe(1);
        });

        test('should clear state stack', () => {
            const cursor = createSampleCursor();
            cursor.pushState();
            cursor.pushState();
            expect(cursor.stackDepth()).toBe(2);

            cursor.reInit('test');
            expect(cursor.stackDepth()).toBe(0);
        });

        test('should reset view bounds to full buffer', () => {
            const cursor = createSampleCursor();
            cursor.setView(1, 2);
            expect(cursor.lo).toBe(1);
            expect(cursor.hi).toBe(2);

            cursor.reInit('hello world');
            expect(cursor.lo).toBe(0);
            expect(cursor.hi).toBe(3);
        });

        test('should enable cursor reuse pattern', () => {
            const buf = new TokenBuffer();
            const cursor = new TokenCursor('', buf);

            const lines = ['hello', 'world', 'test'];
            for (const line of lines) {
                buf.reset();
                buf.push(TokenType.Ident, line.length);
                cursor.reInit(line);

                expect(cursor.input).toBe(line);
                expect(cursor.text()).toBe(line);
                expect(cursor.pos).toBe(0);
                expect(cursor.hi).toBe(1);
            }
        });

        test('should work with empty input', () => {
            const buf = new TokenBuffer();
            const cursor = new TokenCursor('test', buf);

            cursor.reInit('');
            expect(cursor.input).toBe('');
            expect(cursor.pos).toBe(0);
            expect(cursor.hi).toBe(0);
        });

        test('should update hi to current buffer count', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            const cursor = new TokenCursor('hello', buf);

            buf.reset();
            buf.push(TokenType.Ident, 3);
            buf.push(TokenType.Whitespace, 4);
            buf.push(TokenType.Ident, 7);
            cursor.reInit('hi test');

            expect(cursor.hi).toBe(3);
            expect(cursor.count()).toBe(3);
        });
    });

    describe('clone', () => {
        test('should create independent copy', () => {
            const cursor = createSampleCursor();
            cursor.pos = 1;
            cursor.setView(0, 2);

            const cloned = cursor.clone();

            expect(cloned.input).toBe(cursor.input);
            expect(cloned.buf).toBe(cursor.buf);
            expect(cloned.pos).toBe(1);
            expect(cloned.lo).toBe(0);
            expect(cloned.hi).toBe(2);
        });

        test('should have independent state', () => {
            const cursor = createSampleCursor();
            const cloned = cursor.clone();

            cursor.advance(2);
            expect(cursor.pos).toBe(2);
            expect(cloned.pos).toBe(0);
        });

        test('should share same buffer', () => {
            const cursor = createSampleCursor();
            const cloned = cursor.clone();

            expect(cloned.buf).toBe(cursor.buf);
        });
    });

    describe('tokenType', () => {
        test('should return current token type', () => {
            const cursor = createSampleCursor();
            expect(cursor.tokenType()).toBe(TokenType.Ident);
        });

        test('should return token type at offset', () => {
            const cursor = createSampleCursor();
            expect(cursor.tokenType(0)).toBe(TokenType.Ident);
            expect(cursor.tokenType(1)).toBe(TokenType.Whitespace);
            expect(cursor.tokenType(2)).toBe(TokenType.Ident);
        });

        test('should return Eof when out of bounds', () => {
            const cursor = createSampleCursor();
            expect(cursor.tokenType(10)).toBe(TokenType.Eof);
            expect(cursor.tokenType(-1)).toBe(TokenType.Eof);
        });
    });

    describe('start/end/length', () => {
        test('should return correct positions', () => {
            const cursor = createSampleCursor();
            expect(cursor.start()).toBe(0);
            expect(cursor.end()).toBe(5);
            expect(cursor.length()).toBe(5);
        });

        test('should work with offsets', () => {
            const cursor = createSampleCursor();
            expect(cursor.start(1)).toBe(5);
            expect(cursor.end(1)).toBe(6);
            expect(cursor.length(1)).toBe(1);

            expect(cursor.start(2)).toBe(6);
            expect(cursor.end(2)).toBe(11);
            expect(cursor.length(2)).toBe(5);
        });

        test('should return input length when out of bounds', () => {
            const cursor = createSampleCursor();
            expect(cursor.start(10)).toBe(11);
            expect(cursor.end(10)).toBe(11);
        });
    });

    describe('text', () => {
        test('should return token text', () => {
            const cursor = createSampleCursor();
            expect(cursor.text()).toBe('hello');
            expect(cursor.text(1)).toBe(' ');
            expect(cursor.text(2)).toBe('world');
        });

        test('should return empty string when out of bounds', () => {
            const cursor = createSampleCursor();
            expect(cursor.text(10)).toBe('');
        });
    });

    describe('startAtToken/endAtToken/getLocation', () => {
        test('should return positions for arbitrary token index', () => {
            const cursor = createSampleCursor();
            expect(cursor.startAtToken(0)).toBe(0);
            expect(cursor.endAtToken(0)).toBe(5);
            expect(cursor.startAtToken(2)).toBe(6);
            expect(cursor.endAtToken(2)).toBe(11);
        });

        test('should get location range', () => {
            const cursor = createSampleCursor();
            const loc = cursor.getLocation(0, 2);
            expect(loc.start).toBe(0);
            expect(loc.end).toBe(11);
        });
    });

    describe('sliceTokens', () => {
        test('should slice text from token range', () => {
            const cursor = createSampleCursor();
            expect(cursor.sliceTokens(0, 1)).toBe('hello');
            expect(cursor.sliceTokens(0, 3)).toBe('hello world');
            expect(cursor.sliceTokens(2, 3)).toBe('world');
        });

        test('should use hi as default end', () => {
            const cursor = createSampleCursor();
            expect(cursor.sliceTokens(0)).toBe('hello world');
        });
    });

    describe('current/peek', () => {
        test('should return current token type', () => {
            const cursor = createSampleCursor();
            expect(cursor.current()).toBe(TokenType.Ident);
        });

        test('should peek ahead', () => {
            const cursor = createSampleCursor();
            expect(cursor.peek()).toBe(TokenType.Whitespace);
            expect(cursor.peek(2)).toBe(TokenType.Ident);
            expect(cursor.pos).toBe(0); // Should not move
        });

        test('should return Eof when peeking beyond end', () => {
            const cursor = createSampleCursor();
            expect(cursor.peek(10)).toBe(TokenType.Eof);
        });
    });

    describe('peekNonWhitespace', () => {
        test('should find next non-whitespace token', () => {
            const cursor = createSampleCursor();
            expect(cursor.peekNonWhitespace()).toBe(TokenType.Ident);
        });

        test('should skip whitespace', () => {
            const input = 'a   b';
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 1);
            buf.push(TokenType.Whitespace, 4);
            buf.push(TokenType.Ident, 5);
            const cursor = new TokenCursor(input, buf);

            cursor.advance(1);
            expect(cursor.peekNonWhitespace()).toBe(TokenType.Ident);
        });

        test('should optionally skip line breaks', () => {
            const cursor = createMultiLineCursor();
            expect(cursor.peekNonWhitespace(1, false)).toBe(TokenType.LineBreak);
            expect(cursor.peekNonWhitespace(1, true)).toBe(TokenType.Ident);
        });

        test('should return Eof if none found', () => {
            const input = 'a   ';
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 1);
            buf.push(TokenType.Whitespace, 4);
            const cursor = new TokenCursor(input, buf);

            cursor.advance(1);
            expect(cursor.peekNonWhitespace()).toBe(TokenType.Eof);
        });
    });

    describe('advance', () => {
        test('should move forward by n tokens', () => {
            const cursor = createSampleCursor();
            cursor.advance(1);
            expect(cursor.pos).toBe(1);

            cursor.advance(2);
            expect(cursor.pos).toBe(3);
        });

        test('should clamp to hi', () => {
            const cursor = createSampleCursor();
            cursor.advance(100);
            expect(cursor.pos).toBe(3);
        });

        test('should move backward with negative n', () => {
            const cursor = createSampleCursor();
            cursor.pos = 2;
            cursor.advance(-1);
            expect(cursor.pos).toBe(1);
        });

        test('should clamp to lo', () => {
            const cursor = createSampleCursor();
            cursor.advance(-100);
            expect(cursor.pos).toBe(0);
        });
    });

    describe('next', () => {
        test('should return current and advance', () => {
            const cursor = createSampleCursor();
            const type = cursor.next();
            expect(type).toBe(TokenType.Ident);
            expect(cursor.pos).toBe(1);
        });

        test('should iterate through tokens', () => {
            const cursor = createSampleCursor();
            expect(cursor.next()).toBe(TokenType.Ident);
            expect(cursor.next()).toBe(TokenType.Whitespace);
            expect(cursor.next()).toBe(TokenType.Ident);
        });
    });

    describe('prev', () => {
        test('should move backward by 1', () => {
            const cursor = createSampleCursor();
            cursor.pos = 2;
            cursor.prev();
            expect(cursor.pos).toBe(1);
        });

        test('should not move past lo', () => {
            const cursor = createSampleCursor();
            cursor.prev();
            expect(cursor.pos).toBe(0);
        });

        test('should respect view bounds', () => {
            const cursor = createSampleCursor();
            cursor.setView(1, 3);
            cursor.prev();
            expect(cursor.pos).toBe(1);
        });
    });

    describe('seek', () => {
        test('should seek to specific index', () => {
            const cursor = createSampleCursor();
            cursor.seek(2);
            expect(cursor.pos).toBe(2);
        });

        test('should clamp to lo', () => {
            const cursor = createSampleCursor();
            cursor.seek(-5);
            expect(cursor.pos).toBe(0);
        });

        test('should clamp to hi', () => {
            const cursor = createSampleCursor();
            cursor.seek(100);
            expect(cursor.pos).toBe(3);
        });

        test('should allow seeking to hi (EOF)', () => {
            const cursor = createSampleCursor();
            cursor.seek(3);
            expect(cursor.pos).toBe(3);
            expect(cursor.atEnd).toBe(true);
        });
    });

    describe('seekToEnd', () => {
        test('should jump to end', () => {
            const cursor = createSampleCursor();
            cursor.seekToEnd();
            expect(cursor.pos).toBe(3);
            expect(cursor.atEnd).toBe(true);
        });
    });

    describe('viewText', () => {
        test('should return text of entire view', () => {
            const cursor = createSampleCursor();
            expect(cursor.viewText()).toBe('hello world');
        });

        test('should return text of restricted view', () => {
            const cursor = createSampleCursor();
            cursor.setView(0, 1);
            expect(cursor.viewText()).toBe('hello');

            cursor.setView(1, 3);
            expect(cursor.viewText()).toBe(' world');
        });

        test('should return empty string for empty view', () => {
            const cursor = createSampleCursor();
            cursor.setView(1, 1);
            expect(cursor.viewText()).toBe('');
        });
    });

    describe('has', () => {
        test('should find token type in view', () => {
            const cursor = createSampleCursor();
            expect(cursor.has(TokenType.Ident)).toBe(true);
            expect(cursor.has(TokenType.Whitespace)).toBe(true);
            expect(cursor.has(TokenType.Comma)).toBe(false);
        });

        test('should respect view bounds', () => {
            const cursor = createSampleCursor();
            cursor.setView(0, 1);
            expect(cursor.has(TokenType.Ident)).toBe(true);
            expect(cursor.has(TokenType.Whitespace)).toBe(false);
        });

        test('should not modify cursor position', () => {
            const cursor = createSampleCursor();
            cursor.has(TokenType.Ident);
            expect(cursor.pos).toBe(0);
        });
    });

    describe('hasAny', () => {
        test('should find any of the token types', () => {
            const cursor = createSampleCursor();
            const types = new Set([TokenType.Comma, TokenType.Whitespace]);
            expect(cursor.hasAny(types)).toBe(true);
        });

        test('should return false if none found', () => {
            const cursor = createSampleCursor();
            const types = new Set([TokenType.Comma, TokenType.Dot]);
            expect(cursor.hasAny(types)).toBe(false);
        });

        test('should not modify cursor position', () => {
            const cursor = createSampleCursor();
            cursor.hasAny(new Set([TokenType.Ident]));
            expect(cursor.pos).toBe(0);
        });
    });

    describe('expect', () => {
        test('should advance if type matches', () => {
            const cursor = createSampleCursor();
            const result = cursor.expect(TokenType.Ident);
            expect(result).toBe(true);
            expect(cursor.pos).toBe(1);
        });

        test('should throw if type does not match', () => {
            const cursor = createSampleCursor();
            expect(() => cursor.expect(TokenType.Comma)).toThrow();
        });

        test('should not throw if throwOnFail is false', () => {
            const cursor = createSampleCursor();
            const result = cursor.expect(TokenType.Comma, false);
            expect(result).toBe(false);
            expect(cursor.pos).toBe(0);
        });

        test('should include helpful error message', () => {
            const cursor = createSampleCursor();
            try {
                cursor.expect(TokenType.Comma);
            } catch (e) {
                expect((e as Error).message).toContain('Expected token');
                expect((e as Error).message).toContain('tokenIndex=0');
            }
        });
    });

    describe('skip', () => {
        test('should skip consecutive tokens of same type', () => {
            const input = 'aaa';
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 1);
            buf.push(TokenType.Ident, 2);
            buf.push(TokenType.Ident, 3);
            const cursor = new TokenCursor(input, buf);

            cursor.skip(TokenType.Ident);
            expect(cursor.pos).toBe(3);
        });

        test('should stop at different token type', () => {
            const cursor = createSampleCursor();
            cursor.skip(TokenType.Ident);
            expect(cursor.pos).toBe(1);
            expect(cursor.current()).toBe(TokenType.Whitespace);
        });

        test('should do nothing if current token is different', () => {
            const cursor = createSampleCursor();
            cursor.skip(TokenType.Comma);
            expect(cursor.pos).toBe(0);
        });
    });

    describe('skipWhitespace', () => {
        test('should skip whitespace tokens', () => {
            const input = 'a   b';
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 1);
            buf.push(TokenType.Whitespace, 2);
            buf.push(TokenType.Whitespace, 3);
            buf.push(TokenType.Whitespace, 4);
            buf.push(TokenType.Ident, 5);
            const cursor = new TokenCursor(input, buf);

            cursor.advance(1);
            cursor.skipWhitespace();
            expect(cursor.pos).toBe(4);
            expect(cursor.current()).toBe(TokenType.Ident);
        });

        test('should optionally skip line breaks', () => {
            const cursor = createMultiLineCursor();
            cursor.advance(1);
            cursor.skipWhitespace(false);
            expect(cursor.current()).toBe(TokenType.LineBreak);

            cursor.skipWhitespace(true);
            expect(cursor.current()).toBe(TokenType.Ident);
        });
    });

    describe('skipUntil', () => {
        test('should skip until token type found', () => {
            const cursor = createSampleCursor();
            cursor.skipUntil(TokenType.Whitespace);
            expect(cursor.current()).toBe(TokenType.Whitespace);
        });

        test('should work with predicate', () => {
            const cursor = createSampleCursor();
            cursor.skipUntil((t) => t === TokenType.Whitespace);
            expect(cursor.current()).toBe(TokenType.Whitespace);
        });

        test('should stop at token without skipping it', () => {
            const cursor = createSampleCursor();
            cursor.skipUntil(TokenType.Whitespace);
            expect(cursor.pos).toBe(1);
        });

        test('should reach end if not found', () => {
            const cursor = createSampleCursor();
            cursor.skipUntil(TokenType.Comma);
            expect(cursor.atEnd).toBe(true);
        });
    });

    describe('skipUntilBackwards', () => {
        test('should skip backward until token found', () => {
            const cursor = createSampleCursor();
            cursor.seekToEnd();
            cursor.skipUntilBackwards(TokenType.Whitespace);
            expect(cursor.current()).toBe(TokenType.Whitespace);
        });

        test('should work with predicate', () => {
            const cursor = createSampleCursor();
            cursor.seekToEnd();
            cursor.skipUntilBackwards((t) => t === TokenType.Whitespace);
            expect(cursor.current()).toBe(TokenType.Whitespace);
        });

        test('should stop at lo', () => {
            const cursor = createSampleCursor();
            cursor.pos = 2;
            cursor.skipUntilBackwards(TokenType.Comma);
            expect(cursor.pos).toBe(0);
        });
    });

    describe('textEquals', () => {
        test('should compare token text without allocation', () => {
            const cursor = createSampleCursor();
            expect(cursor.textEquals('hello')).toBe(true);
            expect(cursor.textEquals('world')).toBe(false);
        });

        test('should work with offset', () => {
            const cursor = createSampleCursor();
            expect(cursor.textEquals(' ', 1)).toBe(true);
            expect(cursor.textEquals('world', 2)).toBe(true);
        });

        test('should use char comparison for short strings', () => {
            const cursor = createSampleCursor();
            expect(cursor.textEquals('hello')).toBe(true);
        });

        test('should use slice comparison for long strings', () => {
            const input = 'this is a very long string';
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 26);
            const cursor = new TokenCursor(input, buf);

            expect(cursor.textEquals('this is a very long string')).toBe(true);
        });

        test('should return false for different lengths', () => {
            const cursor = createSampleCursor();
            expect(cursor.textEquals('hi')).toBe(false);
        });
    });

    describe('setView', () => {
        test('should set view bounds', () => {
            const cursor = createSampleCursor();
            cursor.setView(1, 2);
            expect(cursor.lo).toBe(1);
            expect(cursor.hi).toBe(2);
        });

        test('should clamp negative lo to 0', () => {
            const cursor = createSampleCursor();
            cursor.setView(-5, 2);
            expect(cursor.lo).toBe(0);
        });

        test('should clamp hi to buffer count', () => {
            const cursor = createSampleCursor();
            cursor.setView(0, 100);
            expect(cursor.hi).toBe(3);
        });

        test('should clamp position to new bounds', () => {
            const cursor = createSampleCursor();
            cursor.pos = 2;
            cursor.setView(0, 1);
            expect(cursor.pos).toBe(1);

            cursor.setView(2, 3);
            expect(cursor.pos).toBe(2);
        });

        test('should throw if lo > hi', () => {
            const cursor = createSampleCursor();
            expect(() => cursor.setView(2, 1)).toThrow('Invalid view');
        });
    });

    describe('setViewToLineFromHere', () => {
        test('should set view to current line', () => {
            const cursor = createMultiLineCursor();
            cursor.setViewToLineFromHere();
            expect(cursor.lo).toBe(0);
            expect(cursor.hi).toBe(1);
            expect(cursor.viewText()).toBe('a');
        });

        test('should optionally include line break', () => {
            const cursor = createMultiLineCursor();
            cursor.setViewToLineFromHere(true);
            expect(cursor.hi).toBe(2);
            expect(cursor.viewText()).toBe('a\n');
        });

        test('should work from middle of line', () => {
            const cursor = createMultiLineCursor();
            cursor.pos = 2;
            cursor.setViewToLineFromHere();
            expect(cursor.viewText()).toBe('b');
        });

        test('should handle EOF', () => {
            const cursor = createMultiLineCursor();
            cursor.pos = 4;
            cursor.setViewToLineFromHere();
            expect(cursor.viewText()).toBe('c');
        });
    });

    describe('saveState/restoreState', () => {
        test('should save and restore state', () => {
            const cursor = createSampleCursor();
            cursor.pos = 1;
            cursor.setView(0, 2);

            const state: CursorState = { pos: 0, lo: 0, hi: 0 };
            cursor.saveState(state);

            cursor.pos = 2;
            cursor.setView(1, 3);

            cursor.restoreState(state);
            expect(cursor.pos).toBe(1);
            expect(cursor.lo).toBe(0);
            expect(cursor.hi).toBe(2);
        });

        test('should be GC-friendly by reusing state object', () => {
            const cursor = createSampleCursor();
            const state: CursorState = { pos: 0, lo: 0, hi: 0 };

            cursor.saveState(state);
            cursor.advance(1);
            cursor.restoreState(state);

            expect(cursor.pos).toBe(0);
        });
    });

    describe('pushState/popState', () => {
        test('should push and pop state', () => {
            const cursor = createSampleCursor();
            cursor.pushState();

            cursor.pos = 2;
            cursor.setView(1, 2);

            const result = cursor.popState();
            expect(result).toBe(true);
            expect(cursor.pos).toBe(0);
            expect(cursor.lo).toBe(0);
            expect(cursor.hi).toBe(3);
        });

        test('should support multiple pushes', () => {
            const cursor = createSampleCursor();

            cursor.pushState();
            cursor.pos = 1;

            cursor.pushState();
            cursor.pos = 2;

            cursor.popState();
            expect(cursor.pos).toBe(1);

            cursor.popState();
            expect(cursor.pos).toBe(0);
        });

        test('should return false when stack is empty', () => {
            const cursor = createSampleCursor();
            const result = cursor.popState();
            expect(result).toBe(false);
        });

        test('should throw on stack overflow', () => {
            const cursor = createSampleCursor();
            for (let i = 0; i < 32; i += 1) {
                cursor.pushState();
            }
            expect(() => cursor.pushState()).toThrow('State stack overflow');
        });
    });

    describe('stackDepth', () => {
        test('should return current stack depth', () => {
            const cursor = createSampleCursor();
            expect(cursor.stackDepth()).toBe(0);

            cursor.pushState();
            expect(cursor.stackDepth()).toBe(1);

            cursor.pushState();
            expect(cursor.stackDepth()).toBe(2);

            cursor.popState();
            expect(cursor.stackDepth()).toBe(1);
        });
    });

    describe('complex scenarios', () => {
        test('should handle realistic parsing workflow', () => {
            const input = 'example.com##.ads';
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 7); // "example"
            buf.push(TokenType.Dot, 8); // "."
            buf.push(TokenType.Ident, 11); // "com"
            buf.push(TokenType.HashMark, 12); // "#"
            buf.push(TokenType.HashMark, 13); // "#"
            buf.push(TokenType.Dot, 14); // "."
            buf.push(TokenType.Ident, 17); // "ads"

            const cursor = new TokenCursor(input, buf);

            // Parse domain
            expect(cursor.current()).toBe(TokenType.Ident);
            cursor.advance(1);
            expect(cursor.current()).toBe(TokenType.Dot);
            cursor.advance(1);
            expect(cursor.current()).toBe(TokenType.Ident);
            cursor.advance(1);

            // Find separator
            expect(cursor.current()).toBe(TokenType.HashMark);
            cursor.advance(2);

            // Parse selector
            cursor.setViewToLineFromHere();
            expect(cursor.viewText()).toBe('.ads');
        });

        test('should handle nested state management', () => {
            const cursor = createSampleCursor();

            cursor.pushState();
            cursor.advance(1);

            cursor.pushState();
            cursor.advance(1);
            cursor.popState();

            expect(cursor.pos).toBe(1);
            cursor.popState();
            expect(cursor.pos).toBe(0);
        });

        test('should handle view restrictions and navigation', () => {
            const cursor = createSampleCursor();

            cursor.setView(1, 2);
            expect(cursor.count()).toBe(1);
            expect(cursor.current()).toBe(TokenType.Whitespace);

            cursor.advance(1);
            expect(cursor.atEnd).toBe(true);
        });
    });

    describe('edge cases', () => {
        test('should handle empty buffer', () => {
            const buf = new TokenBuffer();
            const cursor = new TokenCursor('', buf);

            expect(cursor.atEnd).toBe(true);
            expect(cursor.count()).toBe(0);
            expect(cursor.remaining()).toBe(0);
            expect(cursor.current()).toBe(TokenType.Eof);
        });

        test('should handle single token', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 1);
            const cursor = new TokenCursor('a', buf);

            expect(cursor.count()).toBe(1);
            expect(cursor.current()).toBe(TokenType.Ident);
            cursor.advance(1);
            expect(cursor.atEnd).toBe(true);
        });

        test('should handle view at end of buffer', () => {
            const cursor = createSampleCursor();
            cursor.setView(3, 3);
            expect(cursor.isEmpty()).toBe(true);
            expect(cursor.atEnd).toBe(true);
        });

        test('should handle negative advances', () => {
            const cursor = createSampleCursor();
            cursor.pos = 2;
            cursor.advance(-5);
            expect(cursor.pos).toBe(0);
        });

        test('should handle very large view bounds', () => {
            const cursor = createSampleCursor();
            cursor.setView(0, 1000000);
            expect(cursor.hi).toBe(3);
        });
    });
});
