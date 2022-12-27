/* eslint-disable max-len */
import { IConfiguration } from '@adguard/scriptlets';
import { CosmeticRule, CosmeticRuleType } from '../../src/rules/cosmetic-rule';
import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';

const parseParamsFromScript = (script: string): IConfiguration | null => {
    const matchArr = script.match(/\{"args.+"}/);
    if (!matchArr) {
        return null;
    }

    return JSON.parse(matchArr[0]);
};

describe('Element hiding rules constructor', () => {
    it('works if it creates element hiding rules', () => {
        const rule = new CosmeticRule('##.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getPermittedDomains()).toBeUndefined();
        expect(rule.getRestrictedDomains()).toBeUndefined();
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('##.banner');
        expect(rule.getContent()).toEqual('.banner');
        expect(rule.isAllowlist()).toEqual(false);
    });

    it('works if it parses domains properly', () => {
        const rule = new CosmeticRule('example.org,~sub.example.org##banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getContent()).toEqual('banner');

        const permittedDomains = rule.getPermittedDomains()!;
        const restrictedDomains = rule.getRestrictedDomains()!;
        expect(permittedDomains[0]).toEqual('example.org');
        expect(restrictedDomains[0]).toEqual('sub.example.org');
    });

    it('works if it creates allowlist element hiding rules', () => {
        const rule = new CosmeticRule('example.org#@#.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);

        const permittedDomains = rule.getPermittedDomains();
        expect(permittedDomains).not.toEqual(null);
        expect(permittedDomains![0]).toEqual('example.org');
        expect(rule.isAllowlist()).toEqual(true);
    });

    it('works if it verifies rules properly', () => {
        expect(() => {
            new CosmeticRule('||example.org^', 0);
        }).toThrow(new SyntaxError('Not a cosmetic rule'));

        expect(() => {
            new CosmeticRule('example.org## ', 0);
        }).toThrow(new SyntaxError('Rule content is empty'));

        expect(() => {
            new CosmeticRule('example.org##body { background: red!important; }', 0);
        }).toThrow(new SyntaxError('Invalid cosmetic rule, wrong brackets'));
    });

    it('checks elemhide rules validation', () => {
        const checkRuleIsValid = (ruleText: string): void => {
            expect(new CosmeticRule(ruleText, 0)).toBeDefined();
        };

        const checkRuleIsInvalid = (ruleText: string): void => {
            expect(() => {
                new CosmeticRule(ruleText, 0);
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
        checkRuleIsInvalid('example.org##a //');
        checkRuleIsInvalid('example.org##input,input/*');
        checkRuleIsInvalid('example.org#$#@import \'https://evil.org/nefarious.css\'; {}');
        checkRuleIsInvalid('example.org#$#@font-face \'https://evil.org/nefarious.ttf\'; {}');
        checkRuleIsInvalid('example.org#$#@color-profile \'https://evil.org/nefarious.icc\'; {}');
    });

    it('throws error if marker is not supported yet', () => {
        expect(() => {
            new CosmeticRule('example.org$@@$script[data-src="banner"]', 0);
        }).toThrow(new SyntaxError('Not a cosmetic rule'));
    });

    it('works if it parses domain wildcard properly', () => {
        let rule = new CosmeticRule('###banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getContent()).toEqual('#banner');
        expect(rule.isAllowlist()).toBeFalsy();

        expect(rule.getPermittedDomains()).toBeUndefined();
        expect(rule.getRestrictedDomains()).toBeUndefined();

        rule = new CosmeticRule('*###banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getContent()).toEqual('#banner');
        expect(rule.isAllowlist()).toBeFalsy();

        expect(rule.getPermittedDomains()).toBeUndefined();
        expect(rule.getRestrictedDomains()).toBeUndefined();

        rule = new CosmeticRule('*#@#.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getContent()).toEqual('.banner');
        expect(rule.isAllowlist()).toBeTruthy();

        expect(rule.getPermittedDomains()).toBeUndefined();
        expect(rule.getRestrictedDomains()).toBeUndefined();

        rule = new CosmeticRule('*#$#.textad { visibility: hidden; }', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.Css);
        expect(rule.getContent()).toEqual('.textad { visibility: hidden; }');

        expect(rule.getPermittedDomains()).toBeUndefined();
        expect(rule.getRestrictedDomains()).toBeUndefined();

        rule = new CosmeticRule('*#%#//scriptlet("set-constant", "test", "true")', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.Js);
        expect(rule.getContent()).toEqual('//scriptlet("set-constant", "test", "true")');

        expect(rule.getPermittedDomains()).toBeUndefined();
        expect(rule.getRestrictedDomains()).toBeUndefined();

        rule = new CosmeticRule('#$#.textad { visibility: hidden; }', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.Css);
        expect(rule.getContent()).toEqual('.textad { visibility: hidden; }');

        expect(rule.getPermittedDomains()).toBeUndefined();
        expect(rule.getRestrictedDomains()).toBeUndefined();
    });

    it('works if it correctly parses rule modifiers', () => {
        let rule = new CosmeticRule('[$path=page.html]###banner', 0);
        expect(rule.pathModifier?.pattern).toEqual('page.html');

        rule = new CosmeticRule(String.raw`[$path=/\[^a|b|c|\,|d|\\]\]werty\\?=qwe/,domain=example.com]###banner`, 0);
        expect(rule.pathModifier?.pattern).toEqual(String.raw`/[^a|b|c|,|d|\]]werty\?=qwe/`);

        rule = new CosmeticRule('[$path=/page*.html]example.com###banner', 0);
        expect(rule.pathModifier?.pattern).toEqual('/page*.html');

        rule = new CosmeticRule('[$path=qwerty,]example.com###banner', 0);
        expect(rule.pathModifier?.pattern).toEqual('qwerty');

        rule = new CosmeticRule('[$,path=qwerty]example.com###banner', 0);
        expect(rule.pathModifier?.pattern).toEqual('qwerty');

        rule = new CosmeticRule('[$path]###banner', 0);
        expect(rule.pathModifier?.pattern).toEqual('');

        rule = new CosmeticRule('example.com###banner', 0);
        expect(rule.pathModifier).toEqual(undefined);

        expect(() => {
            new CosmeticRule('[$path=page.html###banner', 0);
        }).toThrow(new SyntaxError('Can\'t parse modifiers list'));

        expect(() => {
            new CosmeticRule('[$domain,path=/page*.html]###banner', 0);
        }).toThrow(new SyntaxError('Modifier must have assigned value'));

        expect(() => {
            new CosmeticRule('[$]example.com###banner', 0);
        }).toThrow(new SyntaxError('Modifiers list can\'t be empty'));

        expect(() => {
            new CosmeticRule('[$test=example.com,path=/page*.html]###banner', 0);
        }).toThrow(new SyntaxError('\'test\' is not valid modifier'));

        expect(() => {
            new CosmeticRule('[$domain=example.com]example.org###banner', 0);
        }).toThrow(new SyntaxError('The $domain modifier is not allowed in a domain-specific rule'));
    });
});

describe('CosmeticRule match', () => {
    const createRequest = (url: string, sourceUrl?: string): Request => {
        const source = sourceUrl || url;
        return new Request(url, source, RequestType.Document);
    };

    it('works if it matches wide rules', () => {
        const rule = new CosmeticRule('##banner', 0);
        expect(rule.match(createRequest('example.org'))).toEqual(true);
    });

    it('works if it matches domain restrictions properly', () => {
        const rule = new CosmeticRule('example.org,~sub.example.org##banner', 0);
        expect(rule.match(createRequest('example.org'))).toEqual(true);
        expect(rule.match(createRequest('test.example.org'))).toEqual(true);
        expect(rule.match(createRequest('testexample.org'))).toEqual(false);
        expect(rule.match(createRequest('sub.example.org'))).toEqual(false);
        expect(rule.match(createRequest('sub.sub.example.org'))).toEqual(false);
    });

    it('works if it matches wildcard domain restrictions properly', () => {
        const rule = new CosmeticRule('example.*##body', 0);
        expect(rule.match(createRequest('example.org'))).toEqual(true);
        expect(rule.match(createRequest('example.de'))).toEqual(true);
        expect(rule.match(createRequest('example.co.uk'))).toEqual(true);
        expect(rule.match(createRequest('sub.example.org'))).toEqual(true);

        expect(rule.match(createRequest('testexample.org'))).toEqual(false);
        // non-existent tld
        expect(rule.match(createRequest('example.eu.uk'))).toEqual(false);
    });

    it('works if it matches wildcard domain restrictions properly - complicated', () => {
        const rule = new CosmeticRule('~yandex.*,google.*,youtube.*###ad-iframe', 0);
        expect(rule.match(createRequest('google.com'))).toEqual(true);
        expect(rule.match(createRequest('youtube.ru'))).toEqual(true);
        expect(rule.match(createRequest('youtube.co.id'))).toEqual(true);

        expect(rule.match(createRequest('yandex.com'))).toEqual(false);
        expect(rule.match(createRequest('www.yandex.ru'))).toEqual(false);
        expect(rule.match(createRequest('www.adguard.com'))).toEqual(false);
    });

    it('works if it matches wildcard rule', () => {
        const rule = new CosmeticRule('*##banner', 0);
        expect(rule.match(createRequest('example.org'))).toEqual(true);
        expect(rule.match(createRequest('test.com'))).toEqual(true);
    });

    it('works if it matches rule with path modifier pattern', () => {
        let rule = new CosmeticRule('[$path=page.html]##.textad', 0);

        expect(rule.match(createRequest('https://example.org/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/page.html?param=1'))).toEqual(true);
        expect(rule.match(createRequest('https://example.org/sub/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://example.org/sub/another_page.html'))).toEqual(true);

        expect(rule.match(createRequest('https://example.org'))).toEqual(false);
        expect(rule.match(createRequest('https://example.org/another.html'))).toEqual(false);

        rule = new CosmeticRule('[$path=/page.html]##.textad', 0);

        expect(rule.match(createRequest('https://example.org/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/page.html?param=1'))).toEqual(true);
        expect(rule.match(createRequest('https://example.org/sub/page.html'))).toEqual(true);

        expect(rule.match(createRequest('https://example.org/sub/another_page.html'))).toEqual(false);
    });

    it('works if it matches path modifier with \'|\' special character included in the rule', () => {
        let rule = new CosmeticRule('[$path=|/page.html]##.textad', 0);

        expect(rule.match(createRequest('https://example.org/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/page.html?param=1'))).toEqual(true);

        expect(rule.match(createRequest('https://example.org/sub/page.html'))).toEqual(false);

        rule = new CosmeticRule('[$path=/page|]##.textad', 0);

        expect(rule.match(createRequest('https://example.org/page'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/page'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/sub/page'))).toEqual(true);

        expect(rule.match(createRequest('https://another.org/page?param=1'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://example.org/page/sub'))).toEqual(false);
    });

    it('works if it matches path modifier with wildcard included in the rule, limited by domain pattern', () => {
        const rule = new CosmeticRule('[$path=/page*.html]example.com,~test.example.com##.textad', 0);

        expect(rule.match(createRequest('https://example.com/page1.html'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com/page2.html?param=1'))).toEqual(true);

        expect(rule.match(createRequest('https://test.example.com/page1.html'))).toEqual(false);
        expect(rule.match(createRequest('https://example.com/another-page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/page1.html'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/page2.html'))).toEqual(false);
    });

    it('works if it matches path modifier without a value correctly', () => {
        const rule = new CosmeticRule('[$domain=example.com,path]##.textad', 0);

        expect(rule.match(createRequest('https://example.com/'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com/page1.html'))).toEqual(false);
        expect(rule.match(createRequest('https://example.com/page2.html?param=1'))).toEqual(false);
    });

    it('works if it matches domain and path modifiers included in the rule', () => {
        const rule = new CosmeticRule('[$domain=example.com|~test.example.com,path=/page.html]##.textad', 0);

        expect(rule.match(createRequest('http://example.com/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com/page.html?param=1'))).toEqual(true);
        expect(rule.match(createRequest('https://example.com/sub/page.html'))).toEqual(true);

        expect(rule.match(createRequest('https://test.example.com/page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://example.com/another-page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/page.html'))).toEqual(false);
    });

    it('works when $domain in uppercase', () => {
        const rule = new CosmeticRule('[$domain=exAMPle.com]##.textad', 0);
        expect(rule.match(createRequest('http://example.com/'))).toEqual(true);
    });

    it('work if it matches path modifiers with regex included in the rule', () => {
        const testReString = String.raw`/\\/(sub1|sub2)\\/page\\.html/`;
        const rule = new CosmeticRule(`[$path=${testReString}]##.textad`, 0);

        expect(rule.match(createRequest('https://example.com/sub1/page.html'))).toEqual(true);
        expect(rule.match(createRequest('https://another.org/sub2/page.html'))).toEqual(true);

        expect(rule.match(createRequest('https://example.com/page.html'))).toEqual(false);
        expect(rule.match(createRequest('https://another.org/sub3/page.html'))).toEqual(false);
    });

    it('work if it matches urls with complex public suffixes', () => {
        const requestUrl = 'https://www.city.toyota.aichi.jp/';
        const rule1 = new CosmeticRule('aichi.jp###sad', 0);
        const rule2 = new CosmeticRule('toyota.aichi.jp###sad', 0);

        expect(rule1.match(createRequest(requestUrl))).toEqual(true);
        expect(rule2.match(createRequest(requestUrl))).toEqual(true);
    });
});

describe('CosmeticRule.CSS', () => {
    it('correctly detects Cosmetic.CSS allowlist and blacklist rules', () => {
        const rule = new CosmeticRule('example.org#$#.textad { visibility: hidden; }\n', 0);
        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Css);

        const allowlistRule = new CosmeticRule('example.org#@$#.textad { visibility: hidden; }', 0);
        expect(allowlistRule.isAllowlist()).toBeTruthy();
        expect(allowlistRule.getType()).toBe(CosmeticRuleType.Css);

        const extendedRule = new CosmeticRule('example.com#$?#h3:contains(cookies) { display: none!important; }', 0);
        expect(extendedRule.isAllowlist()).toBeFalsy();
        expect(extendedRule.getType()).toBe(CosmeticRuleType.Css);

        // eslint-disable-next-line max-len
        const extendedAllowlistRule = new CosmeticRule('example.com#@$?#h3:contains(cookies) { display: none!important; }', 0);
        expect(extendedAllowlistRule.isAllowlist()).toBeTruthy();
        expect(extendedAllowlistRule.getType()).toBe(CosmeticRuleType.Css);
    });

    it('accepts VALID pseudo classes', () => {
        // eslint-disable-next-line max-len
        let selector = '#main > table.w3-table-all.notranslate:first-child > tbody > tr:nth-child(17) > td.notranslate:nth-child(2)';
        let ruleText = `example.org##${selector}`;
        let cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '#:root div.ads';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '#body div[attr=\'test\']:first-child  div';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '#body div[attr=\'test\']:first-child';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class::after';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:matches-css(display: block)';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:matches-css-before(display: block)';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:matches-css-after(display: block)';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:has(.banner)';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:contains(test)';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:if(test)';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:if-not(test)';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = 'div > :where(h1, p)';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);
    });

    it('throws error on invalid pseudo class', () => {
        const pseudoClass = 'matches';
        const selector = `test:${pseudoClass}(.foo)`;
        expect(() => {
            new CosmeticRule(`example.org##${selector}`, 0);
        }).toThrow(new SyntaxError(`Unknown pseudo-class ':${pseudoClass}' in selector: '${selector}'`));
    });

    it('respects escaped colons when validates pseudo classes', () => {
        const selector = '#body div[attr=\'\\:matches(text)\']';
        const ruleText = `example.org##${selector}`;
        const cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);
    });

    it('doesnt searches pseudo classes inside attributes values', () => {
        const selector = 'a[src^="http://domain.com"]';
        const ruleText = `example.org##${selector}`;
        const cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);
    });

    it('does not fails pseudo classes search on bad selector', () => {
        const selector = 'a[src^="http:';
        const ruleText = `example.org##${selector}`;
        const cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);
    });

    it('throws error when cosmetic rule does not contain css style', () => {
        expect(() => {
            new CosmeticRule('example.org#$#div', 0);
        }).toThrow(new SyntaxError('Invalid CSS modifying rule, no style presented'));

        expect(() => {
            new CosmeticRule('example.org#$?#div', 0);
        }).toThrow(new SyntaxError('Invalid CSS modifying rule, no style presented'));
    });

    it('throws error when cosmetic rule contains url', () => {
        const checkRuleIsInvalid = (ruleText: string): void => {
            expect(() => {
                new CosmeticRule(ruleText, 0);
            }).toThrow(new SyntaxError('CSS modifying rule with \'url\' was omitted'));
        };

        checkRuleIsInvalid('example.com#$#body { background: url(http://example.org/empty.gif) }');
        checkRuleIsInvalid('example.org#$#body { background:url("http://example.org/image.png"); }');
    });

    it('throws error when cosmetic rule contains unsafe styles', () => {
        const checkRuleIsInvalid = (ruleText: string): void => {
            expect(() => {
                new CosmeticRule(ruleText, 0);
            }).toThrow(new SyntaxError('CSS modifying rule with unsafe style was omitted'));
        };

        checkRuleIsInvalid('*#$#* { background:image-set(\'https://hackvertor.co.uk/images/logo.gif\' 1x) }');
        checkRuleIsInvalid('*#$#* { background:image(\'https://hackvertor.co.uk/images/logo.gif\' 1x) }');
        checkRuleIsInvalid('*#$#* { background:cross-fade(\'https://hackvertor.co.uk/images/logo.gif\' 1x) }');
    });

    it('doesnt throw error if cosmetic rule contains url in selector', () => {
        const validRule = 'example.com#$#body[style*="background-image: url()"] { margin-top: 45px !important; }';
        const rule = new CosmeticRule(validRule, 0);
        expect(rule).toBeTruthy();
    });

    it('checks backslash in cosmetic rules content', () => {
        const backslashInElemhideRules = new CosmeticRule('example.org###Meebo\\:AdElement\\.Root', 0);
        expect(backslashInElemhideRules).toBeDefined();

        const backslashInCssRulesSelector = new CosmeticRule('example.org#$?#div:matches-css(width: /\\d+/) { background-color: red!important; }', 0);
        expect(backslashInCssRulesSelector).toBeDefined();

        const backslashInCssRulesSelector2 = new CosmeticRule('example.org#$?##p:has-text(/[\\w\\W]{337}/):has-text(/Dołącz \\./) { font-size: 0 !important; }', 0);
        expect(backslashInCssRulesSelector2).toBeDefined();

        const checkRuleIsInvalid = (ruleText: string): void => {
            expect(() => {
                new CosmeticRule(ruleText, 0);
            }).toThrow(new SyntaxError("CSS injection rule with '\\' was omitted"));
        };

        checkRuleIsInvalid('example.com#$#body { background: \\75 rl(http://example.org/empty.gif) }');
        checkRuleIsInvalid('example.org#$#body { background:\\x75rl("http://example.org/image.png"); }');
        checkRuleIsInvalid('example.org#$#body { background:u\\114\\0154("http://example.org/image.png"); }');
    });
});

describe('Extended css rule', () => {
    let ruleText = '~example.com,example.org##.sponsored[-ext-contains=test]';
    let rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored[-ext-contains=test]');

    ruleText = '~example.com,example.org##.sponsored[-ext-has=test]';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored[-ext-has=test]');

    // :has() pseudo-class has native implementation.
    // and since ExtendedCss v2 release
    // the rule with `##` marker and `:has()` should not be considered as ExtendedCss
    // https://github.com/AdguardTeam/ExtendedCss#extended-css-has
    ruleText = '~example.com,example.org##.sponsored:has(test)';
    rule = new CosmeticRule(ruleText, 0);

    // TODO: change later to 'toBeFalsy'
    // after ':has(' is removed from EXT_CSS_PSEUDO_INDICATORS
    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored:has(test)');

    // but :has() pseudo-class should be considered as ExtendedCss
    // if the rule marker is `#?#`
    ruleText = 'example.org#?#.sponsored:has(.banner)';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored:has(.banner)');

    // :is() pseudo-class has native implementation alike :has(),
    // so the rule with `##` marker and `:is()` should not be considered as ExtendedCss
    // https://github.com/AdguardTeam/ExtendedCss#extended-css-is
    ruleText = 'example.org##.banner:is(div, p)';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeFalsy();
    expect(rule.getContent()).toEqual('.banner:is(div, p)');

    // but :is() pseudo-class should be considered as ExtendedCss
    // if the rule marker is `#?#`
    ruleText = 'example.org#?#.banner:is(div, p)';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.banner:is(div, p)');

    // the same ExtendedCss marker enforcement should work for :not() as well
    // https://github.com/AdguardTeam/ExtendedCss#extended-css-not
    ruleText = 'example.org##.banner:not(.main, .content)';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeFalsy();
    expect(rule.getContent()).toEqual('.banner:not(.main, .content)');

    // but :not() pseudo-class should be considered as ExtendedCss
    // if the rule marker is `#?#`
    ruleText = 'example.org#?#.banner:not(.main, .content)';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.banner:not(.main, .content)');

    ruleText = '~example.com,example.org#?#div';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('div');

    ruleText = '~example.com,example.org#$?#div { background-color: #333!important; }';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('div { background-color: #333!important; }');

    it('does not confuses extended css rules with script rules', () => {
        // eslint-disable-next-line max-len
        ruleText = '#%#var AG_defineProperty=function(){return a={get:function(){var a=i.f;a&&a.beforeGet&&a.beforeGet.call(this,i.a.b);e:if(a=i.g)a=A(a)?a.value:a.get?a.get.call(this):void 0;else{if(a=i.a.b,i.i in a&&null!==(a=B(a))){var t=C.call(a,i.i);a=t?t.call(this):a[i.i];break e}a=void 0}return(this===i.a.b||D.call(i.a.b,this))&&E(e,a,i.c),a}},d&&J(d,a,K),a;var e,i,a}();';
        rule = new CosmeticRule(ruleText, 0);
        expect(rule.isExtendedCss()).toBeFalsy();
    });
});

describe('Javascript rules', () => {
    it('correctly parses js rules', () => {
        const jsContent = 'window.__gaq = undefined;';
        const ruleText = `example.org#%#${jsContent}`;
        const rule = new CosmeticRule(ruleText, 0);

        expect(rule).toBeTruthy();
        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Js);
        expect(rule.getContent()).toBe(jsContent);
        expect(rule.isScriptlet).toBeFalsy();

        const allowlistRuleText = `example.org#@%#${jsContent}`;
        const allowlistRule = new CosmeticRule(allowlistRuleText, 0);

        expect(allowlistRule).toBeTruthy();
        expect(allowlistRule.isAllowlist()).toBeTruthy();
        expect(allowlistRule.getType()).toBe(CosmeticRuleType.Js);
        expect(allowlistRule.getContent()).toBe(jsContent);
        expect(rule.isScriptlet).toBeFalsy();
    });

    it('correctly parses js scriptlets rules', () => {
        const jsContent = '//scriptlet("set-constant", "test", "true")';
        const ruleText = `example.org#%#${jsContent}`;
        const rule = new CosmeticRule(ruleText, 0);

        expect(rule).toBeTruthy();
        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Js);
        expect(rule.getContent()).toBe(jsContent);
        expect(rule.isScriptlet).toBeTruthy();

        const allowlistRuleText = `example.org#@%#${jsContent}`;
        const allowlistRule = new CosmeticRule(allowlistRuleText, 0);

        expect(allowlistRule).toBeTruthy();
        expect(allowlistRule.isAllowlist()).toBeTruthy();
        expect(allowlistRule.getType()).toBe(CosmeticRuleType.Js);
        expect(allowlistRule.getContent()).toBe(jsContent);
        expect(rule.isScriptlet).toBeTruthy();
    });

    it('returns script for js rule', () => {
        const jsRuleContent = 'console.log(\'test\')';
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = new CosmeticRule(jsRule, 0);

        expect(rule.getScript()).toBe(jsRuleContent);
    });

    it('returns script for scriptlet rule', () => {
        const jsRuleContent = "//scriptlet('log', 'arg')";
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = new CosmeticRule(jsRule, 0);
        const verbose = true;
        const domainName = 'example.com';

        const script = rule.getScript({ debug: verbose, request: new Request(`https://${domainName}`, null, RequestType.Document) })!;
        const params = parseParamsFromScript(script)!;
        expect(params.ruleText).toBe(jsRule);
        expect(params.domainName).toBe(domainName);
        expect(params.verbose).toBe(verbose);
    });

    it('rebuilds scriptlet script if debug changes', () => {
        const jsRuleContent = "//scriptlet('log', 'arg')";
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = new CosmeticRule(jsRule, 0);
        let verbose = true;

        jest.spyOn(rule, 'initScript');

        expect(rule.initScript).toBeCalledTimes(0);

        // after first get script call
        let script = rule.getScript({ debug: verbose })!;
        let params = parseParamsFromScript(script)!;
        expect(params.ruleText).toBe(jsRule);
        expect(params.verbose).toBe(verbose);
        expect(rule.initScript).toBeCalledTimes(1);

        // after second get script call
        script = rule.getScript({ debug: verbose })!;
        params = parseParamsFromScript(script)!;
        expect(params.ruleText).toBe(jsRule);
        expect(params.verbose).toBe(verbose);
        expect(rule.initScript).toBeCalledTimes(1);

        // after third get script call with other debug param
        verbose = false;
        script = rule.getScript({ debug: verbose })!;
        params = parseParamsFromScript(script)!;
        expect(params.ruleText).toBe(jsRule);
        expect(params.verbose).toBe(verbose);
        expect(rule.initScript).toBeCalledTimes(2);
    });

    it('rebuilds scriptlet script if domain name changes', () => {
        const jsRuleContent = "//scriptlet('log', 'arg')";
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = new CosmeticRule(jsRule, 0);
        const verbose = false;
        let domainName = 'example.com';

        jest.spyOn(rule, 'initScript');

        expect(rule.initScript).toBeCalledTimes(0);

        // after first get script call
        let script = rule.getScript({ debug: verbose, request: new Request(`https://${domainName}`, null, RequestType.Document) })!;
        let params = parseParamsFromScript(script)!;
        expect(params.domainName).toBe(domainName);
        expect(rule.initScript).toBeCalledTimes(1);

        // after second get script call
        script = rule.getScript({ debug: verbose, request: new Request(`https://${domainName}`, null, RequestType.Document) })!;
        params = parseParamsFromScript(script)!;
        expect(params.domainName).toBe(domainName);
        expect(rule.initScript).toBeCalledTimes(1);

        // after third get script call with other domain name
        domainName = 'example.org';
        script = rule.getScript({ debug: verbose, request: new Request(`https://${domainName}`, null, RequestType.Document) })!;
        params = parseParamsFromScript(script)!;
        expect(params.domainName).toBe(domainName);
        expect(rule.initScript).toBeCalledTimes(2);
    });

    it('returns scriptlet function and params for scriptlet', () => {
        const jsRuleContent = "//scriptlet('log', 'arg')";
        const jsRule = `example.org#%#${jsRuleContent}`;
        const rule = new CosmeticRule(jsRule, 0);

        const scriptletData = rule.getScriptletData()!;
        expect(typeof scriptletData.func).toBe('function');
        expect(scriptletData.func.name).toBe('log');
        expect(scriptletData.params).toMatchObject({
            ruleText: jsRule,
            name: 'log',
            args: ['arg'],
        });
    });
});

describe('HTML filtering rules (content rules)', () => {
    it('correctly parses html rules', () => {
        const contentPart = 'div[id="ad_text"]';
        const domainPart = 'example.org';
        const ruleText = `${domainPart}$$${contentPart}`;

        const rule = new CosmeticRule(ruleText, 0);

        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Html);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);

        const allowlistRuleText = `${domainPart}$@$${contentPart}`;
        const allowlistRule = new CosmeticRule(allowlistRuleText, 0);

        expect(allowlistRule.isAllowlist()).toBeTruthy();
        expect(allowlistRule.getType()).toBe(CosmeticRuleType.Html);
        expect(allowlistRule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);
    });

    it('correctly parses html rules - wildcards', () => {
        const contentPart = 'div[id="ad_text"][wildcard="*Test*[123]{123}*"]';
        const domainPart = 'example.org';
        const ruleText = `${domainPart}$$${contentPart}`;
        const rule = new CosmeticRule(ruleText, 0);

        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Html);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);
    });

    it('correctly parses html rules - complicated cases', () => {
        // eslint-disable-next-line max-len
        const contentPart = 'div[id="ad_text"][tag-content="teas""ernet"][max-length="500"][min-length="50"][wildcard="*.adriver.*"][parent-search-level="15"][parent-elements="td,table"]';
        const ruleText = `~nigma.ru,google.com$$${contentPart}`;
        const rule = new CosmeticRule(ruleText, 0);

        expect(rule.isAllowlist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Html);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe('google.com');
        expect(rule.getRestrictedDomains()).toHaveLength(1);
        expect(rule.getRestrictedDomains()![0]).toBe('nigma.ru');
    });
});
