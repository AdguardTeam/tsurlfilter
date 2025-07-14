import {
    describe,
    it,
    expect,
    beforeEach,
    vi,
} from 'vitest';
import * as fs from 'node:fs';
import { FileLineReader } from '../../../src/filterlist/reader/file-line-reader';

const encode = (str: string) => Buffer.from(new TextEncoder().encode(str));

vi.mock('node:fs', () => ({
    readFileSync: vi.fn(),
}));

describe('FileLineReader', () => {
    const mockedReadFileSync = vi.mocked(fs.readFileSync);

    describe('LF line endings', () => {
        beforeEach(() => {
            mockedReadFileSync.mockReturnValue(encode('line1\nline2\nline3'));
        });

        it('reads lines correctly', () => {
            const reader = new FileLineReader('fake.txt');
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
            mockedReadFileSync.mockReturnValue(encode('line1\r\nline2\r\nline3'));
        });

        it('reads lines correctly', () => {
            const reader = new FileLineReader('fake.txt');
            expect(reader.readLine()).toBe('line1');
            expect(reader.readLine()).toBe('line2');
            expect(reader.readLine()).toBe('line3');
            expect(reader.readLine()).toBeNull();
        });
    });

    describe('No line breaks', () => {
        beforeEach(() => {
            mockedReadFileSync.mockReturnValue(encode('singleline'));
        });

        it('returns the whole string then null', () => {
            const reader = new FileLineReader('fake.txt');
            expect(reader.readLine()).toBe('singleline');
            expect(reader.readLine()).toBeNull();
        });
    });

    describe('Empty file', () => {
        beforeEach(() => {
            mockedReadFileSync.mockReturnValue(encode(''));
        });

        it('immediately returns null', () => {
            const reader = new FileLineReader('fake.txt');
            expect(reader.readLine()).toBeNull();
            expect(reader.getCurrentLineNumber()).toBe(1);
            expect(reader.getCurrentPos()).toBe(-1);
            expect(reader.getDataLength()).toBe(0);
        });
    });

    describe('getDataLength()', () => {
        it('returns correct data length', () => {
            const input = 'line1\nline2';
            mockedReadFileSync.mockReturnValue(encode(input));
            const reader = new FileLineReader('fake.txt');
            expect(reader.getDataLength()).toBe(input.length);
        });
    });
});
