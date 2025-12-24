import { describe, test, expect } from 'vitest';

import { TokenBuffer } from '../../src/tokenizer/token-buffer';
import { TokenType } from '../../src/tokenizer/token-types';

describe('TokenBuffer', () => {
    describe('constructor', () => {
        test('should create buffer with default capacity', () => {
            const buf = new TokenBuffer();
            expect(buf.count).toBe(0);
        });

        test('should create buffer with custom capacity', () => {
            const buf = new TokenBuffer(512);
            expect(buf.count).toBe(0);
        });

        test('should create buffer with small capacity', () => {
            const buf = new TokenBuffer(1);
            expect(buf.count).toBe(0);
        });
    });

    describe('count', () => {
        test('should return 0 for empty buffer', () => {
            const buf = new TokenBuffer();
            expect(buf.count).toBe(0);
        });

        test('should return correct count after pushing tokens', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            expect(buf.count).toBe(1);

            buf.push(TokenType.Whitespace, 6);
            expect(buf.count).toBe(2);

            buf.push(TokenType.Comma, 7);
            expect(buf.count).toBe(3);
        });

        test('should return correct count after many pushes', () => {
            const buf = new TokenBuffer();
            const count = 1000;
            for (let i = 0; i < count; i += 1) {
                buf.push(TokenType.Ident, i + 1);
            }
            expect(buf.count).toBe(count);
        });
    });

    describe('reset', () => {
        test('should reset count to 0', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 6);
            expect(buf.count).toBe(2);

            buf.reset();
            expect(buf.count).toBe(0);
        });

        test('should allow reuse after reset', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 6);
            buf.reset();

            buf.push(TokenType.Comma, 10);
            expect(buf.count).toBe(1);
            expect(buf.typeAt(0)).toBe(TokenType.Comma);
            expect(buf.endAt(0)).toBe(10);
        });

        test('should not deallocate memory after reset', () => {
            const buf = new TokenBuffer(10);
            for (let i = 0; i < 5; i += 1) {
                buf.push(TokenType.Ident, i + 1);
            }
            buf.reset();

            // Should not need to grow when adding same number of tokens
            for (let i = 0; i < 5; i += 1) {
                buf.push(TokenType.Whitespace, i + 1);
            }
            expect(buf.count).toBe(5);
        });
    });

    describe('push', () => {
        test('should push single token', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);

            expect(buf.count).toBe(1);
            expect(buf.typeAt(0)).toBe(TokenType.Ident);
            expect(buf.endAt(0)).toBe(5);
        });

        test('should push multiple tokens', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 6);
            buf.push(TokenType.Comma, 7);

            expect(buf.count).toBe(3);
            expect(buf.typeAt(0)).toBe(TokenType.Ident);
            expect(buf.typeAt(1)).toBe(TokenType.Whitespace);
            expect(buf.typeAt(2)).toBe(TokenType.Comma);
            expect(buf.endAt(0)).toBe(5);
            expect(buf.endAt(1)).toBe(6);
            expect(buf.endAt(2)).toBe(7);
        });

        test('should mask type to 8 bits', () => {
            const buf = new TokenBuffer();
            // 0x1FF = 511, should be masked to 0xFF = 255
            buf.push(0x1FF, 10);
            expect(buf.typeAt(0)).toBe(0xFF);
        });

        test('should convert end to unsigned 32-bit', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, -1);
            // -1 >>> 0 = 4294967295
            expect(buf.endAt(0)).toBe(4294967295);
        });

        test('should handle large end positions', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 2147483647); // Max signed 32-bit
            expect(buf.endAt(0)).toBe(2147483647);
        });
    });

    describe('typeAt', () => {
        test('should return correct token type', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 6);
            buf.push(TokenType.Comma, 7);

            expect(buf.typeAt(0)).toBe(TokenType.Ident);
            expect(buf.typeAt(1)).toBe(TokenType.Whitespace);
            expect(buf.typeAt(2)).toBe(TokenType.Comma);
        });

        test('should return TokenType branded type', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            const type = buf.typeAt(0);
            expect(type).toBe(TokenType.Ident);
        });
    });

    describe('endAt', () => {
        test('should return correct end position', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 10);
            buf.push(TokenType.Comma, 15);

            expect(buf.endAt(0)).toBe(5);
            expect(buf.endAt(1)).toBe(10);
            expect(buf.endAt(2)).toBe(15);
        });
    });

    describe('startAt', () => {
        test('should return 0 for first token', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            expect(buf.startAt(0)).toBe(0);
        });

        test('should return previous end for subsequent tokens', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 10);
            buf.push(TokenType.Comma, 15);

            expect(buf.startAt(0)).toBe(0);
            expect(buf.startAt(1)).toBe(5);
            expect(buf.startAt(2)).toBe(10);
        });

        test('should work correctly with sequential positions', () => {
            const buf = new TokenBuffer();
            const positions = [3, 7, 12, 20, 25];
            for (const pos of positions) {
                buf.push(TokenType.Ident, pos);
            }

            expect(buf.startAt(0)).toBe(0);
            expect(buf.startAt(1)).toBe(3);
            expect(buf.startAt(2)).toBe(7);
            expect(buf.startAt(3)).toBe(12);
            expect(buf.startAt(4)).toBe(20);
        });
    });

    describe('lengthAt', () => {
        test('should calculate correct token length', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5); // 0-5 = length 5
            buf.push(TokenType.Whitespace, 6); // 5-6 = length 1
            buf.push(TokenType.Comma, 15); // 6-15 = length 9

            expect(buf.lengthAt(0)).toBe(5);
            expect(buf.lengthAt(1)).toBe(1);
            expect(buf.lengthAt(2)).toBe(9);
        });

        test('should handle zero-length tokens', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 5); // Same position = 0 length

            expect(buf.lengthAt(1)).toBe(0);
        });
    });

    describe('automatic growth', () => {
        test('should automatically grow when capacity exceeded', () => {
            const buf = new TokenBuffer(2);
            buf.push(TokenType.Ident, 1);
            buf.push(TokenType.Whitespace, 2);
            buf.push(TokenType.Comma, 3); // Should trigger growth

            expect(buf.count).toBe(3);
            expect(buf.typeAt(0)).toBe(TokenType.Ident);
            expect(buf.typeAt(1)).toBe(TokenType.Whitespace);
            expect(buf.typeAt(2)).toBe(TokenType.Comma);
        });

        test('should double capacity below growth threshold', () => {
            const buf = new TokenBuffer(1);
            // Should grow: 1 -> 2 -> 4 -> 8
            for (let i = 0; i < 8; i += 1) {
                buf.push(TokenType.Ident, i + 1);
            }
            expect(buf.count).toBe(8);
        });

        test('should preserve existing tokens when growing', () => {
            const buf = new TokenBuffer(2);
            buf.push(TokenType.Ident, 5);
            buf.push(TokenType.Whitespace, 10);
            buf.push(TokenType.Comma, 15); // Triggers growth

            expect(buf.typeAt(0)).toBe(TokenType.Ident);
            expect(buf.endAt(0)).toBe(5);
            expect(buf.typeAt(1)).toBe(TokenType.Whitespace);
            expect(buf.endAt(1)).toBe(10);
            expect(buf.typeAt(2)).toBe(TokenType.Comma);
            expect(buf.endAt(2)).toBe(15);
        });

        test('should handle many tokens with automatic growth', () => {
            const buf = new TokenBuffer(1);
            const count = 10000;
            for (let i = 0; i < count; i += 1) {
                buf.push(TokenType.Ident, i + 1);
            }

            expect(buf.count).toBe(count);
            expect(buf.typeAt(0)).toBe(TokenType.Ident);
            expect(buf.endAt(0)).toBe(1);
            expect(buf.typeAt(count - 1)).toBe(TokenType.Ident);
            expect(buf.endAt(count - 1)).toBe(count);
        });
    });

    describe('complex scenarios', () => {
        test('should handle realistic tokenization scenario', () => {
            const buf = new TokenBuffer();
            // Simulate tokenizing "example.com"
            buf.push(TokenType.Ident, 7); // "example"
            buf.push(TokenType.Dot, 8); // "."
            buf.push(TokenType.Ident, 11); // "com"

            expect(buf.count).toBe(3);
            expect(buf.startAt(0)).toBe(0);
            expect(buf.endAt(0)).toBe(7);
            expect(buf.lengthAt(0)).toBe(7);

            expect(buf.startAt(1)).toBe(7);
            expect(buf.endAt(1)).toBe(8);
            expect(buf.lengthAt(1)).toBe(1);

            expect(buf.startAt(2)).toBe(8);
            expect(buf.endAt(2)).toBe(11);
            expect(buf.lengthAt(2)).toBe(3);
        });

        test('should handle multiple reset and reuse cycles', () => {
            const buf = new TokenBuffer(10);

            // First cycle
            for (let i = 0; i < 5; i += 1) {
                buf.push(TokenType.Ident, i + 1);
            }
            expect(buf.count).toBe(5);

            // Reset and second cycle
            buf.reset();
            for (let i = 0; i < 3; i += 1) {
                buf.push(TokenType.Whitespace, i + 10);
            }
            expect(buf.count).toBe(3);
            expect(buf.typeAt(0)).toBe(TokenType.Whitespace);
            expect(buf.endAt(0)).toBe(10);

            // Reset and third cycle
            buf.reset();
            for (let i = 0; i < 7; i += 1) {
                buf.push(TokenType.Comma, i + 20);
            }
            expect(buf.count).toBe(7);
            expect(buf.typeAt(0)).toBe(TokenType.Comma);
            expect(buf.endAt(0)).toBe(20);
        });

        test('should handle all token types', () => {
            const buf = new TokenBuffer();
            const tokenTypes = [
                TokenType.Eof,
                TokenType.Whitespace,
                TokenType.LineBreak,
                TokenType.Ident,
                TokenType.Comma,
                TokenType.DollarSign,
                TokenType.Slash,
                TokenType.AtSign,
            ];

            for (let i = 0; i < tokenTypes.length; i += 1) {
                buf.push(tokenTypes[i], i + 1);
            }

            expect(buf.count).toBe(tokenTypes.length);
            for (let i = 0; i < tokenTypes.length; i += 1) {
                expect(buf.typeAt(i)).toBe(tokenTypes[i]);
                expect(buf.endAt(i)).toBe(i + 1);
            }
        });
    });

    describe('edge cases', () => {
        test('should handle buffer with zero initial capacity', () => {
            const buf = new TokenBuffer(0);
            expect(buf.count).toBe(0);

            buf.push(TokenType.Ident, 5);
            expect(buf.count).toBe(1);
            expect(buf.typeAt(0)).toBe(TokenType.Ident);
        });

        test('should handle very large token counts', () => {
            const buf = new TokenBuffer(1);
            const count = 100000;
            for (let i = 0; i < count; i += 1) {
                buf.push(TokenType.Ident, i);
            }

            expect(buf.count).toBe(count);
            expect(buf.typeAt(0)).toBe(TokenType.Ident);
            expect(buf.typeAt(count - 1)).toBe(TokenType.Ident);
        });

        test('should handle token type value 0', () => {
            const buf = new TokenBuffer();
            buf.push(TokenType.Eof, 5);
            expect(buf.typeAt(0)).toBe(TokenType.Eof);
            expect(buf.typeAt(0)).toBe(0);
        });

        test('should handle max 8-bit token type value', () => {
            const buf = new TokenBuffer();
            buf.push(255, 5);
            expect(buf.typeAt(0)).toBe(255);
        });
    });
});
