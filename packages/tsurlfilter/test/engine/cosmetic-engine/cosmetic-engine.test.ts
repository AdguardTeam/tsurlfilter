import { CosmeticEngine } from '../../../src/engine/cosmetic-engine/cosmetic-engine';
import { RuleStorage } from '../../../src/filterlist/rule-storage';
import { StringRuleList } from '../../../src/filterlist/rule-list';
import { CosmeticOption, Request, RequestType } from '../../../src';

const createTestRuleStorage = (listId: number, rules: string[]): RuleStorage => {
    const list = new StringRuleList(listId, rules.join('\n'), false);
    return new RuleStorage([list]);
};

const createRequest = (url: string) => new Request(url, null, RequestType.Document);

describe('Test cosmetic engine', () => {
    const specificRuleContent = 'banner_specific';
    const specificRule = `example.org##${specificRuleContent}`;

    const genericRuleContent = 'banner_generic';
    const genericRule = `##${genericRuleContent}`;

    const genericDisabledRuleContent = 'banner_generic_disabled';
    const genericDisabledRule = `##${genericDisabledRuleContent}`;
    const specificDisablingRule = `example.org#@#${genericDisabledRuleContent}`;

    const rules = [
        specificRule,
        specificDisablingRule,
        genericRule,
        genericDisabledRule,
    ];

    it('finds simple hiding rules (not extended css rules)', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificRule,
            specificDisablingRule,
            genericRule,
            genericDisabledRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);
    });

    it('finds specific rule and not allowlisted generic rule', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic).toHaveLength(1);
        expect(result.elementHiding.generic[0].getContent()).toContain(genericRuleContent);
        expect(result.elementHiding.generic[0].getContent()).not.toContain(genericDisabledRuleContent);
        expect(result.elementHiding.specific).toHaveLength(1);
        expect(result.elementHiding.specific[0].getContent()).toContain(specificRuleContent);
    });

    it('finds generic rules for domain without specific rules', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match(createRequest('example.com'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic).toHaveLength(2);
        expect(result.elementHiding.generic[0].getContent()).toContain(genericRuleContent);
        expect(result.elementHiding.generic[1].getContent()).toContain(genericDisabledRuleContent);
        expect(result.elementHiding.specific).toHaveLength(0);
    });

    it('excludes generic css rules if necessary', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match(
            createRequest('example.org'),
            CosmeticOption.CosmeticOptionSpecificCSS,
        );

        expect(result.elementHiding.generic).toHaveLength(0);
        expect(result.elementHiding.specific).toHaveLength(1);
    });

    it('excludes all css rules if necessary, even if generic argument is true', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionGenericCSS);
        expect(result).toBeDefined();

        expect(result.elementHiding.specific.length).toBe(0);
        expect(result.elementHiding.generic[0].getText()).toBe(genericRule);
    });

    it('excludes rules with generic allowlist rule', () => {
        const elemhideRule = 'example.org##body';
        const allowlistGenericRule = '#@#body';
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            elemhideRule,
            allowlistGenericRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.elementHiding.generic).toHaveLength(0);
        expect(result.elementHiding.specific).toHaveLength(0);
    });

    it('correctly detects extended css rules', () => {
        const extCssSpecificRuleText = '.ext_css_specific[-ext-contains=test]';
        const extCssSpecificRule = `example.org##${extCssSpecificRuleText}`;
        const extCssGenericRuleText = '.ext_css_generic[-ext-contains=test]';
        const extCssGenericRule = `##${extCssGenericRuleText}`;
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificRule,
            genericRule,
            extCssGenericRule,
            extCssSpecificRule,
        ]));
        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.elementHiding.genericExtCss).toHaveLength(1);
        expect(result.elementHiding.genericExtCss[0].getContent()).toContain(extCssGenericRuleText);
        expect(result.elementHiding.specificExtCss).toHaveLength(1);
        expect(result.elementHiding.specificExtCss[0].getContent()).toContain(extCssSpecificRuleText);
    });

    it('correctly detects cosmetic css rules', () => {
        const cssRuleText = '.cosmetic { visibility: hidden; }';
        const specificCssRule = `example.org#$#${cssRuleText}`;
        const genericCssRule = `#$#${cssRuleText}`;
        const extCssCssRuleText = ':has(.ext-css-cosmetic) { visibility: hidden; }';
        const extCssSpecificCssRule = `example.org#$#${extCssCssRuleText}`;
        const extCssGenericCssRule = `#$#${extCssCssRuleText}`;

        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificCssRule,
            genericCssRule,
            extCssSpecificCssRule,
            extCssGenericCssRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.CSS.specific).toHaveLength(1);
        expect(result.CSS.specific[0].getContent()).toContain(cssRuleText);
        expect(result.CSS.generic).toHaveLength(1);
        expect(result.CSS.generic[0].getContent()).toContain(cssRuleText);
        expect(result.CSS.specificExtCss).toHaveLength(1);
        expect(result.CSS.specificExtCss[0].getContent()).toContain(extCssCssRuleText);
        expect(result.CSS.genericExtCss).toHaveLength(1);
        expect(result.CSS.genericExtCss[0].getContent()).toContain(extCssCssRuleText);
    });

    it('checks css styles in cosmetic rules', () => {
        const ruleText = 'example.org##body { background: red!important; }';
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            ruleText,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.elementHiding.generic).toHaveLength(0);
        expect(result.elementHiding.specific).toHaveLength(0);
        expect(result.CSS.generic).toHaveLength(0);
        expect(result.CSS.specific).toHaveLength(0);
    });

    it('finds wildcard hiding rules', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            `example.*##${specificRuleContent}`,
            specificDisablingRule,
            genericRule,
            genericDisabledRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);

        const negativeResult = cosmeticEngine.match(createRequest('test.org'), CosmeticOption.CosmeticOptionAll);
        expect(negativeResult).toBeDefined();

        expect(negativeResult.elementHiding.generic.length).toEqual(2);
        expect(negativeResult.elementHiding.specific.length).toEqual(0);
    });

    it('finds wildcard domain rules', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            `*##${genericRuleContent}`,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(0);
    });

    it('removes duplicates in result domain rules', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            `base.com, a.base.com, b.base.com##${specificRuleContent}`,
        ]));

        const result = cosmeticEngine.match(createRequest('base.com'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(0);
        expect(result.elementHiding.specific.length).toEqual(1);
    });

    it('finds empty domain rules', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            `##${genericRuleContent}`,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(0);
    });

    it('tests path modifier rules', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            '[$path=/subpage1]example.org$$div[id="case1"]',
            '[$path=/subpage2]example.org$$div[id="case2"]',
            '[$path=/sub.*/]example.org$$div[id="case3"]',
            '[$path=/subpage(?!1)/]example.org$$div[id="case4"]',
        ]));

        let result = cosmeticEngine.match(createRequest('http://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific.length).toEqual(0);

        result = cosmeticEngine.match(createRequest('http://example.org/subpage1'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific.length).toEqual(2);

        result = cosmeticEngine.match(createRequest('http://example.org/subpage2'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific.length).toEqual(3);

        result = cosmeticEngine.match(createRequest('http://example.org/subpage3'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific.length).toEqual(2);

        result = cosmeticEngine.match(createRequest('http://example.org/another'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific.length).toEqual(0);
    });
});

describe('Test cosmetic engine - JS rules', () => {
    it('correctly detects cosmetic JS rules', () => {
        const jsRuleText = 'window.__gaq = undefined;';
        const specificJsRule = `example.org#%#${jsRuleText}`;
        const genericJsRule = `#%#${jsRuleText}`;

        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificJsRule,
            genericJsRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.specific).toHaveLength(1);
        expect(result.JS.specific[0].getContent()).toContain(jsRuleText);
        expect(result.JS.generic).toHaveLength(1);
        expect(result.JS.generic[0].getContent()).toContain(jsRuleText);

        const scriptRules = result.getScriptRules();
        expect(scriptRules).toHaveLength(2);

        expect(scriptRules[0].getScript()).toBe(jsRuleText);
        expect(scriptRules[0].getScript({ debug: true })).toBe(jsRuleText);
    });

    it('checks cosmetic JS exceptions', () => {
        const jsRule = 'testcases.adguard.com,surge.sh#%#window.__testCase2 = true;';
        const jsExceptionRule = 'testcases.adguard.com,surge.sh#@%#window.__testCase2 = true;';
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            jsRule,
            jsExceptionRule,
        ]));
        const result = cosmeticEngine.match(createRequest('testcases.adguard.com'), CosmeticOption.CosmeticOptionAll);
        expect(result.JS.specific.length).toBe(0);
        expect(result.JS.generic.length).toBe(0);
    });

    it('correctly detects scriptlet rules', () => {
        const ruleContent = "//scriptlet('abort-on-property-read', 'I10C')";
        const specificJsRule = `example.org#%#${ruleContent}`;
        const genericJsRule = `#%#${ruleContent}`;

        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificJsRule,
            genericJsRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.specific.length).toBe(1);
        expect(result.JS.generic.length).toBe(1);
        expect(result.JS.specific[0].getContent()).toContain(ruleContent);
        expect(result.JS.generic[0].getContent()).toContain(ruleContent);
    });

    it('returns function and params for scriptlets', () => {
        const ruleContent = "//scriptlet('log')";
        const genericScriptletRule = `#%#${ruleContent}`;
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            genericScriptletRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        const scriptletData = result.JS.generic[0].getScriptletData()!;
        expect(scriptletData.params).toMatchObject({
            args: [],
            engine: '',
            name: 'log',
            ruleText: genericScriptletRule,
            verbose: false,
            version: '',
        });
        expect(typeof scriptletData.func).toBe('function');
        expect(scriptletData.func.name).toBe('log');
    });

    it('checks scriptlet exceptions', () => {
        const ruleContent = "//scriptlet('abort-on-property-read', 'I10C')";
        const jsRule = `testcases.adguard.com,surge.sh#%#${ruleContent}`;
        const jsExceptionRule = `testcases.adguard.com,surge.sh#@%#${ruleContent}`;
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            jsRule,
            jsExceptionRule,
        ]));

        const result = cosmeticEngine.match(createRequest('testcases.adguard.com'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.specific.length).toBe(0);
        expect(result.JS.generic.length).toBe(0);
    });
});

