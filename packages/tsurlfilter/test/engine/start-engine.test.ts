import fs from 'node:fs';
import zlib from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { CosmeticOption } from '../../src/engine/cosmetic-option';
import { DnsEngine } from '../../src/engine/dns-engine';
import { Engine, type EngineFactoryOptions } from '../../src/engine/engine';
import { type IRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';
import { type IndexedStorageCosmeticRuleParts } from '../../src/rules/rule';

/**
 * Resources file paths.
 */
const requestsZipFilePath = './test/resources/requests.json.gz';
const expectedRequestsCount = 27969;
const requestsFilePath = './test/resources/requests.json';

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
 * Loads and parses the requests from the requests file.
 *
 * @returns A promise that resolves to an array of request objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadRequests(): Promise<any[]> {
    await unzipRequests();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests: any[] = [];
    const data = await fs.promises.readFile(requestsFilePath, 'utf8');
    data.split('\n').forEach((line) => {
        if (line) {
            const request = JSON.parse(line);
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
 * Parses the requests from the loaded requests file.
 *
 * @returns A promise that resolves to an array of Request objects.
 */
async function parseRequests(): Promise<Request[]> {
    const testRequests = await loadRequests();
    expect(testRequests.length).toBe(expectedRequestsCount);

    const requests: Request[] = [];
    testRequests.forEach((t) => {
        requests.push(new Request(t.url, t.frameUrl, testGetRequestType(t.cpt)));
    });

    return requests;
}

/**
 * Creates a cosmetic engine from the given rule lists.
 *
 * @param lists Rule lists to build the cosmetic engine from.
 *
 * @returns A cosmetic engine built from the given rule lists.
 */
const createCosmeticEngine = (lists: IRuleList[]): CosmeticEngine => {
    const rulesParts: IndexedStorageCosmeticRuleParts[] = [];
    const storage = new RuleStorage(lists);

    const scanner = storage.createRuleStorageScanner(ScannerType.CosmeticRules);

    while (scanner.scan()) {
        // We can safely cast here, because we configured scanner to scan only cosmetic rules
        rulesParts.push(scanner.getRuleParts()! as IndexedStorageCosmeticRuleParts);
    }

    return CosmeticEngine.createSync(rulesParts, storage);
};

/**
 * Counts requests matched by the given matcher (no timing).
 *
 * @param requests Parsed requests.
 * @param matchFunc Predicate deciding a match.
 *
 * @returns Number of matches.
 */
function countMatches(requests: Request[], matchFunc: (r: Request) => boolean): number {
    let total = 0;
    for (const req of requests) {
        if (matchFunc(req)) {
            total += 1;
        }
    }
    return total;
}

describe('engine startup correctness', () => {
    const easyList = fs.readFileSync('./test/resources/easylist.txt', 'utf8');
    const adguardSdnFilter = fs.readFileSync('./test/resources/adguard_sdn_filter.txt', 'utf8');
    const hostsFile = fs.readFileSync('./test/resources/hosts', 'utf8');
    const adguardBaseFilter = fs.readFileSync('./test/resources/adguard_base_filter.txt', 'utf8');

    it.each([{ loadAsync: false }, { loadAsync: true }])(
        'network engine loads and matches ($loadAsync async)',
        async ({ loadAsync }) => {
            const requests = await parseRequests();
            const options: EngineFactoryOptions = { filters: [{ id: 1, content: easyList }] };
            const engine = loadAsync ? await Engine.createAsync(options) : Engine.createSync(options);

            expect(engine).toBeTruthy();
            expect(engine.getRulesCount()).toBe(38978);

            const totalMatches = countMatches(requests, (request) => {
                const r = engine.matchRequest(request);
                return !!(r && r.basicRule && !r.basicRule.isAllowlist());
            });
            expect(totalMatches).toBe(4667);
        },
    );

    it('dns engine loads and matches', async () => {
        const requests = await parseRequests();
        const ruleList = new StringRuleList(1, adguardSdnFilter, true, false, false);
        const hostsList = new StringRuleList(2, hostsFile, true, false, false);
        const engine = new DnsEngine(new RuleStorage([ruleList, hostsList]));

        expect(engine).toBeTruthy();
        const totalMatches = countMatches(requests, (request) => {
            const dnsResult = engine.match(request.hostname);
            if (dnsResult.basicRule) {
                return !dnsResult.basicRule.isAllowlist();
            }
            return dnsResult.hostRules.length > 0;
        });
        expect(totalMatches).toBe(8776);
    });

    it('cosmetic engine loads and matches', async () => {
        const requests = await parseRequests();
        const lists: IRuleList[] = [new StringRuleList(1, adguardBaseFilter, false, false, false)];
        const engine = createCosmeticEngine(lists);

        expect(engine).toBeTruthy();
        const totalMatches = countMatches(requests, (request) => {
            if (request.requestType !== RequestType.SubDocument) {
                return false;
            }
            const result = engine.match(request, CosmeticOption.CosmeticOptionAll);
            return result.elementHiding.specific.length + result.elementHiding.generic.length > 0;
        });
        expect(totalMatches).toBe(1754);
    });
});
