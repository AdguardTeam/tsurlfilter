import escapeStringRegexp from 'escape-string-regexp';
import { describe, expect, it } from 'vitest';

import { NetworkEngine } from '../../src/engine/network-engine';
import { type IRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { HTTPMethod } from '../../src/modifiers/method-modifier';
import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';
import { type IndexedStorageNetworkRuleParts } from '../../src/rules/rule';

/**
 * Helper function to get the rule index from the raw filter list by the rule text.
 *
 * @param rawFilterList Raw filter list.
 * @param rule Rule text.
 *
 * @returns Rule index or -1 if the rule couldn't be found.
 */
const getRawRuleIndex = (rawFilterList: string, rule: string): number => {
    return rawFilterList.search(new RegExp(`^${escapeStringRegexp(rule)}$`, 'm'));
};

const createNetworkEngine = (lists: IRuleList[]): NetworkEngine => {
    const storage = new RuleStorage(lists);
    const rulesParts: IndexedStorageNetworkRuleParts[] = [];

    const scanner = storage.createRuleStorageScanner(ScannerType.NetworkRules);

    while (scanner.scan()) {
        // We can safely cast here, because we configured scanner to scan only network rules
        rulesParts.push(scanner.getRuleParts()! as IndexedStorageNetworkRuleParts);
    }

    return NetworkEngine.createSync(rulesParts, storage);
};

describe('TestEmptyNetworkEngine', () => {
    it('works if empty engine is ok', () => {
        const engine = createNetworkEngine([new StringRuleList(1, '', false, false, false)]);
        const request = new Request('http://example.org/', '', RequestType.Other);
        const result = engine.match(request);

        expect(result).toBeNull();
    });
});

describe('TestMatchAllowlistRule', () => {
    it('works if it finds simple allowlist rule', () => {
        const rule = '||example.org^$script';
        const exceptionRule = '@@http://example.org^';
        const rules = [rule, exceptionRule];
        const rawFilterList = rules.join('\n');

        const engine = createNetworkEngine([
            new StringRuleList(1, rawFilterList, false, false, false),
        ]);
        const request = new Request('http://example.org/', '', RequestType.Script);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilterList, exceptionRule),
        );
    });

    it('finds correct $method rule', () => {
        const rule = '||example.org^';
        const exceptionRule = '@@||example.org^$method=post';
        const rules = [rule, exceptionRule];
        const rawFilterList = rules.join('\n');

        const engine = createNetworkEngine([
            new StringRuleList(1, rawFilterList, false, false, false),
        ]);
        const request = new Request('http://example.org/', '', RequestType.Script, HTTPMethod.POST);
        let result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilterList, exceptionRule),
        );

        request.method = HTTPMethod.GET;
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilterList, rule),
        );
    });

    it('finds correct $to rule', () => {
        const rule = '||evil.com^';
        const exceptionRule = '@@/ads^$to=good.evil.com';
        const rules = [rule, exceptionRule];
        const rawFilterList = rules.join('\n');

        const engine = createNetworkEngine([
            new StringRuleList(1, rawFilterList, false, false, false),
        ]);
        const request = new Request('http://evil.com/', '', RequestType.Script);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilterList, rule),
        );
    });
});

describe('TestMatchImportantRule', () => {
    const r1 = '||test2.example.org^$important';
    const r2 = '@@||example.org^';
    const r3 = '||test1.example.org^';
    const rules = [r1, r2, r3];
    const rawFilterList = rules.join('\n');

    const engine = createNetworkEngine([
        new StringRuleList(1, rawFilterList, false, false, false),
    ]);
    let request;
    let result;

    it('should find domain allowlist rule ', () => {
        request = new Request('http://example.org/', '', RequestType.Other);
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilterList, r2),
        );
    });

    it('should find domain allowlist rule', () => {
        request = new Request('http://test1.example.org/', '', RequestType.Other);
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilterList, r2),
        );
    });

    it('should find suitable sub-domain allowlist rule', () => {
        request = new Request('http://test2.example.org/', '', RequestType.Other);
        result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilterList, r1),
        );
    });
});

