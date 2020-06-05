import console from 'console';
import fs from 'fs';
import zlib from 'zlib';
import { DnsEngine } from '../../src/engine/dns-engine';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { Request, RequestType } from '../../src/request';

describe('General', () => {
    /**
     * Helper function creates rule storage
     *
     * @param listId
     * @param rules
     */
    const createTestRuleStorage = (listId: number, rules: string[]): RuleStorage => {
        const list = new StringRuleList(listId, rules.join('\n'), false);
        return new RuleStorage([list]);
    };

    it('works if empty engine is ok', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, []));
        const result = engine.match('example.org');

        expect(result).not.toBeNull();
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks engine match', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, [
            '||example.org^',
            '||example2.org/*',
            '@@||example3.org^',
            '0.0.0.0 v4.com',
            '127.0.0.1 v4.com',
            ':: v6.com',
            '127.0.0.1 v4and6.com',
            '127.0.0.2 v4and6.com',
            '::1 v4and6.com',
            '::2 v4and6.com',
        ]));

        let result;

        result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe('||example.org^');
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('example2.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe('||example2.org/*');
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('example3.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe('@@||example3.org^');
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('v4.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(2);
        expect(result.hostRules[0].getText()).toBe('0.0.0.0 v4.com');
        expect(result.hostRules[1].getText()).toBe('127.0.0.1 v4.com');

        result = engine.match('v6.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(1);
        expect(result.hostRules[0].getText()).toBe(':: v6.com');

        result = engine.match('v4and6.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(4);
        expect(result.hostRules[0].getText()).toBe('127.0.0.1 v4and6.com');
        expect(result.hostRules[1].getText()).toBe('127.0.0.2 v4and6.com');
        expect(result.hostRules[2].getText()).toBe('::1 v4and6.com');
        expect(result.hostRules[3].getText()).toBe('::2 v4and6.com');

        result = engine.match('example.net');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - protocol', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, [
            '://example.org',
        ]));

        const result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - regex', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, [
            '/^stats?\\./',
        ]));

        const result = engine.match('stats.test.com');
        expect(result.basicRule).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - regex whitelist', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, [
            '||stats.test.com^',
            '@@/stats?\\./',
        ]));

        const result = engine.match('stats.test.com');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.isWhitelist()).toBeTruthy();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for badfilter rules', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, [
            '||example.org^',
            '||example.org^$badfilter',
        ]));

        const result = engine.match('example.org');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });
});

describe('Benchmark DnsEngine', () => {
    /**
     * Resources file paths
     */
    const requestsZipFilePath = './test/resources/requests.json.gz';
    const requestsFilePath = './test/resources/requests.json';
    const expectedRequestsCount = 27969;
    const rulesFilePath = './test/resources/adguard_sdn_filter.txt';
    const hostsFilePath = './test/resources/hosts';

    /**
     * Expected matches for specified requests and rules
     */
    const expectedMatchesCount = 11043;

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

    function getRSS(): number {
        return process.memoryUsage().rss;
    }

    it('matches requests', async () => {
        const testRequests = await loadRequests();
        expect(testRequests.length).toBe(expectedRequestsCount);

        const requests: Request[] = [];
        testRequests.forEach((t) => {
            requests.push(new Request(t.url, t.frameUrl, testGetRequestType(t.cpt)));
        });

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
            const dnsResult = engine.match(req.hostname);
            const elapsedMatch = Date.now() - startMatch;
            totalElapsed += elapsedMatch;

            if (elapsedMatch > maxElapsedMatch) {
                maxElapsedMatch = elapsedMatch;
            }
            if (elapsedMatch < minElapsedMatch) {
                minElapsedMatch = elapsedMatch;
            }

            if (dnsResult.basicRule) {
                if (!dnsResult.basicRule.isWhitelist()) {
                    totalMatches += 1;
                }
            } else if (dnsResult.hostRules.length > 0) {
                totalMatches += 1;
            }
        }

        expect(totalMatches).toBe(expectedMatchesCount);

        console.log(`Total matches: ${totalMatches}`);
        console.log(`Total elapsed: ${totalElapsed}`);
        console.log(`Average per request: ${totalElapsed / requests.length}`);
        console.log(`Max per request: ${maxElapsedMatch}`);
        console.log(`Min per request: ${minElapsedMatch}`);

        const afterMatch = getRSS();
        console.log(`RSS after matching - ${afterMatch / 1024} kB (${(afterMatch - afterLoad) / 1024} kB diff)`);
    });
});
