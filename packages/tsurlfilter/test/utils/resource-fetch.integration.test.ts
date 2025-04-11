/* eslint-disable import/no-extraneous-dependencies */
// @vitest-environment jsdom
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
} from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import { Buffer } from 'buffer';
import { getByteRangeFor } from '../../src/utils/byte-range';
import { fetchExtensionResourceText } from '../../src/utils/resource-fetch';

const sampleJson = `{
  "name": "AdGuard",
  "age": 15,
  "languages": ["English", "TypeScript"],
  "nested": {
    "key": "value",
    "number": 42
  }
}`;

// Convert JSON to a Buffer
const sampleJsonBuffer = Buffer.from(sampleJson, 'utf8');

// Setup MSW server
const server = setupServer(
    http.get('http://localhost/resource', ({ request }) => {
        const rangeHeader = request.headers.get('Range');
        const totalLength = sampleJsonBuffer.length;

        // No "Range" header => send the entire JSON
        if (!rangeHeader) {
            return HttpResponse.text(sampleJsonBuffer.toString('utf8'));
        }

        // If "Range" header exists => parse it
        const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
        if (!matches) {
            return HttpResponse.text('Invalid range', { status: 416 });
        }

        const start = parseInt(matches[1], 10);
        const end = matches[2] ? parseInt(matches[2], 10) : totalLength - 1;

        // Validate the range
        if (start >= totalLength || start > end) {
            return HttpResponse.text('Invalid range', { status: 416 });
        }

        return HttpResponse.text(
            sampleJsonBuffer.subarray(start, end + 1).toString('utf8'),
            {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${totalLength}`,
                    'Content-Length': (end - start + 1).toString(),
                },
            },
        );
    }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('fetchExtensionResourceText', () => {
    it('should fetch text by specifying ranges', async () => {
        // Get the byte range for "/nested/key"
        const pointerPath = '/nested/key';
        const byteRange = getByteRangeFor(sampleJson, pointerPath);

        // Make the request to "http://localhost/resource"
        const fetchedText = await fetchExtensionResourceText('http://localhost/resource', byteRange);

        // The value in the JSON is "value", including the quotes
        expect(fetchedText).toBe('"value"');
    });
});
