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

        // Mock the fetch function
        global.fetch = vi.fn(() => Promise.resolve({
            text: () => Promise.resolve(mockResponseText),
        } as Response)) as MockedFunction<typeof fetch>;

        const result = await fetchExtensionResourceText(url);

        expect(global.fetch).toHaveBeenCalledWith(url, { headers: undefined });
        expect(result).toBe(mockResponseText);
    });

    it('should fetch content with byte range', async () => {
        const url = 'https://example.com/resource.txt';
        const byteRange: ByteRange = { start: 10, end: 20 };
        const mockResponseText = 'Sample content with byte range';

        // Mock the fetch function
        global.fetch = vi.fn(() => Promise.resolve({
            text: () => Promise.resolve(mockResponseText),
        } as Response)) as MockedFunction<typeof fetch>;

        const expectedHeaders = {
            Range: `bytes=${byteRange.start}-${byteRange.end}`,
        };

        const result = await fetchExtensionResourceText(url, byteRange);

        expect(global.fetch).toHaveBeenCalledWith(url, { headers: expectedHeaders });
        expect(result).toBe(mockResponseText);
    });

    it('should handle fetch errors', async () => {
        const url = 'https://example.com/resource.txt';
        const mockError = new Error('Network error');

        // Mock the fetch function to throw an error
        global.fetch = vi.fn(() => Promise.reject(mockError)) as MockedFunction<typeof fetch>;

        await expect(fetchExtensionResourceText(url)).rejects.toThrow('Network error');
    });

    it('should handle non-OK HTTP responses', async () => {
        const url = 'https://example.com/resource.txt';

        // Mock the fetch function to return a non-OK response
        global.fetch = vi.fn(() => Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve(''),
        } as Response)) as MockedFunction<typeof fetch>;

        const result = await fetchExtensionResourceText(url);

        expect(global.fetch).toHaveBeenCalledWith(url, { headers: undefined });
        expect(result).toBe('');
    });

    it('should correctly pass headers when byte range is undefined', async () => {
        const url = 'https://example.com/resource.txt';
        const mockResponseText = 'Sample content';

        // Mock the fetch function
        global.fetch = vi.fn(() => Promise.resolve({
            text: () => Promise.resolve(mockResponseText),
        } as Response)) as MockedFunction<typeof fetch>;

        const result = await fetchExtensionResourceText(url, undefined);

        expect(global.fetch).toHaveBeenCalledWith(url, { headers: undefined });
        expect(result).toBe(mockResponseText);
    });
});
