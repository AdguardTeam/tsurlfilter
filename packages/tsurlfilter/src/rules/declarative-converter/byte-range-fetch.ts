import { type ByteRange } from './byte-range-map';

export const fetchRangeAndDecode = async (url: string, range: ByteRange): Promise<string> => {
    const response = await fetch(url, {
        headers: {
            Range: `bytes=${range.start}-${range.end}`,
        },
    });

    return response.text();
};
