import fs from 'fs';
import zlib from 'zlib';
import console from 'console';
import { NetworkEngine } from '../../src/engine/network-engine';
import { Engine, Request, RequestType } from '../../src';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { DnsEngine } from '../../src/engine/dns-engine';
import { setLogger } from '../../src/utils/logger';

// Benchmarks
//     ✓ runs network-engine (1567ms)
//     ✓ runs engine - async load (1875ms)
//     ✓ runs dns-engine (956ms)

/**
 * Resources file paths
 */
const requestsZipFilePath = './test/resources/requests.json.gz';
const expectedRequestsCount = 27969;
const requestsFilePath = './test/resources/requests.json';

function isSupportedURL(url: string): boolean {
    return (!!url && (url.startsWith('http') || url.startsWith('ws')));
}

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

    console.log(`Loaded requests: ${requests.length}`);

    return requests;
}

function testGetRequestType(requestType: string): RequestType {
    switch (requestType) {
        case 'document':
            // Consider document requests as sub_document. This is because the request
            // dataset does not contain sub_frame or main_frame but only 'document'.
            return RequestType.Subdocument;
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
            return RequestType.Websocket;
        default:
            return RequestType.Other;
    }
}

async function parseRequests(): Promise<Request[]> {
    const testRequests = await loadRequests();
    expect(testRequests.length).toBe(expectedRequestsCount);

    const requests: Request[] = [];
    testRequests.forEach((t) => {
        requests.push(new Request(t.url, t.frameUrl, testGetRequestType(t.cpt)));
    });

    return requests;
}

function getRSS(): number {
    return process.memoryUsage().rss;
}

function runEngine(requests: Request[], matchFunc: (r: Request) => boolean): number {
    let totalMatches = 0;
    let totalElapsed = 0;
    let minElapsedMatch = 100 * 1000; // 100 seconds
    let maxElapsedMatch = 0;

    for (let i = 0; i < requests.length; i += 1) {
        if (i !== 0 && i % 10000 === 0) {
            console.log(`Processed ${i} requests`);
        }

        const req = requests[i];

        const startMatch = Date.now();

        if (matchFunc(req)) {
            totalMatches += 1;
        }

        const elapsedMatch = Date.now() - startMatch;
        totalElapsed += elapsedMatch;

        if (elapsedMatch > maxElapsedMatch) {
            maxElapsedMatch = elapsedMatch;
        }
        if (elapsedMatch < minElapsedMatch) {
            minElapsedMatch = elapsedMatch;
        }
    }

    console.log(`Total matches: ${totalMatches}`);
    console.log(`Total elapsed: ${totalElapsed}`);
    console.log(`Average per request: ${totalElapsed / requests.length}`);
    console.log(`Max per request: ${maxElapsedMatch}`);
    console.log(`Min per request: ${minElapsedMatch}`);

    return totalMatches;
}

describe('Benchmarks', () => {
    beforeAll(() => {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        setLogger({
            error(message?: string): void {
            },
            info(message?: string): void {
            },
            log(message?: string): void {
            },
            warn(message?: string): void {
            },
        });
        /* eslint-disable @typescript-eslint/no-unused-vars */
    });

    afterAll(() => {
        setLogger(console);
    });

    it('runs network-engine', async () => {
        const rulesFilePath = './test/resources/easylist.txt';

        /**
         * Expected matches for specified requests and rules
         */
        const expectedMatchesCount = 4667;

        const requests = await parseRequests();

        const start = getRSS();
        console.log(`RSS before loading rules - ${start / 1024} kB`);

        const startParse = Date.now();
        const list = new StringRuleList(1, await fs.promises.readFile(rulesFilePath, 'utf8'), true);
        const ruleStorage = new RuleStorage([list]);

        const engine = new NetworkEngine(ruleStorage);
        expect(engine).toBeTruthy();

        console.log(`Loaded rules: ${engine.rulesCount}`);
        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);

        const afterLoad = getRSS();
        console.log(`RSS after loading rules - ${afterLoad / 1024} kB (${(afterLoad - start) / 1024} kB diff)`);

        const totalMatches = runEngine(requests, (request) => {
            const rule = engine.match(request);
            return !!(rule && !rule.isWhitelist());
        });

        expect(totalMatches).toBe(expectedMatchesCount);

        const afterMatch = getRSS();
        console.log(`RSS after matching - ${afterMatch / 1024} kB (${(afterMatch - afterLoad) / 1024} kB diff)`);
    });

    it('runs engine - async load', async () => {
        const rulesFilePath = './test/resources/easylist.txt';

        /**
         * Expected matches for specified requests and rules
         */
        const expectedMatchesCount = 586;

        const requests = await parseRequests();

        const start = getRSS();
        console.log(`RSS before loading rules - ${start / 1024} kB`);

        const startParse = Date.now();
        const list = new StringRuleList(1, await fs.promises.readFile(rulesFilePath, 'utf8'), true);
        const ruleStorage = new RuleStorage([list]);

        const engine = new Engine(ruleStorage, true);
        expect(engine).toBeTruthy();

        await engine.loadRulesAsync(1000);

        console.log(`Loaded rules: ${engine.getRulesCount()}`);
        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);

        const afterLoad = getRSS();
        console.log(`RSS after loading rules - ${afterLoad / 1024} kB (${(afterLoad - start) / 1024} kB diff)`);

        const totalMatches = runEngine(requests, (request) => {
            const matchingResult = engine.matchRequest(request);
            return !!(matchingResult
                && matchingResult.basicRule
                && matchingResult.basicRule!.isWhitelist());
        });

        expect(totalMatches).toBe(expectedMatchesCount);

        const afterMatch = getRSS();
        console.log(`RSS after matching - ${afterMatch / 1024} kB (${(afterMatch - afterLoad) / 1024} kB diff)`);
    });

    it('runs dns-engine', async () => {
        const rulesFilePath = './test/resources/adguard_sdn_filter.txt';
        const hostsFilePath = './test/resources/hosts';

        /**
         * Expected matches for specified requests and rules
         */
        const expectedMatchesCount = 11043;

        const requests = await parseRequests();

        const start = getRSS();
        console.log(`RSS before loading rules - ${start / 1024} kB`);

        const startParse = Date.now();
        const ruleList = new StringRuleList(1, await fs.promises.readFile(rulesFilePath, 'utf8'), true);
        const hostsList = new StringRuleList(2, await fs.promises.readFile(hostsFilePath, 'utf8'), true);
        const ruleStorage = new RuleStorage([ruleList, hostsList]);

        const engine = new DnsEngine(ruleStorage);
        expect(engine).toBeTruthy();

        console.log(`Loaded rules: ${engine.rulesCount}`);
        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);

        const afterLoad = getRSS();
        console.log(`RSS after loading rules - ${afterLoad / 1024} kB (${(afterLoad - start) / 1024} kB diff)`);

        const totalMatches = runEngine(requests, (request) => {
            const dnsResult = engine.match(request.hostname);
            if (dnsResult.basicRule) {
                if (!dnsResult.basicRule.isWhitelist()) {
                    return true;
                }
            } else if (dnsResult.hostRules.length > 0) {
                return true;
            }

            return false;
        });

        expect(totalMatches).toBe(expectedMatchesCount);

        const afterMatch = getRSS();
        console.log(`RSS after matching - ${afterMatch / 1024} kB (${(afterMatch - afterLoad) / 1024} kB diff)`);
    });
});
