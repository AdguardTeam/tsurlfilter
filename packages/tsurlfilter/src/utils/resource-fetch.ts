import type { ByteRange } from './byte-range';

/**
 * Minimum length of the byte range in bytes.
 *
 * We need this value to keep a minimal byte range when fetching a resource.
 * It is needed to temporarily fix https://issues.chromium.org/issues/405286894#comment12.
 */
const MIN_RANGE_LENGTH = 4096;

/**
 * Fetches a resource from the given URL and returns its content as text, optionally with a specified byte range.
 *
 * @param url The URL of the resource to fetch.
 * @param [range] Optional byte range to specify in the HTTP request.
 * @param [minRangeLength] Minimum length of the byte range in bytes.
 * We need this parameter to keep a minimal byte range when fetching a resource.
 * It is needed to temporarily fix https://issues.chromium.org/issues/405286894#comment12.
 *
 * @returns A promise that resolves to the fetched content as a string.
 *
 * @throws If the request fails.
 */
export const fetchExtensionResourceText = async (
    url: string,
    range?: ByteRange,
    minRangeLength: number = MIN_RANGE_LENGTH,
): Promise<string> => {
    if (!range) {
        const response = await fetch(url);
        const text = await response.text();
        return text;
    }

    const rangeLength = range.end - range.start + 1;
    const end = rangeLength < minRangeLength
        ? range.start + minRangeLength
        : range.end;

    const headers = {
        Range: `bytes=${range.start}-${end}`,
    };

    const response = await fetch(url, { headers });

    if (end !== range.end) {
        const buffer = await response.arrayBuffer();
        const slicedBuffer = buffer.slice(0, rangeLength);
        const slicedResponse = new Response(slicedBuffer, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText,
        });

        const text = await slicedResponse.text();

        return text;
    }

    const text = await response.text();
    return text;
};
