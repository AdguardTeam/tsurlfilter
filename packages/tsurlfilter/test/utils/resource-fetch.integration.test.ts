import { createServer, type Server } from 'http';
import { Buffer } from 'buffer';
import { getByteRangeFor } from '../../src/utils/byte-range';
import { fetchExtensionResourceText } from '../../src/utils/resource-fetch';

const sampleJson = `
{
  "name": "AdGuard",
  "age": 15,
  "languages": ["English", "TypeScript"],
  "nested": {
    "key": "value",
    "number": 42
  }
}
`;

describe('fetchExtensionResourceText', () => {
    let server: Server;
    let serverUrl: string;

    beforeAll((done) => {
        // Convert sampleJson to a Buffer
        const sampleJsonBuffer = Buffer.from(sampleJson, 'utf8');

        server = createServer((req, res) => {
            const rangeHeader = req.headers.range;
            const totalLength = sampleJsonBuffer.length;

            if (!rangeHeader) {
                res.setHeader('Content-Length', totalLength);
                res.end(sampleJsonBuffer);
                return;
            }

            const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
            if (!matches) {
                // Range Not Satisfiable
                res.statusCode = 416;
                res.end();
                return;
            }

            const start = parseInt(matches[1], 10);
            const end = matches[2] ? parseInt(matches[2], 10) : totalLength - 1;

            // Validate the range
            if (start >= totalLength || end >= totalLength || start > end) {
                // Range Not Satisfiable
                res.statusCode = 416;
                res.end();
                return;
            }

            // Partial Content
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${totalLength}`);
            res.setHeader('Content-Length', end - start + 1);
            res.end(sampleJsonBuffer.subarray(start, end + 1));
        });

        server.listen(0, () => {
            const address = server.address();
            if (typeof address === 'object' && address !== null) {
                const { port } = address;
                serverUrl = `http://localhost:${port}`;
                done();
            } else {
                throw new Error('Failed to start server');
            }
        });
    });

    afterAll((done) => {
        server.close(done);
    });

    it('should fetch text by specifying ranges', async () => {
        // Use getByteRangeFor to get the byte range of "/nested/key"
        const pointerPath = '/nested/key';
        const byteRange = getByteRangeFor(sampleJson, pointerPath);

        // Use fetchExtensionResourceText to fetch the value at that byte range
        const fetchedText = await fetchExtensionResourceText(serverUrl, byteRange);

        // The expected value is "value", including the quotes as in the JSON string
        expect(fetchedText).toBe('"value"');
    });
});