describe('TestMatchSourceRule', () => {
    it('works if it finds rule for source url', () => {
        // eslint-disable-next-line max-len
        const rule = '|https://$image,media,script,third-party,domain=~feedback.pornhub.com|pornhub.com|redtube.com|redtube.com.br|tube8.com|tube8.es|tube8.fr|youporn.com|youporngay.com';
        const rawFilterList = rule;
        const engine = createNetworkEngine([
            new StringRuleList(1, rawFilterList, false, false, false),
        ]);

        const url = 'https://ci.phncdn.com/videos/201809/25/184777011/original/(m=ecuKGgaaaa)(mh=VSmV9L_iouBcWJJ)4.jpg';
        const sourceURL = 'https://www.pornhub.com/view_video.php?viewkey=ph5be89d11de4b0';

        const request = new Request(url, sourceURL, RequestType.Image);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilterList, rule),
        );
    });
});

describe('Test $domain modifier semantics', () => {
    const rule = 'path$domain=example.org|check.com';
    const engine = createNetworkEngine([
        new StringRuleList(1, rule, false, false, false),
    ]);

    it('will match document url host', () => {
        const request = new Request('http://check.com/path', 'http://www.example.org/', RequestType.Document);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            0,
        );
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
        expect(
            result!.getIndex(),
        ).toBe(
            0,
        );
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
        const engine = createNetworkEngine([
            new StringRuleList(1, rule, false, false, false),
        ]);

        const url = 'https://ap.lijit.com/rtb/bid?src=prebid_prebid_1.35.0';
        const sourceURL = 'https://www.drudgereport.com/';

        const request = new Request(url, sourceURL, RequestType.XmlHttpRequest);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            0,
        );
    });
});

describe('Test match simple domain rules', () => {
    it('works if it finds rule with domain', () => {
        const rule = '||example.org';
        const engine = createNetworkEngine([
            new StringRuleList(1, rule, false, false, false),
        ]);

        const url = 'https://example.org/rtb/bid?src=prebid_prebid_1.35.0';
        const sourceURL = 'https://www.test.com/';

        const request = new Request(url, sourceURL, RequestType.XmlHttpRequest);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            0,
        );
    });

    it('works if it finds rule with naked domain', () => {
        const rule = 'example.org';
        const engine = createNetworkEngine([
            new StringRuleList(1, rule, false, false, false),
        ]);

        const url = 'https://example.org/rtb/bid?src=prebid_prebid_1.35.0';
        const sourceURL = 'https://www.test.com/';

        const request = new Request(url, sourceURL, RequestType.XmlHttpRequest);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            0,
        );
    });
});

describe('Test Match Wildcard domain', () => {
    it('works if it finds rule matching wildcard domain', () => {
        const rule = '||*/te/^$domain=~negative.*|example.*,third-party';
        const engine = createNetworkEngine([
            new StringRuleList(1, rule, false, false, false),
        ]);

        const request = new Request('https://test.ru/te/', 'https://example.com/', RequestType.Image);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            0,
        );

        const negativeRequest = new Request('https://test.ru/te/', 'https://negative.com/', RequestType.Image);
        const negativeResult = engine.match(negativeRequest);

        expect(negativeResult).toBeNull();
    });

    it('works if it finds rule matching wildcard domain - shortcuts', () => {
        const rule = '||*/tests/^$domain=~negative.*|example.*,third-party';
        const engine = createNetworkEngine([
            new StringRuleList(1, rule, false, false, false),
        ]);

        const request = new Request('https://test.ru/tests/', 'https://example.com/', RequestType.Image);
        const result = engine.match(request);

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            0,
        );
    });
});

describe('Test match denyallow rules', () => {
    it('works if it finds denyallow rule', () => {
        const rule = '*$script,domain=a.com|b.com,denyallow=x.com|y.com';
        const engine = createNetworkEngine([
            new StringRuleList(1, rule, false, false, false),
        ]);

        const result = engine.match(new Request(
            'https://z.com/',
            'https://www.a.com/',
            RequestType.Script,
        ));

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            0,
        );

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
        const engine = createNetworkEngine([
            new StringRuleList(1, rule, false, false, false),
        ]);

        const result = engine.match(new Request(
            'https://z.com/',
            'https://www.a.com/',
            RequestType.Script,
        ));

        expect(result).toBeTruthy();
        expect(
            result!.getIndex(),
        ).toBe(
            getRawRuleIndex(rule, rule),
        );

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
