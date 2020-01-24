import { CosmeticRuleType, CosmeticRule } from '../src/cosmetic-rule';

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

        expect(() => {
            new CosmeticRule('#@#.banner', 0);
        }).toThrowError(/Whitelist rule must have at least one domain specified/);
    });

    it('throws error if css marker is not supported yet', () => {
        expect(() => {
            new CosmeticRule('example.org#%#window.__gaq = undefined;', 0);
        }).toThrow(new SyntaxError('Unsupported rule type'));
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
        expect(rule.getType()).toBe(CosmeticRuleType.CSS);

        const whitelistRule = new CosmeticRule('example.org#@$#.textad { visibility: hidden; }', 0);
        expect(whitelistRule.isWhitelist()).toBeTruthy();
        expect(whitelistRule.getType()).toBe(CosmeticRuleType.CSS);

        const extendedRule = new CosmeticRule('example.com#$?#h3:contains(cookies) { display: none!important; }', 0);
        expect(extendedRule.isWhitelist()).toBeFalsy();
        expect(extendedRule.getType()).toBe(CosmeticRuleType.CSS);

        // eslint-disable-next-line max-len
        const extendedWhitelistRule = new CosmeticRule('example.com#@$?#h3:contains(cookies) { display: none!important; }', 0);
        expect(extendedWhitelistRule.isWhitelist()).toBeTruthy();
        expect(extendedWhitelistRule.getType()).toBe(CosmeticRuleType.CSS);
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

        selector = '.some-class:properties(background-color: rgb(0, 0, 0))';
        ruleText = `example.org##${selector}`;
        cssRule = new CosmeticRule(ruleText, 0);
        expect(cssRule).toBeDefined();
        expect(cssRule.getContent()).toBe(selector);

        selector = '.some-class:-abp-properties(background-color: rgb(0, 0, 0))';
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
