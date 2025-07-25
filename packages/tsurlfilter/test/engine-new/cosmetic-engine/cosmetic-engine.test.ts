import { describe, it, expect } from 'vitest';

import escapeStringRegexp from 'escape-string-regexp';

import { CosmeticEngine } from '../../../src/engine-new/cosmetic-engine/cosmetic-engine';
import { CosmeticOption } from '../../../src/engine-new/cosmetic-option';
import { Request } from '../../../src/request';
import { RequestType } from '../../../src/request-type';
import { RuleStorage } from '../../../src/filterlist/rule-storage-new';
import { StringRuleList } from '../../../src/filterlist/string-rule-list';

/**
 * Helper function to get the rule index from the raw filter list by the rule text.
 *
 * @param rawFilterList Raw filter list.
 * @param rule Rule text.
 *
 * @returns Rule index or -1 if the rule could not be found.
 */
const getRawRuleIndex = (rawFilterList: string, rule: string): number => {
    return rawFilterList.search(new RegExp(`^${escapeStringRegexp(rule)}$`, 'm'));
};

/**
 * Helper function to create a request.
 *
 * @param url URL.
 *
 * @returns Request.
 */
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

    const rawFilter = rules.join('\n');
    const filter = new StringRuleList(1, rawFilter);

    it('finds simple hiding rules (not extended css rules)', () => {
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([filter]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);
    });

    it('finds specific rule and not allowlisted generic rule', () => {
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([filter]));
        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic).toHaveLength(1);
        expect(result.elementHiding.generic[0].getContent()).toContain(genericRuleContent);
        expect(result.elementHiding.generic[0].getContent()).not.toContain(genericDisabledRuleContent);
        expect(result.elementHiding.specific).toHaveLength(1);
        expect(result.elementHiding.specific[0].getContent()).toContain(specificRuleContent);
    });

    it('finds generic rules for domain without specific rules', () => {
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([filter]));
        const result = cosmeticEngine.match(createRequest('https://example.com'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic).toHaveLength(2);
        expect(result.elementHiding.generic[0].getContent()).toContain(genericRuleContent);
        expect(result.elementHiding.generic[1].getContent()).toContain(genericDisabledRuleContent);
        expect(result.elementHiding.specific).toHaveLength(0);
    });

    it('excludes generic css rules if necessary', () => {
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([filter]));
        const result = cosmeticEngine.match(
            createRequest('https://example.org'),
            CosmeticOption.CosmeticOptionSpecificCSS,
        );

        expect(result.elementHiding.generic).toHaveLength(0);
        expect(result.elementHiding.specific).toHaveLength(1);
    });

    it('excludes all css rules if necessary, even if generic argument is true', () => {
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([filter]));
        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionGenericCSS);
        expect(result).toBeDefined();

        expect(result.elementHiding.specific.length).toBe(0);
        expect(
            result.elementHiding.generic[0].getIndex(),
        ).toBe(
            getRawRuleIndex(rawFilter, genericRule),
        );
    });

    it('excludes rules with generic allowlist rule', () => {
        const elemhideRule = 'example.org##body';
        const allowlistGenericRule = '#@#body';
        const rulesLocal = [
            elemhideRule,
            allowlistGenericRule,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.elementHiding.generic).toHaveLength(0);
        expect(result.elementHiding.specific).toHaveLength(0);
    });

    it('correctly detects extended css rules', () => {
        const extCssSpecificRuleText = '.ext_css_specific:contains(es)';
        const extCssSpecificRule = `example.org##${extCssSpecificRuleText}`;
        const extCssGenericRuleText = '.ext_css_generic:contains(es)';
        const extCssGenericRule = `##${extCssGenericRuleText}`;
        const rulesLocal = [
            specificRule,
            genericRule,
            extCssGenericRule,
            extCssSpecificRule,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));
        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.elementHiding.genericExtCss).toHaveLength(1);
        expect(result.elementHiding.genericExtCss[0].getContent()).toContain(extCssGenericRuleText);
        expect(result.elementHiding.specificExtCss).toHaveLength(1);
        expect(result.elementHiding.specificExtCss[0].getContent()).toContain(extCssSpecificRuleText);
    });

    it('correctly detects cosmetic css rules', () => {
        const cssRuleText = '.cosmetic { visibility: hidden; }';
        const specificCssRule = `example.org#$#${cssRuleText}`;
        const genericCssRule = `#$#${cssRuleText}`;
        const extCssCssRuleText = ':upward(.ext-css-cosmetic) { visibility: hidden; }';
        const extCssSpecificCssRule = `example.org#$#${extCssCssRuleText}`;
        const extCssGenericCssRule = `#$#${extCssCssRuleText}`;
        const rulesLocal = [
            specificCssRule,
            genericCssRule,
            extCssSpecificCssRule,
            extCssGenericCssRule,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.CSS.specific).toHaveLength(1);
        expect(result.CSS.specific[0].getContent()).toContain(cssRuleText);
        expect(result.CSS.generic).toHaveLength(1);
        expect(result.CSS.generic[0].getContent()).toContain(cssRuleText);
        expect(result.CSS.specificExtCss).toHaveLength(1);
        expect(result.CSS.specificExtCss[0].getContent()).toContain(extCssCssRuleText);
        expect(result.CSS.genericExtCss).toHaveLength(1);
        expect(result.CSS.genericExtCss[0].getContent()).toContain(extCssCssRuleText);
    });

    it('finds wildcard hiding rules', () => {
        const rulesLocal = [
            `example.*##${specificRuleContent}`,
            specificDisablingRule,
            genericRule,
            genericDisabledRule,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);

        const negativeResult = cosmeticEngine.match(createRequest('https://test.org'), CosmeticOption.CosmeticOptionAll);
        expect(negativeResult).toBeDefined();

        expect(negativeResult.elementHiding.generic.length).toEqual(2);
        expect(negativeResult.elementHiding.specific.length).toEqual(0);
    });

    it('finds wildcard domain rules', () => {
        const rulesLocal = [
            `*##${genericRuleContent}`,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(0);
    });

    it('removes duplicates in result domain rules', () => {
        const rulesLocal = [
            `base.com, a.base.com, b.base.com##${specificRuleContent}`,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://base.com'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(0);
        expect(result.elementHiding.specific.length).toEqual(1);
    });

    it('finds empty domain rules', () => {
        const rulesLocal = [
            `##${genericRuleContent}`,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(0);
    });

    it('tests path modifier rules', () => {
        const rulesLocal = [
            '[$path=/subpage1]example.org$$div[id="case1"]',
            '[$path=/subpage2]example.org$$div[id="case2"]',
            '[$path=/sub.*/]example.org$$div[id="case3"]',
            '[$path=/subpage(?!1)/]example.org$$div[id="case4"]',
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

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
        const rulesLocal = [
            specificJsRule,
            genericJsRule,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);

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
        const rulesLocal = [
            jsRule,
            jsExceptionRule,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));
        const result = cosmeticEngine.match(createRequest('https://testcases.adguard.com'), CosmeticOption.CosmeticOptionAll);
        expect(result.JS.specific.length).toBe(0);
        expect(result.JS.generic.length).toBe(0);
    });

    it('correctly detects scriptlet rules', () => {
        const ruleContent = "//scriptlet('abort-on-property-read', 'I10C')";
        const specificJsRule = `example.org#%#${ruleContent}`;
        const genericJsRule = `#%#${ruleContent}`;
        const rulesLocal = [
            specificJsRule,
            genericJsRule,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.specific.length).toBe(1);
        expect(result.JS.generic.length).toBe(1);
        expect(result.JS.specific[0].getContent()).toContain(ruleContent);
        expect(result.JS.generic[0].getContent()).toContain(ruleContent);
    });

    it('returns function and params for scriptlets', () => {
        const ruleContent = "//scriptlet('log')";
        const genericScriptletRule = `#%#${ruleContent}`;
        const rulesLocal = [
            genericScriptletRule,
        ];
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        const scriptletData = result.JS.generic[0].getScriptletData()!;
        expect(scriptletData.params).toMatchObject({
            args: [],
            engine: '',
            name: 'log',
            verbose: false,
            version: '',
        });
        expect(typeof scriptletData.func).toBe('function');
        expect(scriptletData.func.name).toBe('log');
    });

    describe('scriptlets exceptions', () => {
        it('checks scriptlet exceptions', () => {
            const ruleContent = "//scriptlet('abort-on-property-read', 'I10C')";
            const jsRule = `testcases.adguard.com,surge.sh#%#${ruleContent}`;
            const jsExceptionRule = `testcases.adguard.com,surge.sh#@%#${ruleContent}`;
            const rulesLocal = [
                jsRule,
                jsExceptionRule,
            ];
            const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

            const result = cosmeticEngine.match(
                createRequest('https://testcases.adguard.com'),
                CosmeticOption.CosmeticOptionAll,
            );

            expect(result.JS.specific.length).toBe(0);
            expect(result.JS.generic.length).toBe(0);
        });

        it('does not allowlist if params are different', () => {
            const content = '//scriptlet("set-constant", "firstVal", "false")';
            const jsRule = `testcases.agrd.dev,pages.dev#%#${content}`;
            const jsExceptionRule = 'testcases.agrd.dev,pages.dev#@%#//scriptlet("set-constant", "firstVal", "true")';
            const rules = [jsRule, jsExceptionRule];
            const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rules.join('\n'))]));

            const result = cosmeticEngine.match(
                createRequest('https://testcases.agrd.dev'),
                CosmeticOption.CosmeticOptionAll,
            );

            expect(result.JS.specific.length).toBe(1);
            expect(result.JS.specific[0].getContent()).toBe(content);
            expect(result.JS.generic.length).toBe(0);
        });

        it('checks scriptlet exception even if content has different quotes', () => {
            const domains = 'testcases.adguard.com,surge.sh';
            const singleQuote1 = String.raw`//scriptlet('abort-on-property-read', 'I10\'C')`;
            const doubleQuote1 = String.raw`//scriptlet("abort-on-property-read", "I10'C")`;
            const singleQuote2 = String.raw`//scriptlet('set-cookie', 'I10\'C')`;
            const doubleQuote2 = String.raw`//scriptlet("set-cookie", "I10'C")`;

            const rulesLocal = [
                // single quote rule
                `${domains}#%#${singleQuote1}`,
                // double quote exception
                `${domains}#@%#${doubleQuote1}`,
                // double quote rule
                `${domains}#%#${doubleQuote2}`,
                // single quote exception
                `${domains}#@%#${singleQuote2}`,
            ];
            const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

            const result = cosmeticEngine.match(
                createRequest('https://testcases.adguard.com'),
                CosmeticOption.CosmeticOptionAll,
            );

            expect(result.JS.specific.length).toBe(0);
            expect(result.JS.generic.length).toBe(0);
        });

        it('generic #@%#//scriptlet() disables all scriptlet rules', () => {
            const allowlistScriptletRule = '#@%#//scriptlet()';
            const specificScriptletRule = "example.org#%#//scriptlet('set-cookie', 'adcook2', '2')";
            const genericScriptletRule = "#%#//scriptlet('set-local-storage-item', 'aditem1', '1')";
            const rulesLocal = [
                allowlistScriptletRule,
                specificScriptletRule,
                genericScriptletRule,
            ];
            const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rulesLocal.join('\n'))]));

            const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);

            expect(result.JS.specific.length).toBe(0);
            expect(result.JS.generic.length).toBe(0);
        });

        it('specific #@%#//scriptlet() disables all scriptlet rules only matching request', () => {
            const allowlistScriptletRule = 'example.org#@%#//scriptlet()';
            const specificScriptletRule = "example.org#%#//scriptlet('set-cookie', 'adcook2', '2')";
            const specificScriptletRule2 = "example.com#%#//scriptlet('set-cookie', 'adcook2', '2')";
            const genericScriptletRule = "#%#//scriptlet('set-local-storage-item', 'aditem1', '1')";
            const rulesLocal = [
                allowlistScriptletRule,
                specificScriptletRule,
                genericScriptletRule,
                specificScriptletRule2,
            ];
            const rawFilterListLocal = rulesLocal.join('\n');
            const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rawFilterListLocal)]));

            const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
            expect(result.JS.specific.length).toBe(0);
            expect(result.JS.generic.length).toBe(0);

            const result2 = cosmeticEngine.match(createRequest('https://example.com'), CosmeticOption.CosmeticOptionAll);
            expect(result2.JS.specific.length).toBe(1);
            expect(result2.JS.specific[0]!.getIndex()).toBe(
                getRawRuleIndex(rawFilterListLocal, specificScriptletRule2),
            );

            expect(result2.JS.generic.length).toBe(1);
            expect(
                result2.JS.generic[0]!.getIndex(),
            ).toBe(
                getRawRuleIndex(rawFilterListLocal, genericScriptletRule),
            );
        });

        it('allowlists scriptlets with the same name', () => {
            const allowlistScriptletRule = "#@%#//scriptlet('set-cookie')";
            const specificSetCookieScriptletRule = "example.org#%#//scriptlet('set-cookie', 'test1', '1')";
            const genericSetCookieScriptletRule = "#%#//scriptlet('set-cookie', 'test2', '2')";
            const specificSetStorageScriptletRule = "example.org#%#//scriptlet('set-local-storage-item', 'test1', '1')";
            const genericSetStorageScriptletRule = "#%#//scriptlet('set-local-storage-item', 'test2', '2')";
            const rulesLocal = [
                allowlistScriptletRule,
                specificSetCookieScriptletRule,
                genericSetCookieScriptletRule,
                specificSetStorageScriptletRule,
                genericSetStorageScriptletRule,
            ];
            const rawFilterListLocal = rulesLocal.join('\n');
            const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rawFilterListLocal)]));
            const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
            expect(result.JS.specific.length).toBe(1);
            expect(
                result.JS.specific[0]!.getIndex(),
            ).toBe(
                getRawRuleIndex(rawFilterListLocal, specificSetStorageScriptletRule),
            );

            expect(result.JS.generic.length).toBe(1);
            expect(
                result.JS.generic[0]!.getIndex(),
            ).toBe(
                getRawRuleIndex(rawFilterListLocal, genericSetStorageScriptletRule),
            );
        });
    });
});

