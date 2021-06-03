/* eslint-disable max-len */
import { CosmeticRule, CosmeticRuleType } from '../../src/rules/cosmetic-rule';

describe('Element hiding rules constructor', () => {
    it('works if it creates element hiding rules', () => {
        const rule = new CosmeticRule('##.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getPermittedDomains()).toEqual(null);
        expect(rule.getRestrictedDomains()).toEqual(null);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('##.banner');
        expect(rule.getContent()).toEqual('.banner');
        expect(rule.isWhitelist()).toEqual(false);
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

    it('works if it creates whitelist element hiding rules', () => {
        const rule = new CosmeticRule('example.org#@#.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);

        const permittedDomains = rule.getPermittedDomains();
        expect(permittedDomains).not.toEqual(null);
        expect(permittedDomains![0]).toEqual('example.org');
        expect(rule.isWhitelist()).toEqual(true);
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
        expect(rule.isWhitelist()).toBeFalsy();

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = new CosmeticRule('*###banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getContent()).toEqual('#banner');
        expect(rule.isWhitelist()).toBeFalsy();

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = new CosmeticRule('*#@#.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getContent()).toEqual('.banner');
        expect(rule.isWhitelist()).toBeTruthy();

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = new CosmeticRule('*#$#.textad { visibility: hidden; }', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.Css);
        expect(rule.getContent()).toEqual('.textad { visibility: hidden; }');

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = new CosmeticRule('*#%#//scriptlet("set-constant", "test", "true")', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.Js);
        expect(rule.getContent()).toEqual('//scriptlet("set-constant", "test", "true")');

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();

        rule = new CosmeticRule('#$#.textad { visibility: hidden; }', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.Css);
        expect(rule.getContent()).toEqual('.textad { visibility: hidden; }');

        expect(rule.getPermittedDomains()).toBeNull();
        expect(rule.getRestrictedDomains()).toBeNull();
    });
});

describe('CosmeticRule match', () => {
    it('works if it matches wide rules', () => {
        const rule = new CosmeticRule('##banner', 0);
        expect(rule.match('example.org')).toEqual(true);
    });

    it('works if it matches domain restrictions properly', () => {
        const rule = new CosmeticRule('example.org,~sub.example.org##banner', 0);
        expect(rule.match('example.org')).toEqual(true);
        expect(rule.match('test.example.org')).toEqual(true);
        expect(rule.match('testexample.org')).toEqual(false);
        expect(rule.match('sub.example.org')).toEqual(false);
        expect(rule.match('sub.sub.example.org')).toEqual(false);
    });

    it('works if it matches wildcard domain restrictions properly', () => {
        const rule = new CosmeticRule('example.*##body', 0);
        expect(rule.match('example.org')).toEqual(true);
        expect(rule.match('example.de')).toEqual(true);
        expect(rule.match('example.co.uk')).toEqual(true);
        expect(rule.match('sub.example.org')).toEqual(true);

        expect(rule.match('testexample.org')).toEqual(false);
        // non-existent tld
        expect(rule.match('example.eu.uk')).toEqual(false);
    });

    it('works if it matches wildcard domain restrictions properly - complicated', () => {
        const rule = new CosmeticRule('~yandex.*,google.*,youtube.*###ad-iframe', 0);
        expect(rule.match('google.com')).toEqual(true);
        expect(rule.match('youtube.ru')).toEqual(true);
        expect(rule.match('youtube.co.id')).toEqual(true);

        expect(rule.match('yandex.com')).toEqual(false);
        expect(rule.match('www.yandex.ru')).toEqual(false);
        expect(rule.match('www.adguard.com')).toEqual(false);
    });

    it('works if it matches wildcard rule', () => {
        const rule = new CosmeticRule('*##banner', 0);
        expect(rule.match('example.org')).toEqual(true);
        expect(rule.match('test.com')).toEqual(true);
    });
});

describe('CosmeticRule.CSS', () => {
    it('correctly detects Cosmetic.CSS whitelist and blacklist rules', () => {
        const rule = new CosmeticRule('example.org#$#.textad { visibility: hidden; }\n', 0);
        expect(rule.isWhitelist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Css);

        const whitelistRule = new CosmeticRule('example.org#@$#.textad { visibility: hidden; }', 0);
        expect(whitelistRule.isWhitelist()).toBeTruthy();
        expect(whitelistRule.getType()).toBe(CosmeticRuleType.Css);

        const extendedRule = new CosmeticRule('example.com#$?#h3:contains(cookies) { display: none!important; }', 0);
        expect(extendedRule.isWhitelist()).toBeFalsy();
        expect(extendedRule.getType()).toBe(CosmeticRuleType.Css);

        // eslint-disable-next-line max-len
        const extendedWhitelistRule = new CosmeticRule('example.com#@$?#h3:contains(cookies) { display: none!important; }', 0);
        expect(extendedWhitelistRule.isWhitelist()).toBeTruthy();
        expect(extendedWhitelistRule.getType()).toBe(CosmeticRuleType.Css);
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
    });

    it('throws error on invalid pseudo class', () => {
        const selector = 'test:matches(.foo)';
        expect(() => {
            new CosmeticRule(`example.org##${selector}`, 0);
        }).toThrow(new SyntaxError(`Unknown pseudo class: ${selector}`));
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

    ruleText = '~example.com,example.org##.sponsored:has(test)';
    rule = new CosmeticRule(ruleText, 0);

    expect(rule.isExtendedCss()).toBeTruthy();
    expect(rule.getContent()).toEqual('.sponsored:has(test)');

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
        expect(rule.isWhitelist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Js);
        expect(rule.getContent()).toBe(jsContent);

        const whiteRuleText = `example.org#@%#${jsContent}`;
        const whiteRule = new CosmeticRule(whiteRuleText, 0);

        expect(whiteRule).toBeTruthy();
        expect(whiteRule.isWhitelist()).toBeTruthy();
        expect(whiteRule.getType()).toBe(CosmeticRuleType.Js);
        expect(whiteRule.getContent()).toBe(jsContent);
    });

    it('correctly parses js scriptlets rules', () => {
        const jsContent = '//scriptlet("set-constant", "test", "true")';
        const ruleText = `example.org#%#${jsContent}`;
        const rule = new CosmeticRule(ruleText, 0);

        expect(rule).toBeTruthy();
        expect(rule.isWhitelist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Js);
        expect(rule.getContent()).toBe(jsContent);

        const whiteRuleText = `example.org#@%#${jsContent}`;
        const whiteRule = new CosmeticRule(whiteRuleText, 0);

        expect(whiteRule).toBeTruthy();
        expect(whiteRule.isWhitelist()).toBeTruthy();
        expect(whiteRule.getType()).toBe(CosmeticRuleType.Js);
        expect(whiteRule.getContent()).toBe(jsContent);
    });
});

describe('HTML filtering rules (content rules)', () => {
    it('correctly parses html rules', () => {
        const contentPart = 'div[id="ad_text"]';
        const domainPart = 'example.org';
        const ruleText = `${domainPart}$$${contentPart}`;

        const rule = new CosmeticRule(ruleText, 0);

        expect(rule.isWhitelist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Html);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);

        const whiteRuleText = `${domainPart}$@$${contentPart}`;
        const whiteRule = new CosmeticRule(whiteRuleText, 0);

        expect(whiteRule.isWhitelist()).toBeTruthy();
        expect(whiteRule.getType()).toBe(CosmeticRuleType.Html);
        expect(whiteRule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe(domainPart);
    });

    it('correctly parses html rules - wildcards', () => {
        const contentPart = 'div[id="ad_text"][wildcard="*Test*[123]{123}*"]';
        const domainPart = 'example.org';
        const ruleText = `${domainPart}$$${contentPart}`;
        const rule = new CosmeticRule(ruleText, 0);

        expect(rule.isWhitelist()).toBeFalsy();
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

        expect(rule.isWhitelist()).toBeFalsy();
        expect(rule.getType()).toBe(CosmeticRuleType.Html);
        expect(rule.getContent()).toBe(contentPart);
        expect(rule.getPermittedDomains()).toHaveLength(1);
        expect(rule.getPermittedDomains()![0]).toBe('google.com');
        expect(rule.getRestrictedDomains()).toHaveLength(1);
        expect(rule.getRestrictedDomains()![0]).toBe('nigma.ru');
    });
});
