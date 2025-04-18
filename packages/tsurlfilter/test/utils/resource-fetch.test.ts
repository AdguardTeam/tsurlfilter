import {
    describe,
    it,
    expect,
    beforeEach,
    afterAll,
    vi,
    type MockedFunction,
} from 'vitest';

import { fetchExtensionResourceText } from '../../src';
import { type ByteRange } from '../../src/utils/byte-range';

describe('fetchExtensionResourceText', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('should fetch content without byte range', async () => {
        const url = 'https://example.com/resource.txt';
        const mockResponseText = 'Sample content without byte range';

        global.fetch = vi.fn(() => Promise.resolve({
            text: () => Promise.resolve(mockResponseText),
            arrayBuffer: () => Promise.resolve(new TextEncoder().encode(mockResponseText).buffer),
        } as Response)) as MockedFunction<typeof fetch>;

        const result = await fetchExtensionResourceText(url);

        expect(global.fetch).toHaveBeenCalledWith(url);
        expect(result).toBe(mockResponseText);
    });

    it('should fetch content with byte range', async () => {
        const url = 'https://example.com/resource.txt';
        const byteRange: ByteRange = { start: 10, end: 20 };
        const mockResponseText = 'Sample content with byte range';

        global.fetch = vi.fn(() => Promise.resolve({
            text: () => Promise.resolve(mockResponseText),
            arrayBuffer: () => Promise.resolve(new TextEncoder().encode(mockResponseText).buffer.slice(10)),
        } as Response)) as MockedFunction<typeof fetch>;

        const expectedHeaders = {
            Range: `bytes=${byteRange.start}-${byteRange.start + 4096}`,
        };

        const result = await fetchExtensionResourceText(url, byteRange);

        expect(global.fetch).toHaveBeenCalledWith(url, { headers: expectedHeaders });
        expect(result).toBe(
            // @ts-expect-error
            new TextDecoder().decode(new TextEncoder().encode(mockResponseText).buffer.slice(10, 21)),
        );
    });

    it('should fetch with extended range if actual range is below minRangeLength', async () => {
        const url = 'https://example.com/resource.txt';
        const byteRange: ByteRange = { start: 0, end: 100 };
        const minRangeLength = 4096;
        const mockResponseText = 'x'.repeat(minRangeLength); // Simulate large response

        global.fetch = vi.fn(() => Promise.resolve({
            text: () => Promise.resolve(mockResponseText),
            arrayBuffer: () => Promise.resolve(new TextEncoder().encode(mockResponseText).buffer),
        } as Response)) as MockedFunction<typeof fetch>;

        const expectedHeaders = {
            Range: `bytes=0-${minRangeLength}`,
        };

        const result = await fetchExtensionResourceText(url, byteRange, minRangeLength);

        expect(global.fetch).toHaveBeenCalledWith(url, { headers: expectedHeaders });
        expect(result).toBe(mockResponseText.slice(0, 101)); // slice to original range end
    });

    it('should not extend range if original range exceeds minRangeLength', async () => {
        const url = 'https://example.com/resource.txt';
        const byteRange: ByteRange = { start: 0, end: 5000 }; // > 4096
        const mockResponseText = 'Extended content';

        global.fetch = vi.fn(() => Promise.resolve({
            text: () => Promise.resolve(mockResponseText),
            arrayBuffer: () => Promise.resolve(new TextEncoder().encode(mockResponseText).buffer),
        } as Response)) as MockedFunction<typeof fetch>;

        const expectedHeaders = {
            Range: 'bytes=0-5000',
        };

        const result = await fetchExtensionResourceText(url, byteRange);

        expect(global.fetch).toHaveBeenCalledWith(url, { headers: expectedHeaders });
        expect(result).toBe(mockResponseText);
    });

    it('should handle fetch errors', async () => {
        const url = 'https://example.com/resource.txt';
        const mockError = new Error('Network error');

        global.fetch = vi.fn(() => Promise.reject(mockError)) as MockedFunction<typeof fetch>;

        await expect(fetchExtensionResourceText(url)).rejects.toThrow('Network error');
    });

    it('should handle non-OK HTTP responses', async () => {
        const url = 'https://example.com/resource.txt';

        global.fetch = vi.fn(() => Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve(''),
        } as Response)) as MockedFunction<typeof fetch>;

        const result = await fetchExtensionResourceText(url);

        expect(global.fetch).toHaveBeenCalledWith(url);
        expect(result).toBe('');
    });

    it('should correctly pass headers when byte range is undefined', async () => {
        const url = 'https://example.com/resource.txt';
        const mockResponseText = 'Sample content';

        global.fetch = vi.fn(() => Promise.resolve({
            text: () => Promise.resolve(mockResponseText),
            arrayBuffer: () => Promise.resolve(new TextEncoder().encode(mockResponseText).buffer),
        } as Response)) as MockedFunction<typeof fetch>;

        const result = await fetchExtensionResourceText(url, undefined);

        expect(global.fetch).toHaveBeenCalledWith(url);
        expect(result).toBe(mockResponseText);
    });
});