describe('Test cosmetic engine - HTML filtering rules', () => {
    it('correctly detects HTML rules', () => {
        const contentPart = 'div[id="ad_text"]';
        const specificRule = `example.org$$${contentPart}`;
        const genericRule = `$$${contentPart}`;
        const rulesLocal = [
            specificRule,
            genericRule,
        ];
        const rawFilterListLocal = rulesLocal.join('\n');
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rawFilterListLocal)]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.Html.specific).toHaveLength(1);
        expect(result.Html.specific[0].getContent()).toContain(contentPart);
        expect(result.Html.generic).toHaveLength(1);
        expect(result.Html.generic[0].getContent()).toContain(contentPart);
    });

    it('correctly detects HTML rules - domain specific', () => {
        const contentPart = 'div[id="ad_text"]';
        const specificRule = `example.org$$${contentPart}`;
        const genericRule = `$$${contentPart}`;

        const rulesLocal = [
            specificRule,
            genericRule,
        ];
        const rawFilterListLocal = rulesLocal.join('\n');
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rawFilterListLocal)]));

        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionHtml);

        expect(result.Html.specific).toHaveLength(1);
        expect(result.Html.specific[0].getContent()).toContain(contentPart);
        expect(result.Html.generic).toHaveLength(0);
    });

    it('checks cosmetic HTML exceptions', () => {
        const rule = 'example.org$$div[id="ad_text"]';
        const exceptionRule = 'example.org$@$div[id="ad_text"]';
        const rulesLocal = [
            rule,
            exceptionRule,
        ];
        const rawFilterListLocal = rulesLocal.join('\n');
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rawFilterListLocal)]));
        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific).toHaveLength(0);
        expect(result.Html.generic).toHaveLength(0);
    });

    it('checks cosmetic HTML content exceptions', () => {
        const rule = 'example.org$$div[id="ad_text_1"]';
        const exceptionRule = 'example.org$@$div[id="ad_text_2"]';
        const rulesLocal = [
            rule,
            exceptionRule,
        ];
        const rawFilterListLocal = rulesLocal.join('\n');
        const cosmeticEngine = new CosmeticEngine(new RuleStorage([new StringRuleList(1, rawFilterListLocal)]));
        const result = cosmeticEngine.match(createRequest('https://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(result.Html.specific).toHaveLength(1);
        expect(result.Html.generic).toHaveLength(0);
    });
});
