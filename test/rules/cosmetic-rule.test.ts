import { CosmeticRuleType, CosmeticRule } from '../../src/rules/cosmetic-rule';

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
        }).toThrowError(/This is not a cosmetic rule/);

        expect(() => {
            new CosmeticRule('example.org## ', 0);
        }).toThrowError(/Empty rule content/);
    });

    it('throws error if marker is not supported yet', () => {
        expect(() => {
            new CosmeticRule('example.org$@@$script[data-src="banner"]', 0);
        }).toThrow(new SyntaxError('This is not a cosmetic rule'));
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
        const ruleText = `example.org##${selector}`;
        expect(() => {
            new CosmeticRule(ruleText, 0);
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
        let cssRule = 'example.org#$#div';
        expect(() => {
            new CosmeticRule(cssRule, 0);
        }).toThrow(new SyntaxError(`Invalid CSS modifying rule, no style presented: ${cssRule}`));

        cssRule = 'example.org#$?#div';
        expect(() => {
            new CosmeticRule(cssRule, 0);
        }).toThrow(new SyntaxError(`Invalid CSS modifying rule, no style presented: ${cssRule}`));
    });

    it('throws error when cosmetic rule contains url', () => {
        const ruleText = 'example.com#$#body { background: url(http://example.org/empty.gif) }';
        expect(() => {
            new CosmeticRule(ruleText, 0);
        }).toThrow(new SyntaxError(`CSS modifying rule with 'url' was omitted: ${ruleText}`));
    });

    // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1444
    it('throws error when cosmetic rule contains backslash', () => {
        const invalidRuleText = 'example.com#$#body { background: \\75 rl(http://example.org/empty.gif) }';
        const validRuleText = 'example.com#$#body { background: black; }';
        expect(() => {
            new CosmeticRule(invalidRuleText, 0);
        }).toThrow(new SyntaxError(`CSS injection rule with '\\' was omitted: ${invalidRuleText}`));

        const validRule = new CosmeticRule(validRuleText, 0);
        expect(validRule).toBeDefined();
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
