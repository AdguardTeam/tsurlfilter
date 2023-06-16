import { NetworkEngine } from '../../src/engine/network-engine';
import { Request, HTTPMethod } from '../../src';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { RequestType } from '../../src/request-type';

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

describe('TestMatchAllowlistRule', () => {
    it('works if it finds simple allowlist rule', () => {
        const rule = '||example.org^$script';
        const exceptionRule = '@@http://example.org^';

        const engine = new NetworkEngine(createTestRuleStorage(1, [rule, exceptionRule]));
        const request = new Request('http://example.org/', '', RequestType.Script);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(exceptionRule);
    });

    it('finds correct $method rule', () => {
        const rule = '||example.org^';
        const exceptionRule = '@@||example.org^$method=post';

        const engine = new NetworkEngine(createTestRuleStorage(1, [rule, exceptionRule]));
        const request = new Request('http://example.org/', '', RequestType.Script, HTTPMethod.POST);
        let result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(exceptionRule);

        request.method = HTTPMethod.GET;
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(rule);
    });
});

describe('TestMatchImportantRule', () => {
    const r1 = '||test2.example.org^$important';
    const r2 = '@@||example.org^';
    const r3 = '||test1.example.org^';

    const engine = new NetworkEngine(createTestRuleStorage(1, [r1, r2, r3]));
    let request;
    let result;

    it('should find domain allowlist rule ', () => {
        request = new Request('http://example.org/', '', RequestType.Other);
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(r2);
    });

    it('should find domain allowlist rule', () => {
        request = new Request('http://test1.example.org/', '', RequestType.Other);
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(r2);
    });

    it('should find suitable sub-domain allowlist rule', () => {
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
    const rule = 'path$domain=example.org|check.com';
    const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

    it('will match document url host', () => {
        const request = new Request('http://check.com/path', 'http://www.example.org/', RequestType.Document);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result!.getText()).toEqual(rule);
    });

    it('checks pattern does not match', () => {
        const request = new Request('http://check.com/url', 'http://www.example.org/', RequestType.Document);
        const result = engine.match(request);

        expect(result).toBeFalsy();
    });

    it('will match request url host', () => {
        const request = new Request('http://check.com/path', 'http://test.com/', RequestType.Document);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result!.getText()).toEqual(rule);
    });

    it('will match request url host - subdocument', () => {
        const request = new Request('http://check.com/path', 'http://test.com/', RequestType.SubDocument);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result!.getText()).toEqual(rule);
    });

    it('checks request type Document is required', () => {
        const request = new Request('http://check.com/path', 'http://test.com/', RequestType.Image);
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

describe('Test match simple domain rules', () => {
    it('works if it finds rule with domain', () => {
        const rule = '||example.org';
        const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

        const url = 'https://example.org/rtb/bid?src=prebid_prebid_1.35.0';
        const sourceURL = 'https://www.test.com/';

        const request = new Request(url, sourceURL, RequestType.XmlHttpRequest);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(rule);
    });

    it('works if it finds rule with naked domain', () => {
        const rule = 'example.org';
        const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

        const url = 'https://example.org/rtb/bid?src=prebid_prebid_1.35.0';
        const sourceURL = 'https://www.test.com/';

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

describe('Test match denyallow rules', () => {
    it('works if it finds denyallow rule', () => {
        const rule = '*$script,domain=a.com|b.com,denyallow=x.com|y.com';
        const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

        const result = engine.match(new Request(
            'https://z.com/',
            'https://www.a.com/',
            RequestType.Script,
        ));

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(rule);

        expect(engine.match(new Request(
            'https://z.com/',
            'https://www.c.com/',
            RequestType.Script,
        ))).toBeNull();

        expect(engine.match(new Request(
            'https://x.com/',
            'https://www.a.com/',
            RequestType.Script,
        ))).toBeNull();

        expect(engine.match(new Request(
            'https://www.x.com/',
            'https://www.a.com/',
            RequestType.Script,
        ))).toBeNull();

        expect(engine.match(new Request(
            'https://sub.x.com/',
            'https://www.a.com/',
            RequestType.Script,
        ))).toBeNull();
    });

    it('works if it finds corresponding regex rule', () => {
        const rule = '/^(?!.*(x.com|y.com)).*$/$script,domain=a.com|b.com';
        const engine = new NetworkEngine(createTestRuleStorage(1, [rule]));

        const result = engine.match(new Request(
            'https://z.com/',
            'https://www.a.com/',
            RequestType.Script,
        ));

        expect(result).toBeTruthy();
        expect(result && result.getText()).toEqual(rule);

        expect(engine.match(new Request(
            'https://z.com/',
            'https://www.c.com/',
            RequestType.Script,
        ))).toBeNull();

        expect(engine.match(new Request(
            'https://x.com/',
            'https://www.a.com/',
            RequestType.Script,
        ))).toBeNull();
    });
});
