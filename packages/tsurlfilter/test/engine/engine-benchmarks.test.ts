/* eslint-disable max-len */
import fs from 'fs';
import zlib from 'zlib';
import console from 'console';
import { performance } from 'perf_hooks';
import { NetworkEngine } from '../../src/engine/network-engine';
import {
    CosmeticOption,
    Engine,
    Request,
    RequestType,
} from '../../src';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { DnsEngine } from '../../src/engine/dns-engine';
import { setLogger } from '../../src/utils/logger';
import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';

// Benchmarks (Average per request)
//     ✓ runs network-engine (40 μs)
//     ✓ runs engine - async load (50 μs)
//     ✓ runs dns-engine (12 μs)

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

async function parseRequests(): Promise<Request[]> {
    const testRequests = await loadRequests();
    expect(testRequests.length).toBe(expectedRequestsCount);

    const requests: Request[] = [];
    testRequests.forEach((t) => {
        requests.push(new Request(t.url, t.frameUrl, testGetRequestType(t.cpt)));
    });

    return requests;
}

function memoryUsage(base = { heapUsed: 0, heapTotal: 0 }) {
    let { heapUsed, heapTotal } = process.memoryUsage();

    heapUsed -= base.heapUsed;
    heapTotal -= base.heapTotal;

    return ({ heapUsed, heapTotal });
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

        const startMatch = performance.now();

        if (matchFunc(req)) {
            totalMatches += 1;
        }

        const elapsedMatch = performance.now() - startMatch;
        totalElapsed += elapsedMatch;

        if (elapsedMatch > maxElapsedMatch) {
            maxElapsedMatch = elapsedMatch;
        }
        if (elapsedMatch < minElapsedMatch) {
            minElapsedMatch = elapsedMatch;
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const round = (val: number) => Math.round(val * 1000 * 1000) / 1000;

    console.log(`Total matches: ${totalMatches}`);
    console.log(`Total elapsed: ${round(totalElapsed)} μs`);
    console.log(`Average per request: ${round(totalElapsed / requests.length)} μs`);
    console.log(`Max per request: ${round(maxElapsedMatch)} μs`);
    console.log(`Min per request: ${round(minElapsedMatch)} μs`);

    return totalMatches;
}

const enum RuleListFilePath {
    Easylist = './test/resources/easylist.txt',
    AdguardBaseFilter = './test/resources/adguard_base_filter.txt',
    AdguardDomainModifierRules = './test/resources/adguard_domain_modifier_rules.txt',
}

describe('Benchmarks', () => {
    beforeAll(() => {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        setLogger({
            error(message?: string): void {
            },
            info(message?: string): void {
            },
            debug(message?: string): void {
            },
            warn(message?: string): void {
            },
        });
        /* eslint-disable @typescript-eslint/no-unused-vars */
    });

    beforeEach(() => {
        console.log(`Benchmark: "${expect.getState().currentTestName}"`);
    });

    afterEach(() => {
        console.log('\n');
    });

    afterAll(() => {
        setLogger(console);
    });

    it('runs network-engine', async () => {
        /**
         * Expected matches for specified requests and rules
         */
        const expectedMatchesCount = 6868;

        const baseMemory = memoryUsage();
        const requests = await parseRequests();

        const initMemory = memoryUsage(baseMemory);
        console.log(`Memory after initialization - ${initMemory.heapTotal / 1024} kB (${initMemory.heapUsed / 1024} kB used)`);

        const startParse = Date.now();
        const ruleStorage = new RuleStorage([
            new StringRuleList(1, await fs.promises.readFile(RuleListFilePath.Easylist, 'utf8'), true),
            new StringRuleList(2, await fs.promises.readFile(RuleListFilePath.AdguardDomainModifierRules, 'utf8'), true),
        ]);

        const engine = new NetworkEngine(ruleStorage);
        expect(engine).toBeTruthy();

        console.log(`Loaded rules: ${engine.rulesCount}`);
        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);

        const loadingMemory = memoryUsage(baseMemory);
        console.log(`Memory after loading rules - ${loadingMemory.heapTotal / 1024} kB (${loadingMemory.heapUsed / 1024} kB used)`);

        const totalMatches = runEngine(requests, (request) => {
            const rule = engine.match(request);
            return !!(rule && !rule.isAllowlist());
        });

        expect(totalMatches).toBe(expectedMatchesCount);

        const afterMatch = memoryUsage(baseMemory);
        console.log(`Memory after matching: ${afterMatch.heapTotal / 1024} kB`);
        console.log(`Memory after matching, used: ${afterMatch.heapUsed / 1024} kB`);
    });

    it('runs engine - async load', async () => {
        /**
         * Expected matches for specified requests and rules
         */
        const expectedMatchesCount = 586;

        const baseMemory = memoryUsage();
        const requests = await parseRequests();

        const initMemory = memoryUsage(baseMemory);
        console.log(`Memory after initialization - ${initMemory.heapTotal / 1024} kB (${initMemory.heapUsed / 1024} kB used)`);

        const startParse = Date.now();
        const ruleStorage = new RuleStorage([
            new StringRuleList(1, await fs.promises.readFile(RuleListFilePath.Easylist, 'utf8'), true),
            new StringRuleList(2, await fs.promises.readFile(RuleListFilePath.AdguardDomainModifierRules, 'utf8'), true),
        ]);

        const engine = new Engine(ruleStorage, true);
        expect(engine).toBeTruthy();

        await engine.loadRulesAsync(1000);

        console.log(`Loaded rules: ${engine.getRulesCount()}`);
        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);

        const loadingMemory = memoryUsage(baseMemory);
        console.log(`Memory after loading rules - ${loadingMemory.heapTotal / 1024} kB (${loadingMemory.heapUsed / 1024} kB used)`);

        const totalMatches = runEngine(requests, (request) => {
            const matchingResult = engine.matchRequest(request);
            return !!(matchingResult
                && matchingResult.basicRule
                && matchingResult.basicRule!.isAllowlist());
        });

        expect(totalMatches).toBe(expectedMatchesCount);

        const afterMatch = memoryUsage(baseMemory);
        console.log(`Memory after matching - ${afterMatch.heapTotal / 1024} kB (${afterMatch.heapUsed / 1024} kB used)`);
    });

    it('runs dns-engine', async () => {
        const rulesFilePath = './test/resources/adguard_sdn_filter.txt';
        const hostsFilePath = './test/resources/hosts';

        /**
         * Expected matches for specified requests and rules
         */
        const expectedMatchesCount = 11043;

        const baseMemory = memoryUsage();
        const requests = await parseRequests();

        const initMemory = memoryUsage(baseMemory);
        console.log(`Memory after initialization - ${initMemory.heapTotal / 1024} kB (${initMemory.heapUsed / 1024} kB used)`);

        const startParse = Date.now();
        const ruleList = new StringRuleList(1, await fs.promises.readFile(rulesFilePath, 'utf8'), true);
        const hostsList = new StringRuleList(2, await fs.promises.readFile(hostsFilePath, 'utf8'), true);
        const ruleStorage = new RuleStorage([ruleList, hostsList]);

        const engine = new DnsEngine(ruleStorage);
        expect(engine).toBeTruthy();

        console.log(`Loaded rules: ${engine.rulesCount}`);
        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);

        const loadingMemory = memoryUsage(baseMemory);
        console.log(`Memory after loading rules - ${loadingMemory.heapTotal / 1024} kB (${loadingMemory.heapUsed / 1024} kB used)`);

        const totalMatches = runEngine(requests, (request) => {
            const dnsResult = engine.match(request.hostname);
            if (dnsResult.basicRule) {
                if (!dnsResult.basicRule.isAllowlist()) {
                    return true;
                }
            } else if (dnsResult.hostRules.length > 0) {
                return true;
            }

            return false;
        });

        expect(totalMatches).toBe(expectedMatchesCount);

        const afterMatch = memoryUsage(baseMemory);
        console.log(`Memory after matching - ${afterMatch.heapTotal / 1024} kB (${afterMatch.heapUsed / 1024} kB used)`);
    });

    it('runs cosmetic-engine', async () => {
        /**
         * Expected matches for specified requests and rules
         */
        const expectedMatchesCount = 1754;

        const baseMemory = memoryUsage();
        const requests = await parseRequests();

        const initMemory = memoryUsage(baseMemory);
        console.log(`Memory after initialization - ${initMemory.heapTotal / 1024} kB (${initMemory.heapUsed / 1024} kB used)`);

        const startParse = Date.now();
        const ruleStorage = new RuleStorage([
            new StringRuleList(1, await fs.promises.readFile(RuleListFilePath.Easylist, 'utf8'), false),
            new StringRuleList(2, await fs.promises.readFile(RuleListFilePath.AdguardDomainModifierRules, 'utf8'), false),
        ]);

        const engine = new CosmeticEngine(ruleStorage);
        expect(engine).toBeTruthy();

        console.log(`Loaded rules: ${engine.rulesCount}`);
        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);

        const loadingMemory = memoryUsage(baseMemory);
        console.log(`Memory after loading rules - ${loadingMemory.heapTotal / 1024} kB (${loadingMemory.heapUsed / 1024} kB used)`);

        const totalMatches = runEngine(requests, (request) => {
            if (request.requestType !== RequestType.SubDocument) {
                return false;
            }

            const result = engine.match(request, CosmeticOption.CosmeticOptionAll);
            return result.elementHiding.specific.length + result.elementHiding.generic.length > 0;
        });

        expect(totalMatches).toBe(expectedMatchesCount);

        const afterMatch = memoryUsage(baseMemory);
        console.log(`Memory after matching - ${afterMatch.heapTotal / 1024} kB (${afterMatch.heapUsed / 1024} kB used)`);
    });
});
