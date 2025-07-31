import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { StringLineReader } from '../../../src/filterlist/reader/string-line-reader';

describe('StringLineReader', () => {
    let reader: StringLineReader;

    describe('LF line endings', () => {
        beforeEach(() => {
            reader = new StringLineReader('line1\nline2\nline3');
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
            reader = new StringLineReader('line1\r\nline2\r\nline3');
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
            reader = new StringLineReader('a\r\nb\nc\r\nd');
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
            reader = new StringLineReader('singleline');
        });

        it('returns the whole string then null', () => {
            expect(reader.readLine()).toBe('singleline');
            expect(reader.readLine()).toBeNull();
        });
    });

    describe('Empty string', () => {
        beforeEach(() => {
            reader = new StringLineReader('');
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
            const text = 'line1\nline2';
            reader = new StringLineReader(text);
            expect(reader.getDataLength()).toBe(text.length);
        });
    });
});
