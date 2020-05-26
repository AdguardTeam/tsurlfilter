import fs from 'fs';
import zlib from 'zlib';
import console from 'console';
import { NetworkEngine } from '../../src/engine/network-engine';
import { Request, RequestType } from '../../src';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';

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

describe('TestEmptyNetworkEngine', () => {
    it('works if empty engine is ok', () => {
        const engine = new NetworkEngine(createTestRuleStorage(1, []));
        const request = new Request('http://example.org/', '', RequestType.Other);
        const result = engine.match(request);

        expect(result).toBeNull();
    });
});

describe('TestMatchWhitelistRule', () => {
    it('works if it finds simple whitelist rule', () => {
        const rule = '||example.org^$script';
        const exceptionRule = '@@http://example.org^';

        const engine = new NetworkEngine(createTestRuleStorage(1, [rule, exceptionRule]));
        const request = new Request('http://example.org/', '', RequestType.Script);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(exceptionRule);
    });
});

describe('TestMatchImportantRule', () => {
    const r1 = '||test2.example.org^$important';
    const r2 = '@@||example.org^';
    const r3 = '||test1.example.org^';

    const engine = new NetworkEngine(createTestRuleStorage(1, [r1, r2, r3]));
    let request;
    let result;

    it('should find domain whitelist rule ', () => {
        request = new Request('http://example.org/', '', RequestType.Other);
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(r2);
    });

    it('should find domain whitelist rule', () => {
        request = new Request('http://test1.example.org/', '', RequestType.Other);
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(r2);
    });

    it('should find suitable sub-domain whitelist rule', () => {
        request = new Request('http://test2.example.org/', '', RequestType.Other);
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(r1);
    });
});

describe('TestMatchSourceRule', () => {
    it('works if it finds rule for source url', () => {
        // eslint-disable-next-line max-len
        const rule = '|https://$image,media,script,third-party,domain=~feedback.pornhub.com|pornhub.com|redtube.com|redtube.com.br|tube8.com|tube8.es|tube8.fr|youporn.com|youporngay.com';
        const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

        const url = 'https://ci.phncdn.com/videos/201809/25/184777011/original/(m=ecuKGgaaaa)(mh=VSmV9L_iouBcWJJ)4.jpg';
        const sourceURL = 'https://www.pornhub.com/view_video.php?viewkey=ph5be89d11de4b0';

        const request = new Request(url, sourceURL, RequestType.Image);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(rule);
    });
});

describe('Test $domain modifier semantics', () => {
    const rule = '||check.com/url$domain=example.org|check.com';
    const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

    it('will match document url host', () => {
        const request = new Request('http://check.com/url', 'http://www.example.org/', RequestType.Document);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result!.getText()).toEqual(rule);
    });

    it('checks request url does not match', () => {
        const request = new Request('http://another.org/url', 'http://www.example.org/', RequestType.Document);
        const result = engine.match(request);

        expect(result).toBeFalsy();
    });

    it('will match request url host', () => {
        const request = new Request('http://check.com/url', 'http://test.com/', RequestType.Document);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result!.getText()).toEqual(rule);
    });

    it('will match request url host - subdocument', () => {
        const request = new Request('http://check.com/url', 'http://test.com/', RequestType.Subdocument);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result!.getText()).toEqual(rule);
    });

    it('checks request type Document is required', () => {
        const request = new Request('http://check.com/url', 'http://test.com/', RequestType.Image);
        const result = engine.match(request);

        expect(result).toBeFalsy();
    });
});

describe('TestMatchSimplePattern', () => {
    it('works if it finds rule matching pattern', () => {
        const rule = '_prebid_';
        const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

        const url = 'https://ap.lijit.com/rtb/bid?src=prebid_prebid_1.35.0';
        const sourceURL = 'https://www.drudgereport.com/';

        const request = new Request(url, sourceURL, RequestType.XmlHttpRequest);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(rule);
    });
});

describe('Test Match Wildcard domain', () => {
    it('works if it finds rule matching wildcard domain', () => {
        const rule = '||*/te/^$domain=~negative.*|example.*,third-party';
        const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

        const request = new Request('https://test.ru/te/', 'https://example.com/', RequestType.Image);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(rule);

        const negativeRequest = new Request('https://test.ru/te/', 'https://negative.com/', RequestType.Image);
        const negativeResult = engine.match(negativeRequest);

        expect(negativeResult).toBeNull();
    });

    it('works if it finds rule matching wildcard domain - shortcuts', () => {
        const rule = '||*/tests/^$domain=~negative.*|example.*,third-party';
        const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

        const request = new Request('https://test.ru/tests/', 'https://example.com/', RequestType.Image);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(rule);
    });
});

describe('TestBenchNetworkEngine', () => {
    /**
     * Resources file paths
     */
    const requestsZipFilePath = './test/resources/requests.json.gz';
    const requestsFilePath = './test/resources/requests.json';
    const expectedRequestsCount = 27969;
    const rulesFilePath = './test/resources/easylist.txt';

    /**
     * Expected matches for specified requests and rules
     */
    const expectedMatchesCount = 4667;

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
        const list = new StringRuleList(1, await fs.promises.readFile(rulesFilePath, 'utf8'), true);
        const ruleStorage = new RuleStorage([list]);
        const engine = new NetworkEngine(ruleStorage);
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
            const rule = engine.match(req);
            const elapsedMatch = Date.now() - startMatch;
            totalElapsed += elapsedMatch;

            if (elapsedMatch > maxElapsedMatch) {
                maxElapsedMatch = elapsedMatch;
            }
            if (elapsedMatch < minElapsedMatch) {
                minElapsedMatch = elapsedMatch;
            }

            if (rule && !rule.isWhitelist()) {
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
