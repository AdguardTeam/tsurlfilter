import { type ByteRange } from './byte-range';

/**
 * Fetches a resource from the given URL and returns its content as text, optionally with a specified byte range.
 *
 * @param url The URL of the resource to fetch.
 * @param [range] Optional byte range to specify in the HTTP request.
 *
 * @returns A promise that resolves to the fetched content as a string.
 *
 * @throws If the request fails.
 */
export const fetchExtensionResourceText = async (url: string, range?: ByteRange): Promise<string> => {
    const headers = range ? { Range: `bytes=${range.start}-${range.end}` } : undefined;
    const response = await fetch(url, { headers });
    return response.text();
};
