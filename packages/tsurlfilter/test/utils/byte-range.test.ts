import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    type MockInstance,
} from 'vitest';
import { jsonpos, type Location } from 'jsonpos';
import { getUtf8EncodedLength } from '../../src/utils/string-utils';
import { getByteRangeFor } from '../../src/utils/byte-range';

vi.mock('jsonpos', () => ({
    ...vi.importActual('jsonpos'),
    jsonpos: vi.fn(),
}));

vi.mock('../../src/utils/string-utils', () => ({
    ...vi.importActual('../../src/utils/string-utils'),
    getUtf8EncodedLength: vi.fn(),
}));

describe('getByteRangeFor', () => {
    let mockedJsonpos: MockInstance<typeof jsonpos>;
    let mockedGetUtf8EncodedLength: MockInstance<typeof getUtf8EncodedLength>;

    beforeEach(() => {
        mockedJsonpos = vi.mocked(jsonpos);
        mockedGetUtf8EncodedLength = vi.mocked(getUtf8EncodedLength);
    });

    afterEach(() => {
        mockedJsonpos.mockClear();
        mockedGetUtf8EncodedLength.mockClear();
    });

    it('should return correct byte range for a valid pointer path in ASCII JSON', () => {
        const rawJson = '{"name": "John", "age": 30}';
        const pointerPath = '/name';
        const loc = {
            start: { offset: 9 },
            end: { offset: 15 },
        };

        mockedJsonpos.mockReturnValue(loc as Location);
        mockedGetUtf8EncodedLength.mockImplementation((str) => Buffer.byteLength(str, 'utf8'));

        const result = getByteRangeFor(rawJson, pointerPath);

        expect(result).toEqual({ start: 9, end: 14 });
        expect(mockedJsonpos).toHaveBeenCalledWith(rawJson, { pointerPath });
    });

    it('should return correct byte range for a pointer path with multi-byte UTF-8 characters', () => {
        const rawJson = '{"greeting": "こんにちは"}'; // "こんにちは" means "Hello" in Japanese
        const pointerPath = '/greeting';
        const loc = {
            start: { offset: 13 },
            end: { offset: 22 },
        };

        mockedJsonpos.mockReturnValue(loc as Location);

        // Mocking UTF-8 byte lengths for substrings
        mockedGetUtf8EncodedLength.mockImplementation((str) => Buffer.byteLength(str, 'utf8'));

        const result = getByteRangeFor(rawJson, pointerPath);

        // Calculate expected byte offsets
        const startByteOffset = Buffer.byteLength(rawJson.slice(0, loc.start.offset), 'utf8');
        const dataEncodedLength = Buffer.byteLength(rawJson.slice(loc.start.offset, loc.end.offset), 'utf8');
        const endByteOffset = startByteOffset + dataEncodedLength - 1;

        expect(result).toEqual({ start: startByteOffset, end: endByteOffset });
        expect(mockedJsonpos).toHaveBeenCalledWith(rawJson, { pointerPath });
    });

    it('should throw an error if the pointer path is not found', () => {
        const rawJson = '{"name": "John", "age": 30}';
        const pointerPath = '/nonexistent';

        mockedJsonpos.mockReturnValue({} as Location);

        expect(() => getByteRangeFor(rawJson, pointerPath)).toThrowError(
            `Cannot find pointer name ${pointerPath}`,
        );
    });

    it('should handle JSON with escaped characters correctly', () => {
        const rawJson = '{"text": "Line1\\nLine2"}';
        const pointerPath = '/text';
        const loc = {
            start: { offset: 9 },
            end: { offset: 22 },
        };

        mockedJsonpos.mockReturnValue(loc as Location);
        mockedGetUtf8EncodedLength.mockImplementation((str) => Buffer.byteLength(str, 'utf8'));

        const result = getByteRangeFor(rawJson, pointerPath);

        const startByteOffset = Buffer.byteLength(rawJson.slice(0, loc.start.offset), 'utf8');
        const dataEncodedLength = Buffer.byteLength(rawJson.slice(loc.start.offset, loc.end.offset), 'utf8');
        const endByteOffset = startByteOffset + dataEncodedLength - 1;

        expect(result).toEqual({ start: startByteOffset, end: endByteOffset });
    });

    it('should handle JSON with surrogate pairs (emojis)', () => {
        const rawJson = '{"emoji": "😊"}';
        const pointerPath = '/emoji';
        const loc = {
            start: { offset: 10 },
            end: { offset: 14 },
        };

        mockedJsonpos.mockReturnValue(loc as Location);
        mockedGetUtf8EncodedLength.mockImplementation((str) => Buffer.byteLength(str, 'utf8'));

        const result = getByteRangeFor(rawJson, pointerPath);

        const startByteOffset = Buffer.byteLength(rawJson.slice(0, loc.start.offset), 'utf8');
        const dataEncodedLength = Buffer.byteLength(rawJson.slice(loc.start.offset, loc.end.offset), 'utf8');
        const endByteOffset = startByteOffset + dataEncodedLength - 1;

        expect(result).toEqual({ start: startByteOffset, end: endByteOffset });
    });

    it('should handle nested JSON objects', () => {
        const rawJson = '{"user": {"name": "Alice", "age": 25}}';
        const pointerPath = '/user/name';
        const loc = {
            start: { offset: 15 },
            end: { offset: 22 },
        };

        mockedJsonpos.mockReturnValue(loc as Location);
        mockedGetUtf8EncodedLength.mockImplementation((str) => Buffer.byteLength(str, 'utf8'));

        const result = getByteRangeFor(rawJson, pointerPath);

        const startByteOffset = Buffer.byteLength(rawJson.slice(0, loc.start.offset), 'utf8');
        const dataEncodedLength = Buffer.byteLength(rawJson.slice(loc.start.offset, loc.end.offset), 'utf8');
        const endByteOffset = startByteOffset + dataEncodedLength - 1;

        expect(result).toEqual({ start: startByteOffset, end: endByteOffset });
    });

    it('should handle arrays in JSON', () => {
        const rawJson = '{"numbers": [10, 20, 30]}';
        const pointerPath = '/numbers/1';
        const loc = {
            start: { offset: 14 },
            end: { offset: 16 },
        };

        mockedJsonpos.mockReturnValue(loc as Location);
        mockedGetUtf8EncodedLength.mockImplementation((str) => Buffer.byteLength(str, 'utf8'));

        const result = getByteRangeFor(rawJson, pointerPath);

        const startByteOffset = Buffer.byteLength(rawJson.slice(0, loc.start.offset), 'utf8');
        const dataEncodedLength = Buffer.byteLength(rawJson.slice(loc.start.offset, loc.end.offset), 'utf8');
        const endByteOffset = startByteOffset + dataEncodedLength - 1;

        expect(result).toEqual({ start: startByteOffset, end: endByteOffset });
    });

    it('should handle large JSON strings efficiently', () => {
        const largeData = 'A'.repeat(10000);
        const rawJson = `{"data": "${largeData}"}`;
        const pointerPath = '/data';
        const loc = {
            start: { offset: 9 },
            end: { offset: 9 + largeData.length },
        };

        mockedJsonpos.mockReturnValue(loc as Location);
        mockedGetUtf8EncodedLength.mockImplementation((str) => Buffer.byteLength(str, 'utf8'));

        const result = getByteRangeFor(rawJson, pointerPath);

        const startByteOffset = Buffer.byteLength(rawJson.slice(0, loc.start.offset), 'utf8');
        const dataEncodedLength = Buffer.byteLength(rawJson.slice(loc.start.offset, loc.end.offset), 'utf8');
        const endByteOffset = startByteOffset + dataEncodedLength - 1;

        expect(result).toEqual({ start: startByteOffset, end: endByteOffset });
    });
});
