import {
    describe,
    it,
    expect,
    beforeEach,
} from 'vitest';
import { BufferLineReader } from '../../../src/filterlist/reader/buffer-line-reader';

/**
 * Encodes a string to a Uint8Array.
 *
 * @param str The string to encode.
 *
 * @returns The encoded Uint8Array.
 */
function encode(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

describe('BufferLineReader', () => {
    let reader: BufferLineReader;

    describe('LF line endings', () => {
        beforeEach(() => {
            reader = new BufferLineReader(encode('line1\nline2\nline3'));
        });

        it('reads lines correctly', () => {
            expect(reader.readLine()).toBe('line1');
            expect(reader.getCurrentLineNumber()).toBe(2);
            expect(reader.readLine()).toBe('line2');
            expect(reader.getCurrentLineNumber()).toBe(3);
            expect(reader.readLine()).toBe('line3');
            expect(reader.getCurrentLineNumber()).toBe(4);
            expect(reader.readLine()).toBeNull();
            expect(reader.getCurrentPos()).toBe(-1);
        });
    });

    describe('CRLF line endings', () => {
        beforeEach(() => {
            reader = new BufferLineReader(encode('line1\r\nline2\r\nline3'));
        });

        it('reads lines correctly', () => {
            expect(reader.readLine()).toBe('line1');
            expect(reader.getCurrentLineNumber()).toBe(2);
            expect(reader.readLine()).toBe('line2');
            expect(reader.getCurrentLineNumber()).toBe(3);
            expect(reader.readLine()).toBe('line3');
            expect(reader.getCurrentLineNumber()).toBe(4);
            expect(reader.readLine()).toBeNull();
            expect(reader.getCurrentPos()).toBe(-1);
        });
    });

    describe('Mixed endings', () => {
        beforeEach(() => {
            reader = new BufferLineReader(encode('a\r\nb\nc\r\nd'));
        });

        it('handles mixed line endings properly', () => {
            expect(reader.readLine()).toBe('a');
            expect(reader.readLine()).toBe('b');
            expect(reader.readLine()).toBe('c');
            expect(reader.readLine()).toBe('d');
            expect(reader.readLine()).toBeNull();
        });
    });

    describe('No line breaks', () => {
        beforeEach(() => {
            reader = new BufferLineReader(encode('singleline'));
        });

        it('returns the whole string then null', () => {
            expect(reader.readLine()).toBe('singleline');
            expect(reader.readLine()).toBeNull();
        });
    });

    describe('Empty buffer', () => {
        beforeEach(() => {
            reader = new BufferLineReader(encode(''));
        });

        it('immediately returns null', () => {
            expect(reader.readLine()).toBeNull();
            expect(reader.getCurrentLineNumber()).toBe(1);
            expect(reader.getCurrentPos()).toBe(-1);
            expect(reader.getDataLength()).toBe(0);
        });
    });

    describe('getDataLength()', () => {
        it('returns the correct data length', () => {
            const data = encode('line1\nline2');
            reader = new BufferLineReader(data);
            expect(reader.getDataLength()).toBe(data.length);
        });
    });
});
