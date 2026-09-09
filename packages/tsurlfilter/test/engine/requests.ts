import fs from 'node:fs';
import zlib from 'node:zlib';

import { expect } from 'vitest';

import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';

/**
 * Resources file paths.
 */
const requestsZipFilePath = './test/resources/requests.json.gz';
const requestsFilePath = './test/resources/requests.json';

/**
 * Expected number of requests in the committed corpus.
 */
export const expectedRequestsCount = 27969;

/**
 * A single raw request record from the committed requests corpus.
 */
interface RawRequest {
    url: string;
    frameUrl: string;
    cpt: string;
}

/**
 * Checks if the given URL is supported.
 *
 * @param url The URL to check.
 *
 * @returns True if the URL is supported, false otherwise.
 */
function isSupportedURL(url: string): boolean {
    return (!!url && (url.startsWith('http') || url.startsWith('ws')));
}

/**
 * Unzips the requests file.
 *
 * @returns A promise that resolves when the file is unzipped.
 */
async function unzipRequests(): Promise<void> {
    return new Promise((resolve, reject) => {
        const fileContents = fs.createReadStream(requestsZipFilePath);
        const writeStream = fs.createWriteStream(requestsFilePath);
        const unzip = zlib.createGunzip();

        fileContents.pipe(unzip).pipe(writeStream).on('close', () => {
            resolve();
        }).on('error', () => {
            reject();
        });
    });
}

/**
 * Loads and parses the raw requests from the requests file.
 *
 * @returns A promise that resolves to an array of raw request objects.
 */
async function loadRequests(): Promise<RawRequest[]> {
    await unzipRequests();

    const requests: RawRequest[] = [];
    const data = await fs.promises.readFile(requestsFilePath, 'utf8');
    data.split('\n').forEach((line) => {
        if (line) {
            const request = JSON.parse(line) as RawRequest;
            if (isSupportedURL(request.url) && isSupportedURL(request.frameUrl)) {
                requests.push(request);
            }
        }
    });

    return requests;
}

/**
 * Determines the request type based on the provided string.
 *
 * @param requestType The type of the request as a string.
 *
 * @returns The corresponding RequestType enum value.
 */
function testGetRequestType(requestType: string): RequestType {
    switch (requestType) {
        case 'document':
            // Consider document requests as sub_document. This is because the request
            // dataset does not contain sub_frame or main_frame but only 'document'.
            return RequestType.SubDocument;
        case 'stylesheet':
            return RequestType.Stylesheet;
        case 'font':
            return RequestType.Font;
        case 'image':
            return RequestType.Image;
        case 'media':
            return RequestType.Media;
        case 'script':
            return RequestType.Script;
        case 'xhr':
        case 'fetch':
            return RequestType.XmlHttpRequest;
        case 'websocket':
            return RequestType.WebSocket;
        default:
            return RequestType.Other;
    }
}

/**
 * Loads the committed request corpus and parses it into Request objects.
 *
 * @returns A promise that resolves to an array of parsed Request objects.
 */
export async function parseRequests(): Promise<Request[]> {
    const testRequests = await loadRequests();
    expect(testRequests.length).toBe(expectedRequestsCount);

    const requests: Request[] = [];
    testRequests.forEach((t) => {
        requests.push(new Request(t.url, t.frameUrl, testGetRequestType(t.cpt)));
    });

    return requests;
}