describe('Test cosmetic engine - HTML filtering rules', () => {
    it('correctly detects HTML rules', () => {
        const contentPart = 'div[id="ad_text"]';
        const specificRule = `example.org$$${contentPart}`;
        const genericRule = `$$${contentPart}`;

        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificRule,
            genericRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.Html.specific).toHaveLength(1);
        expect(result.Html.specific[0].getContent()).toContain(contentPart);
        expect(result.Html.generic).toHaveLength(1);
        expect(result.Html.generic[0].getContent()).toContain(contentPart);
    });

    it('correctly detects HTML rules - domain specific', () => {
        const contentPart = 'div[id="ad_text"]';
        const specificRule = `example.org$$${contentPart}`;
        const genericRule = `$$${contentPart}`;

        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificRule,
            genericRule,
        ]));

        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionHtml);

        expect(result.Html.specific).toHaveLength(1);
        expect(result.Html.specific[0].getContent()).toContain(contentPart);
        expect(result.Html.generic).toHaveLength(0);
    });

    it('checks cosmetic HTML exceptions', () => {
        const rule = 'example.org$$div[id="ad_text"]';
        const exceptionRule = 'example.org$@$div[id="ad_text"]';
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            rule,
            exceptionRule,
        ]));
        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific).toHaveLength(0);
        expect(result.Html.generic).toHaveLength(0);
    });

    it('checks cosmetic HTML content exceptions', () => {
        const rule = 'example.org$$div[id="ad_text_1"]';
        const exceptionRule = 'example.org$@$div[id="ad_text_2"]';
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            rule,
            exceptionRule,
        ]));
        const result = cosmeticEngine.match(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific).toHaveLength(1);
        expect(result.Html.generic).toHaveLength(0);
    });
});
