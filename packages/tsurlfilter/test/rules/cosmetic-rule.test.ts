/* eslint-disable max-len */
import { CosmeticRuleType } from '@adguard/agtree';
import { type Source } from '@adguard/scriptlets';
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';
import { type CosmeticRule } from '../../src/rules/cosmetic-rule';
import { RULE_INDEX_NONE } from '../../src/rules/rule';
import { createCosmeticRule } from '../helpers/rule-creator';

const parseParamsFromScript = (script: string): Source | null => {
    const matchArr = script.match(/\{"args.+"}/);
    if (!matchArr) {
        return null;
    }

    return JSON.parse(matchArr[0]);
};

describe('Element hiding rules constructor', () => {
    it('works if it creates element hiding rules', () => {
        const rule = createCosmeticRule('##.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHidingRule);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getIndex()).toEqual(RULE_INDEX_NONE);
        expect(rule.getContent()).toEqual('.banner');
        expect(rule.isAllowlist()).toEqual(false);
    });

    it('works if it parses domains properly', () => {
        const rule = createCosmeticRule('example.org,~sub.example.org##banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHidingRule);
        expect(rule.getContent()).toEqual('banner');

        const permittedDomains = rule.getPermittedDomains()!;
        const restrictedDomains = rule.getRestrictedDomains()!;
        expect(permittedDomains[0]).toEqual('example.org');
        expect(restrictedDomains[0]).toEqual('sub.example.org');
    });

    it('works if it creates allowlist element hiding rules', () => {
        const rule = createCosmeticRule('example.org#@#.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHidingRule);

        const permittedDomains = rule.getPermittedDomains();
        expect(permittedDomains).not.toEqual(null);
        expect(permittedDomains![0]).toEqual('example.org');
        expect(rule.isAllowlist()).toEqual(true);
    });

    it('works if it verifies rules properly', () => {
        expect(() => {
            createCosmeticRule('||example.org^', 0);
        }).toThrow(new SyntaxError('Not a cosmetic rule'));

        expect(() => {
            createCosmeticRule('example.org## ', 0);
        }).toThrow(new SyntaxError('Empty rule body'));

        expect(() => {
            createCosmeticRule('example.org##body { background: red!important; }', 0);
        }).toThrow(new SyntaxError('Curly brackets are not allowed in selector lists'));
    });

    it('checks elemhide rules validation', () => {
        const checkRuleIsValid = (ruleText: string): void => {
            expect(createCosmeticRule(ruleText, 0)).toBeDefined();
        };

        const checkRuleIsInvalid = (ruleText: string): void => {
            expect(() => {
                createCosmeticRule(ruleText, 0);
            }).toThrow();
        };

        checkRuleIsValid('example.org##img[title|="{"]');
        checkRuleIsValid('vsetor.org##body > a[rel="nofollow"][target="_blank"]');
        checkRuleIsValid("example.org##a[title='{']");
        checkRuleIsValid('123movies.domains##.jw-logo-top-left[style^="background-image: url(\\"https://123movies.domains/addons/img/"]');
        checkRuleIsValid('testcases.adguard.com,surge.sh###case9.banner:contains(/[aа]{20,}/)');
        checkRuleIsValid('parenting.pl##:xpath(//div[count(*)=1][*[count(*)=1]/*[count(*)=1]/*[count(*)=1]/*[count(*)=0]])');
        checkRuleIsValid('example.org##:contains(@import)');
        checkRuleIsValid('example.org##:contains(@font-face)');
        checkRuleIsValid('example.org##:contains(@color-profile)');
        checkRuleIsValid(String.raw`[$domain=/example\.org/|~/good/]##.banner`);

        checkRuleIsInvalid('example.org##img[title|={]');
        checkRuleIsInvalid('example.org##body { background: red!important; }');
        checkRuleIsInvalid('example.org#@#body { background: red!important; }');
        checkRuleIsInvalid('example.org##a[title="\\""]{background:url()}');
        checkRuleIsInvalid('example.org##body\\{\\}, body { background: lightblue url("https://www.w3schools.com/cssref/img_tree.gif") no-repeat fixed center!important; }');
        checkRuleIsInvalid('example.org##body /*({})*/ { background: lightblue url("https://www.w3schools.com/cssref/img_tree.gif") no-repeat fixed center!important; }');
        checkRuleIsInvalid('example.org##body /*({*/ { background: lightblue url("https://www.w3schools.com/cssref/img_tree.gif") no-repeat fixed center!important; }');
        checkRuleIsInvalid('example.org##\\\\/*[*/, body { background: lightblue url("https://www.w3schools.com/cssref/img_tree.gif") no-repeat fixed center!important; } ,\\/*]');
        checkRuleIsInvalid('example.org##body:not(blabla/*[*/) { background: lightblue url("https://www.w3schools.com/cssref/img_tree.gif") no-repeat fixed center!important; } /*]*\\/');
        checkRuleIsInvalid('example.org##.generic1 /*comment*/');
        // TODO: Consider more CSS validation
        // checkRuleIsInvalid('example.org##a //');
        checkRuleIsInvalid('example.org##input,input/*');
        checkRuleIsInvalid('example.org#$#@import \'https://evil.org/nefarious.css\'; {}');
        checkRuleIsInvalid('example.org#$#@font-face \'https://evil.org/nefarious.ttf\'; {}');
        checkRuleIsInvalid('example.org#$#@color-profile \'https://evil.org/nefarious.icc\'; {}');
    });

    it('throws error if marker is not supported yet', () => {
        expect(() => {
            createCosmeticRule('example.org$@@$script[data-src="banner"]', 0);
        }).toThrow(new SyntaxError('Not a cosmetic rule'));
    });

    it('works if it parses domain wildcard properly', () => {
        let rule = createCosmeticRule('###banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHidingRule);
        expect(rule.getContent()).toEqual('#banner');
        expect(rule.isAllowlist()).toBeFalsy();

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = createCosmeticRule('*###banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHidingRule);
        expect(rule.getContent()).toEqual('#banner');
        expect(rule.isAllowlist()).toBeFalsy();

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = createCosmeticRule('*#@#.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHidingRule);
        expect(rule.getContent()).toEqual('.banner');
        expect(rule.isAllowlist()).toBeTruthy();

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = createCosmeticRule('*#$#.textad { visibility: hidden; }', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.CssInjectionRule);
        expect(rule.getContent()).toEqual('.textad { visibility: hidden; }');

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = createCosmeticRule('*#%#//scriptlet("set-constant", "test", "true")', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ScriptletInjectionRule);
        expect(rule.getContent()).toEqual('//scriptlet("set-constant", "test", "true")');

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = createCosmeticRule('#$#.textad { visibility: hidden; }', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.CssInjectionRule);
        expect(rule.getContent()).toEqual('.textad { visibility: hidden; }');

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();
    });

    it('parses regexp value domains', () => {
        const rule = createCosmeticRule(String.raw`[$domain=example.org|/evil\.(org\|com)/|~/good/]##banner`, 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHidingRule);
        expect(rule.getContent()).toEqual('banner');

        const permittedDomains = rule.getPermittedDomains()!;
        const restrictedDomains = rule.getRestrictedDomains()!;
        expect(permittedDomains).toEqual(['example.org', String.raw`/evil\.(org|com)/`]);
        expect(restrictedDomains).toEqual([String.raw`/good/`]);
    });

    it('works if it correctly parses rule modifiers', () => {
        let rule = createCosmeticRule('[$path=page.html]###banner', 0);
        expect(rule.pathModifier?.pattern).toEqual('page.html');

        rule = createCosmeticRule(String.raw`[$path=/\[^a|b|c|\,|d|\\]\]werty\\?=qwe/,domain=example.com]###banner`, 0);
        expect(rule.pathModifier?.pattern).toEqual(String.raw`/[^a|b|c|,|d|\]]werty\?=qwe/`);

        rule = createCosmeticRule('[$path=/page*.html]example.com###banner', 0);
        expect(rule.pathModifier?.pattern).toEqual('/page*.html');

        // TODO: AGTree throws an error here, because it does not support empty modifiers
        // rule = createCosmeticRule('[$path=qwerty,]example.com###banner', 0);
        // expect(rule.pathModifier?.pattern).toEqual('qwerty');

        // rule = createCosmeticRule('[$,path=qwerty]example.com###banner', 0);
        // expect(rule.pathModifier?.pattern).toEqual('qwerty');

        rule = createCosmeticRule('[$path]###banner', 0);
        expect(rule.pathModifier?.pattern).toEqual('');

        rule = createCosmeticRule('example.com###banner', 0);
        expect(rule.pathModifier).toEqual(undefined);

        rule = createCosmeticRule('[$url=example.org/category/4]###banner', 0); // ""
        expect(rule.urlModifier?.pattern).toEqual('example.org/category/4');

        rule = createCosmeticRule(String.raw`[$url=/example\.org/]###banner`, 0);
        expect(rule.urlModifier?.pattern).toEqual('/example\\.org/');

        expect(() => {
            createCosmeticRule('[$url=/path]example.org###banner', 0);
        }).toThrow(new SyntaxError("'$url' modifier is not allowed in a domain-specific rule"));

        expect(() => {
            createCosmeticRule('[$url=/path,domain=example.org]###banner', 0);
        }).toThrow(new SyntaxError("'$url' modifier cannot be used with other modifiers"));

        expect(() => {
            createCosmeticRule('[$path=page.html###banner', 0);
        }).toThrow(new SyntaxError("Missing ']' at the end of the AdGuard modifier list in pattern '[$path=page.html'"));

        expect(() => {
            createCosmeticRule('[$domain,path=/page*.html]###banner', 0);
        }).toThrow(new SyntaxError("'$domain' modifier should have a value"));

        expect(() => {
            createCosmeticRule('[$]example.com###banner', 0);
        }).toThrow(new SyntaxError('Modifiers list cannot be be empty'));

        expect(() => {
            createCosmeticRule('[$test=example.com,path=/page*.html]###banner', 0);
        }).toThrow(new SyntaxError("'$test' modifier is not supported"));

        expect(() => {
            createCosmeticRule('[$domain=example.com]example.org###banner', 0);
        }).toThrow(new SyntaxError("'$domain' modifier is not allowed in a domain-specific rule"));
    });
});

describe('CosmeticRule match', () => {
    const createRequest = (url: string, sourceUrl?: string): Request => {
        const source = sourceUrl || url;
        return new Request(url, source, RequestType.Document);
    };

    it('works if it matches wide rules', () => {
        const rule = createCosmeticRule('##banner', 0);
        expect(rule.match(createRequest('https://example.org'))).toEqual(true);
    });

    it('matches requests by regexp pattern of domain', () => {
        let rule: CosmeticRule;
        // Simple case
        rule = createCosmeticRule(String.raw`[$domain=/example\.(org\|com)/]##banner`, 0);
        expect(rule.match(createRequest('https://example.org'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com'))).toEqual(true);
        expect(rule.match(createRequest('https://example.net'))).toEqual(false);

        // Multiple patterns, inverted value
        rule = createCosmeticRule(String.raw`[$domain=/example/|~/org/]##banner`, 0);
        expect(rule.match(createRequest('https://example.org'))).toEqual(false);
        expect(rule.match(createRequest('https://example.com'))).toEqual(true);
        expect(rule.match(createRequest('https://example.net'))).toEqual(true);
    });

    it('matches by $domain modifier with mixed type values', () => {
        let request: Request;
        const rule = createCosmeticRule(String.raw`[$domain=/\.(io\|com)/|evil.*|ads.net|~/jwt\.io/|~evil.gov]##banner`, 0);
        expect(rule.getPermittedDomains()).toHaveLength(3);
        expect(rule.getRestrictedDomains()).toHaveLength(2);

        request = createRequest('https://ads.net');
        expect(rule.match(request)).toBeTruthy();
        request = createRequest('https://another.org');
        expect(rule.match(request)).toBeFalsy();

        // Inverted regexp domain '~/jwt\.io/' restricts
        // regexp domain modifier '/\.(io\|com)/' from matching the request
        request = createRequest('https://example.com');
        expect(rule.match(request)).toBeTruthy();
        request = createRequest('https://jwt.io');
        expect(rule.match(request)).toBeFalsy();

        // Inverted plain domain '~evil.gov' restricts
        // wildcard domain modifier 'evil.*' from matching the request
        request = createRequest('https://evil.org');
        expect(rule.match(request)).toBeTruthy();
        request = createRequest('https://evil.com');
        expect(rule.match(request)).toBeTruthy();
        request = createRequest('https://evil.gov');
        expect(rule.match(request)).toBeFalsy();
    });

    it('works if it matches domain restrictions properly', () => {
        const rule = createCosmeticRule('example.org,~sub.example.org##banner', 0);
        expect(rule.match(createRequest('https://example.org'))).toEqual(true);
        expect(rule.match(createRequest('https://test.example.org'))).toEqual(true);
        expect(rule.match(createRequest('https://testexample.org'))).toEqual(false);
        expect(rule.match(createRequest('https://sub.example.org'))).toEqual(false);
        expect(rule.match(createRequest('https://sub.sub.example.org'))).toEqual(false);
    });

    it('works if it matches wildcard domain restrictions properly', () => {
        const rule = createCosmeticRule('example.*##body', 0);
        expect(rule.match(createRequest('https://example.org'))).toEqual(true);
        expect(rule.match(createRequest('https://example.de'))).toEqual(true);
        expect(rule.match(createRequest('https://example.co.uk'))).toEqual(true);
        expect(rule.match(createRequest('https://sub.example.org'))).toEqual(true);

        expect(rule.match(createRequest('https://testexample.org'))).toEqual(false);
        // non-existent tld
        expect(rule.match(createRequest('https://example.eu.uk'))).toEqual(false);
    });

    it('works if it matches wildcard domain restrictions properly - complicated', () => {
        const rule = createCosmeticRule('~yandex.*,google.*,youtube.*###ad-iframe', 0);
        expect(rule.match(createRequest('https://google.com'))).toEqual(true);
        expect(rule.match(createRequest('https://youtube.ru'))).toEqual(true);
        expect(rule.match(createRequest('https://youtube.co.id'))).toEqual(true);

        expect(rule.match(createRequest('https://yandex.com'))).toEqual(false);
        expect(rule.match(createRequest('https://www.yandex.ru'))).toEqual(false);
        expect(rule.match(createRequest('https://www.adguard.com'))).toEqual(false);
    });

    it('works if it matches wildcard rule', () => {
        const rule = createCosmeticRule('*##banner', 0);
        expect(rule.match(createRequest('https://example.org'))).toEqual(true);
        expect(rule.match(createRequest('https://test.com'))).toEqual(true);
    });

    it('works if it matches rule with path modifier pattern', () => {
        let rule = createCosmeticRule('[$path=page.html]##.textad', 0);

        expect(rule.match(createRequest('https://example.org/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/page.html?param=1'))).toEqual(true);
        expect(rule.match(createRequest('https://example.org/sub/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://example.org/sub/another_page.html'))).toEqual(true);

        expect(rule.match(createRequest('https://example.org'))).toEqual(false);
        expect(rule.match(createRequest('https://example.org/another.html'))).toEqual(false);

        rule = createCosmeticRule('[$path=/page.html]##.textad', 0);

        expect(rule.match(createRequest('https://example.org/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/page.html?param=1'))).toEqual(true);
        expect(rule.match(createRequest('https://example.org/sub/page.html'))).toEqual(true);

        expect(rule.match(createRequest('https://example.org/sub/another_page.html'))).toEqual(false);
    });

    it('works if it matches rule with url modifier pattern', () => {
        let rule: CosmeticRule;
        let url: string;

        // simple match
        rule = createCosmeticRule('[$url=||example.org^]##.textad', 0);
        url = 'https://example.org/category/5/item.html';
        expect(rule.match(createRequest(url))).toEqual(true);
        url = 'https://example.com';
        expect(rule.match(createRequest(url))).toEqual(false);

        // simple match with regexp
        rule = createCosmeticRule(String.raw`[$url=/example.(com|org|uk)/]##.textad`, 0);
        url = 'https://example.org/category/5/item.html';
        expect(rule.match(createRequest(url))).toEqual(true);
        url = 'https://example.jp/category/5/item.html';
        expect(rule.match(createRequest(url))).toEqual(false);

        // match with wildcards
        rule = createCosmeticRule('[$url=*://example.org/category/*]##body', 0);
        url = 'https://example.org/category/5/item.html';
        expect(rule.match(createRequest(url))).toEqual(true);
        url = 'https://example.org/gallery/5/item.html';
        expect(rule.match(createRequest(url))).toEqual(false);
    });

    it('works if it matches path modifier with \'|\' special character included in the rule', () => {
        let rule = createCosmeticRule('[$path=|/page.html]##.textad', 0);

        expect(rule.match(createRequest('https://example.org/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/page.html?param=1'))).toEqual(true);

        expect(rule.match(createRequest('https://example.org/sub/page.html'))).toEqual(false);

        rule = createCosmeticRule('[$path=/page|]##.textad', 0);

        expect(rule.match(createRequest('https://example.org/page'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/page'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/sub/page'))).toEqual(true);

        expect(rule.match(createRequest('https://another.org/page?param=1'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://example.org/page/sub'))).toEqual(false);
    });

    it('works if it matches path modifier with wildcard included in the rule, limited by domain pattern', () => {
        const rule = createCosmeticRule('[$path=/page*.html]example.com,~test.example.com##.textad', 0);

        expect(rule.match(createRequest('https://example.com/page1.html'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com/page2.html?param=1'))).toEqual(true);

        expect(rule.match(createRequest('https://test.example.com/page1.html'))).toEqual(false);
        expect(rule.match(createRequest('https://example.com/another-page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/page1.html'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/page2.html'))).toEqual(false);
    });

    it('works if it matches path modifier without a value correctly', () => {
        const rule = createCosmeticRule('[$domain=example.com,path]##.textad', 0);

        expect(rule.match(createRequest('https://example.com/'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com/page1.html'))).toEqual(false);
        expect(rule.match(createRequest('https://example.com/page2.html?param=1'))).toEqual(false);
    });

    it('works if it matches domain and path modifiers included in the rule', () => {
        const rule = createCosmeticRule('[$domain=example.com|~test.example.com,path=/page.html]##.textad', 0);

        expect(rule.match(createRequest('http://example.com/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com/page.html?param=1'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com/sub/page.html'))).toEqual(true);

        expect(rule.match(createRequest('https://test.example.com/page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://example.com/another-page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/page.html'))).toEqual(false);
    });

    it('works when $domain in uppercase', () => {
        const rule = createCosmeticRule('[$domain=exAMPle.com]##.textad', 0);
        expect(rule.match(createRequest('http://example.com/'))).toEqual(true);
    });

    it('work if it matches path modifiers with regex included in the rule', () => {
        const testReString = String.raw`/\\/(sub1|sub2)\\/page\\.html/`;
        const rule = createCosmeticRule(`[$path=${testReString}]##.textad`, 0);

        expect(rule.match(createRequest('https://example.com/sub1/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/sub2/page.html'))).toEqual(true);

        expect(rule.match(createRequest('https://example.com/page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/sub3/page.html'))).toEqual(false);
    });

    it('work if it matches urls with complex public suffixes', () => {
        const requestUrl = 'https://www.city.toyota.aichi.jp/';
        const rule1 = createCosmeticRule('aichi.jp###sad', 0);
        const rule2 = createCosmeticRule('toyota.aichi.jp###sad', 0);

        expect(rule1.match(createRequest(requestUrl))).toEqual(true);
        expect(rule2.match(createRequest(requestUrl))).toEqual(true);
    });
});

describe('CosmeticRule.CSS', () => {
    it('correctly detects Cosmetic.CSS allowlist and blacklist rules', () => {
        const rule = createCosmeticRule('example.org#$#.textad { visibility: hidden; }\n', 0);
        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.CssInjectionRule);

        const allowlistRule = createCosmeticRule('example.org#@$#.textad { visibility: hidden; }', 0);
        expect(allowlistRule.isAllowlist()).toBeTruthy();
        expect(allowlistRule.getType()).toBe(CosmeticRuleType.CssInjectionRule);

        const extendedRule = createCosmeticRule('example.com#$?#h3:contains(cookies) { display: none!important; }', 0);
        expect(extendedRule.isAllowlist()).toBeFalsy();
        expect(extendedRule.getType()).toBe(CosmeticRuleType.CssInjectionRule);

        // eslint-disable-next-line max-len
        const extendedAllowlistRule = createCosmeticRule('example.com#@$?#h3:contains(cookies) { display: none!important; }', 0);
        expect(extendedAllowlistRule.isAllowlist()).toBeTruthy();
        expect(extendedAllowlistRule.getType()).toBe(CosmeticRuleType.CssInjectionRule);
    });

    it('accepts VALID pseudo classes', () => {
        // eslint-disable-next-line max-len
        let selector = '#main > table.w3-table-all.notranslate:first-child > tbody > tr:nth-child(17) > td.notranslate:nth-child(2)';
        let ruleText = `example.org##${selector}`;
        let cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '#:root div.ads';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '#body div[attr=\'test\']:first-child  div';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '#body div[attr=\'test\']:first-child';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class::after';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:matches-css(display: block)';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:matches-css-before(display: block)';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:matches-css-after(display: block)';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:has(.banner)';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:contains(test)';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:if(test)';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:if-not(test)';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = 'div > :where(h1, p)';
        ruleText = `example.org##${selector}`;
        cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);
    });

    it('throws error on invalid pseudo class', () => {
        const pseudoClass = 'matches';
        const selector = `test:${pseudoClass}(.foo)`;
        expect(() => {
            createCosmeticRule(`example.org##${selector}`, 0);
        }).toThrow(new SyntaxError(`Unsupported pseudo-class: ':${pseudoClass}'`));
    });

    it('respects escaped colons when validates pseudo classes', () => {
        const selector = '#body div[attr=\'\\:matches(text)\']';
        const ruleText = `example.org##${selector}`;
        const cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);
    });

    it('doesnt searches pseudo classes inside attributes values', () => {
        const selector = 'a[src^="http://domain.com"]';
        const ruleText = `example.org##${selector}`;
        const cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);
    });

    it('does not fails pseudo classes search on bad selector', () => {
        const selector = 'a[src^="http:';
        const ruleText = `example.org##${selector}`;
        const cssRule = createCosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);
    });

    it('throws error when cosmetic rule does not contain css style', () => {
        expect(() => {
            createCosmeticRule('example.org#$#div', 0);
        }).toThrow(new SyntaxError("Parsing 'AdblockPlus' syntax is disabled, but the rule uses it"));

        expect(() => {
            createCosmeticRule('example.org#$?#div', 0);
        }).toThrow(new SyntaxError("Body 'div' is not valid for the '#$?#' cosmetic rule separator"));
    });

    it('throws error when cosmetic rule contains url', () => {
        expect(
            () => createCosmeticRule('example.com#$#body { background: url(http://example.org/empty.gif) }', 0),
        ).toThrowError(
            "Using 'url()' is not allowed",
        );

        expect(
            () => createCosmeticRule('example.org#$#body { background:url("http://example.org/image.png"); }', 0),
        ).toThrowError(
            "Using 'url()' is not allowed",
        );
    });

    it('throws error when cosmetic rule contains unsafe styles', () => {
        expect(
            () => createCosmeticRule('*#$#* { background:image-set(\'https://hackvertor.co.uk/images/logo.gif\' 1x) }', 0),
        ).toThrowError(
            "Using 'image-set()' is not allowed",
        );

        expect(
            () => createCosmeticRule('*#$#* { background:image(\'https://hackvertor.co.uk/images/logo.gif\' 1x) }', 0),
        ).toThrowError(
            "Using 'image()' is not allowed",
        );

        expect(
            () => createCosmeticRule('*#$#* { background:cross-fade(\'https://hackvertor.co.uk/images/logo.gif\' 1x) }', 0),
        ).toThrowError(
            "Using 'cross-fade()' is not allowed",
        );
    });

    it('doesnt throw error if cosmetic rule contains url in selector', () => {
        const validRule = 'example.com#$#body[style*="background-image: url()"] { margin-top: 45px !important; }';
        const rule = createCosmeticRule(validRule, 0);
        expect(rule).toBeTruthy();
    });

    it('checks backslash in cosmetic rules content', () => {
        const backslashInElemhideRules = createCosmeticRule('example.org###Meebo\\:AdElement\\.Root', 0);
        expect(backslashInElemhideRules).toBeDefined();

        const backslashInCssRulesSelector = createCosmeticRule('example.org#$?#div:matches-css(width: /\\d+/) { background-color: red!important; }', 0);
        expect(backslashInCssRulesSelector).toBeDefined();

        const backslashInCssRulesSelector2 = createCosmeticRule('example.org#$?##p:has-text(/[\\w\\W]{337}/):has-text(/Dołącz \\./) { font-size: 0 !important; }', 0);
        expect(backslashInCssRulesSelector2).toBeDefined();

        const checkRuleIsInvalid = (ruleText: string): void => {
            expect(() => {
                createCosmeticRule(ruleText, 0);
            }).toThrow(new SyntaxError("Using 'url()' is not allowed"));
        };

        checkRuleIsInvalid('example.com#$#body { background: url(http://example.org/empty.gif) }');
        checkRuleIsInvalid('example.com#$#body { background: url("http://example.org/empty.gif") }');
        checkRuleIsInvalid("example.com#$#body { background: url('http://example.org/empty.gif') }");
        checkRuleIsInvalid('example.com#$#body { background: \\75rl(http://example.org/empty.gif) }');
        checkRuleIsInvalid('example.com#$#body { background: \\75 rl(http://example.org/empty.gif) }');
        checkRuleIsInvalid('example.com#$#body { background: \\075\\072\\06C(http://example.org/empty.gif) }');
        checkRuleIsInvalid('example.com#$#body { background: \\075 \\072 \\06C(http://example.org/empty.gif) }');
        checkRuleIsInvalid('example.com#$#body { background: \\00075\\00072\\0006C(http://example.org/empty.gif) }');
        checkRuleIsInvalid('example.com#$#body { background: \\00075 \\00072 \\0006C(http://example.org/empty.gif) }');
    });
});

describe('Extended css rule', () => {
    let ruleText = '~example.com,example.org##.sponsored[-ext-contains=test]';
    let rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored[-ext-contains=test]');

    ruleText = '~example.com,example.org##.sponsored[-ext-has=test]';
    rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored[-ext-has=test]');

    // :has() pseudo-class has native implementation.
    // and since ExtendedCss v2 release
    // the rule with `##` marker and `:has()` should not be considered as ExtendedCss
    // https://github.com/AdguardTeam/ExtendedCss#extended-css-has
    ruleText = '~example.com,example.org##.sponsored:has(test)';
    rule = createCosmeticRule(ruleText, 0);

    // TODO: change later to 'toBeFalsy'
    // after ':has(' is removed from EXT_CSS_PSEUDO_INDICATORS
    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored:has(test)');

    // but :has() pseudo-class should be considered as ExtendedCss
    // if the rule marker is `#?#`
    ruleText = 'example.org#?#.sponsored:has(.banner)';
    rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored:has(.banner)');

    // :is() pseudo-class has native implementation alike :has(),
    // so the rule with `##` marker and `:is()` should not be considered as ExtendedCss
    // https://github.com/AdguardTeam/ExtendedCss#extended-css-is
    ruleText = 'example.org##.banner:is(div, p)';
    rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeFalsy();
    expect(rule.getContent()).toEqual('.banner:is(div, p)');

    // but :is() pseudo-class should be considered as ExtendedCss
    // if the rule marker is `#?#`
    ruleText = 'example.org#?#.banner:is(div, p)';
    rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.banner:is(div, p)');

    // the same ExtendedCss marker enforcement should work for :not() as well
    // https://github.com/AdguardTeam/ExtendedCss#extended-css-not
    ruleText = 'example.org##.banner:not(.main, .content)';
    rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeFalsy();
    expect(rule.getContent()).toEqual('.banner:not(.main, .content)');

    // but :not() pseudo-class should be considered as ExtendedCss
    // if the rule marker is `#?#`
    ruleText = 'example.org#?#.banner:not(.main, .content)';
    rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.banner:not(.main, .content)');

    ruleText = '~example.com,example.org#?#div';
    rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('div');

    ruleText = '~example.com,example.org#$?#div { background-color: #333!important; }';
    rule = createCosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('div { background-color: #333!important; }');

    it('does not confuses extended css rules with script rules', () => {
        // eslint-disable-next-line max-len
        ruleText = '#%#var AG_defineProperty=function(){return a={get:function(){var a=i.f;a&&a.beforeGet&&a.beforeGet.call(this,i.a.b);e:if(a=i.g)a=A(a)?a.value:a.get?a.get.call(this):void 0;else{if(a=i.a.b,i.i in a&&null!==(a=B(a))){var t=C.call(a,i.i);a=t?t.call(this):a[i.i];break e}a=void 0}return(this===i.a.b||D.call(i.a.b,this))&&E(e,a,i.c),a}},d&&J(d,a,K),a;var e,i,a}();';
        rule = createCosmeticRule(ruleText, 0);
        expect(rule.isExtendedCss()).toBeFalsy();
    });
});

describe('Javascript rules', () => {
    it('correctly parses js rules', () => {
        const jsContent = 'window.__gaq = undefined;';
        const ruleText = `example.org#%#${jsContent}`;
        const rule = createCosmeticRule(ruleText, 0);

        expect(rule).toBeTruthy();
        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.JsInjectionRule);
        expect(rule.getContent()).toBe(jsContent);
        expect(rule.isScriptlet).toBeFalsy();

        const allowlistRuleText = `example.org#@%#${jsContent}`;
        const allowlistRule = createCosmeticRule(allowlistRuleText, 0);

        expect(allowlistRule).toBeTruthy();
        expect(allowlistRule.isAllowlist()).toBeTruthy();
        expect(allowlistRule.getType()).toBe(CosmeticRuleType.JsInjectionRule);
        expect(allowlistRule.getContent()).toBe(jsContent);
        expect(rule.isScriptlet).toBeFalsy();
    });

    it('correctly parses js scriptlets rules', () => {
        const jsContent = '//scriptlet("set-constant", "test", "true")';
        const ruleText = `example.org#%#${jsContent}`;
        const rule = createCosmeticRule(ruleText, 0);

        expect(rule).toBeTruthy();
        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.ScriptletInjectionRule);
        expect(rule.getContent()).toBe(jsContent);
        expect(rule.isScriptlet).toBeTruthy();

        const allowlistRuleText = `example.org#@%#${jsContent}`;
        const allowlistRule = createCosmeticRule(allowlistRuleText, 0);

        expect(allowlistRule).toBeTruthy();
        expect(allowlistRule.isAllowlist()).toBeTruthy();
        expect(allowlistRule.getType()).toBe(CosmeticRuleType.ScriptletInjectionRule);
        expect(allowlistRule.getContent()).toBe(jsContent);
        expect(rule.isScriptlet).toBeTruthy();
    });

    it('validate js scriptlet and regexp param', () => {
        const jsRuleContent = '//scriptlet("prevent-setTimeout", "/location\\.href=\\"https:\\/\\/www\\.example\\.com\\//")';
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = createCosmeticRule(jsRule, 0);

        const scriptletData = rule.getScriptletData()!;
        expect(typeof scriptletData.func).toBe('function');
        expect(scriptletData.func.name).toBe('preventSetTimeout');
        expect(scriptletData.params).toMatchObject({
            name: 'prevent-setTimeout',
            args: ['/location\\.href="https:\\/\\/www\\.example\\.com\\//'],
        });
    });

    it('returns script for js rule', () => {
        const jsRuleContent = 'console.log(\'test\')';
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = createCosmeticRule(jsRule, 0);

        expect(rule.getScript()).toBe(jsRuleContent);
    });

    it('returns script for scriptlet rule', () => {
        const jsRuleContent = "//scriptlet('log', 'arg')";
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = createCosmeticRule(jsRule, 0);
        const verbose = true;
        const frameUrl = 'https://example.com';

        const script = rule.getScript({ debug: verbose, frameUrl })!;
        const params = parseParamsFromScript(script)!;
        expect(params.name).toBe('log');
        expect(params.args).toEqual(['arg']);
        expect(params.domainName).toBe(frameUrl);
        expect(params.verbose).toBe(verbose);
    });

    it('rebuilds scriptlet script if debug changes', () => {
        const jsRuleContent = "//scriptlet('log', 'arg')";
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = createCosmeticRule(jsRule, 0);
        let verbose = true;

        vi.spyOn(rule, 'initScript');

        expect(rule.initScript).toBeCalledTimes(0);

        // after first get script call
        let script = rule.getScript({ debug: verbose })!;
        let params = parseParamsFromScript(script)!;
        expect(params.name).toBe('log');
        expect(params.args).toEqual(['arg']);
        expect(params.verbose).toBe(verbose);
        expect(rule.initScript).toBeCalledTimes(1);

        // after second get script call
        script = rule.getScript({ debug: verbose })!;
        params = parseParamsFromScript(script)!;
        expect(params.name).toBe('log');
        expect(params.args).toEqual(['arg']);
        expect(params.verbose).toBe(verbose);
        expect(rule.initScript).toBeCalledTimes(1);

        // after third get script call with other debug param
        verbose = false;
        script = rule.getScript({ debug: verbose })!;
        params = parseParamsFromScript(script)!;
        expect(params.name).toBe('log');
        expect(params.args).toEqual(['arg']);
        expect(params.verbose).toBe(verbose);
        expect(rule.initScript).toBeCalledTimes(2);
    });

    it('rebuilds scriptlet script if domain name changes', () => {
        const jsRuleContent = "//scriptlet('log', 'arg')";
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = createCosmeticRule(jsRule, 0);
        const verbose = false;
        let frameUrl = 'https://example.com';

        vi.spyOn(rule, 'initScript');

        expect(rule.initScript).toBeCalledTimes(0);

        // after first get script call
        let script = rule.getScript({ debug: verbose, frameUrl })!;
        let params = parseParamsFromScript(script)!;
        expect(params.domainName).toBe(frameUrl);
        expect(rule.initScript).toBeCalledTimes(1);

        // after second get script call
        script = rule.getScript({ debug: verbose, frameUrl })!;
        params = parseParamsFromScript(script)!;
        expect(params.domainName).toBe(frameUrl);
        expect(rule.initScript).toBeCalledTimes(1);

        // after third get script call with other domain name
        frameUrl = 'https://example.org';
        script = rule.getScript({ debug: verbose, frameUrl })!;
        params = parseParamsFromScript(script)!;
        expect(params.domainName).toBe(frameUrl);
        expect(rule.initScript).toBeCalledTimes(2);
    });

    it('returns scriptlet function and params for scriptlet', () => {
        const jsRuleContent = "//scriptlet('log', 'arg')";
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = createCosmeticRule(jsRule, 0);

        const scriptletData = rule.getScriptletData()!;
        expect(typeof scriptletData.func).toBe('function');
        expect(scriptletData.func.name).toBe('log');
        expect(scriptletData.params).toMatchObject({
            name: 'log',
            args: ['arg'],
        });
    });

    it('invalidate scriptlet rule with missed arg quote', () => {
        let jsRuleContent = "//scriptlet('foo', arg')";
        let jsRule = `example.org#%#${jsRuleContent}`;

        expect(() => {
            createCosmeticRule(jsRule, 0);
        }).toThrow(new SyntaxError("Invalid ADG scriptlet call, expected quote, got 'a'"));

        jsRuleContent = "//scriptlet('foo', 'arg')";
        jsRule = `example.org#%#${jsRuleContent}`;

        expect(() => {
            createCosmeticRule(jsRule, 0);
        }).toThrow(new SyntaxError("'foo' is not a known scriptlet name"));
    });

    it('returns scriptlet name', () => {
        const getScriptletName = (ruleText: string): string | null => {
            return (createCosmeticRule(ruleText, 0)).scriptletParams?.name || null;
        };
        expect(getScriptletName("example.org#%#//scriptlet('log', 'arg')")).toBe('log');
        expect(getScriptletName("#%#//scriptlet('log', 'arg')")).toBe('log');
        expect(getScriptletName('example.org#%#//scriptlet()')).toBe(null);
        expect(getScriptletName('#@%#//scriptlet()')).toBe(null);
        expect(getScriptletName("#@%#//scriptlet('set-cookie')")).toBe('set-cookie');
        expect(getScriptletName('#@%#//scriptlet("set-cookie")')).toBe('set-cookie');
        expect(getScriptletName("#%#//scriptlet('ubo-nobab')")).toBe('ubo-nobab');
    });

    it('normalizes scriptlet rule content', () => {
        const getScriptletContent = (ruleText: string): string | null => {
            return (createCosmeticRule(ruleText, 0)).scriptletParams.toString();
        };
        expect(getScriptletContent("example.org#%#//scriptlet('log', 'arg')")).toBe("//scriptlet('log', 'arg')");
        expect(getScriptletContent('example.org#@%#//scriptlet()')).toBe('//scriptlet()');
        expect(getScriptletContent('example.org#@%#//scriptlet("set-cookie")')).toBe("//scriptlet('set-cookie')");
        expect(getScriptletContent('example.org#@%#//scriptlet("set-cookie")')).toBe("//scriptlet('set-cookie')");

        // single quotes are escaped
        expect(getScriptletContent(String.raw`example.org#@%#//scriptlet("set-cookie", "some'escaped")`)).toBe(String.raw`//scriptlet('set-cookie', 'some\'escaped')`);

        // no need to have escaped double quotes in the arguments
        expect(getScriptletContent(String.raw`example.org#@%#//scriptlet("set-cookie", "some\"escaped")`)).toBe(String.raw`//scriptlet('set-cookie', 'some"escaped')`);

        // no need to escape single quotes if they were already escaped
        expect(getScriptletContent(String.raw`example.org#@%#//scriptlet('set-cookie', 'some\'escaped')`)).toBe(String.raw`//scriptlet('set-cookie', 'some\'escaped')`);
    });
});

describe('HTML filtering rules (content rules)', () => {
    it('correctly parses html rules', () => {
        const contentPart = 'div[id="ad_text"]';
        const domainPart = 'example.org';
        const ruleText = `${domainPart}$$${contentPart}`;

        const rule = createCosmeticRule(ruleText, 0);

        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.HtmlFilteringRule);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);

        const allowlistRuleText = `${domainPart}$@$${contentPart}`;
        const allowlistRule = createCosmeticRule(allowlistRuleText, 0);

        expect(allowlistRule.isAllowlist()).toBeTruthy();
        expect(allowlistRule.getType()).toBe(CosmeticRuleType.HtmlFilteringRule);
        expect(allowlistRule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);
    });

    it('correctly parses html rules - wildcards', () => {
        const contentPart = 'div[id="ad_text"][wildcard="*Test*[123]{123}*"]';
        const domainPart = 'example.org';
        const ruleText = `${domainPart}$$${contentPart}`;
        const rule = createCosmeticRule(ruleText, 0);

        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.HtmlFilteringRule);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);
    });

    it('correctly parses html rules - complicated cases', () => {
        // eslint-disable-next-line max-len
        const contentPart = 'div[id="ad_text"][tag-content="teas""ernet"][max-length="500"][min-length="50"][wildcard="*.adriver.*"][parent-search-level="15"][parent-elements="td,table"]';
        const ruleText = `~nigma.ru,google.com$$${contentPart}`;
        const rule = createCosmeticRule(ruleText, 0);

        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.HtmlFilteringRule);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe('google.com');
        expect(rule.getRestrictedDomains()).toHaveLength(1);
        expect(rule.getRestrictedDomains()![0]).toBe('nigma.ru');
    });

    it('correctly parses html rules - attribute with no value', () => {
        const contentPart = 'div[custom_attr]';
        const domainPart = 'example.com';
        const ruleText = `${domainPart}$$${contentPart}`;
        const rule = createCosmeticRule(ruleText, 0);

        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.HtmlFilteringRule);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);
    });
});
