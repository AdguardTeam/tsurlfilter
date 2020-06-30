import { Engine } from '../../src/engine/engine';
import { Request, RequestType } from '../../src';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { config } from '../../src/configuration';
import { CosmeticOption } from '../../src/engine/cosmetic-option';

describe('TestEngineMatchRequest', () => {
    it('works if request matches rule', () => {
        const rules = ['||example.org^$third-party'];
        const list = new StringRuleList(1, rules.join('\n'), false);
        const engine = new Engine(new RuleStorage([list]));

        expect(engine.getRulesCount()).toBe(1);

        let request = new Request('https://example.org', '', RequestType.Document);
        let result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules).toBeNull();
        expect(result.cspRules).toBeNull();
        expect(result.cookieRules).toBeNull();
        expect(result.stealthRule).toBeNull();

        request = new Request('https://example.org', 'https://example.org', RequestType.Document);
        result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules).toBeNull();
        expect(result.cspRules).toBeNull();
        expect(result.cookieRules).toBeNull();
        expect(result.stealthRule).toBeNull();
    });
});

describe('TestEngine - configuration', () => {
    const rules = ['||example.org^$third-party'];
    const list = new StringRuleList(1, rules.join('\n'), false);
    new Engine(new RuleStorage([list]), {
        engine: 'test-engine',
        version: 'test-version',
        verbose: true,
    });

    expect(config.engine).toBe('test-engine');
    expect(config.version).toBe('test-version');
    expect(config.verbose).toBe(true);
});

describe('TestEngineMatchRequest - advanced modifiers', () => {
    it('works if advanced modifier rules are found', () => {
        const cspRule = '||example.org^$csp=frame-src \'none\'';
        const replaceRule = '||example.org^$replace=/text-to-be-replaced/new-text/i';
        const cookieRule = '||example.org^$cookie';
        const removeParamRule = '||example.org^$removeparam=p1|p2';
        const rules = [cspRule, replaceRule, cookieRule, removeParamRule];

        const list = new StringRuleList(1, rules.join('\n'), false);
        const engine = new Engine(new RuleStorage([list]));

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules && result.replaceRules.length).toBe(1);
        expect(result.replaceRules && result.replaceRules[0].getText()).toBe(replaceRule);
        expect(result.cspRules && result.cspRules.length).toBe(1);
        expect(result.cspRules && result.cspRules[0].getText()).toBe(cspRule);
        expect(result.cookieRules && result.cookieRules.length).toBe(1);
        expect(result.cookieRules && result.cookieRules[0].getText()).toBe(cookieRule);
        expect(result.removeParamRules && result.removeParamRules.length).toBe(1);
        expect(result.removeParamRules && result.removeParamRules[0].getText()).toBe(removeParamRule);
        expect(result.stealthRule).toBeNull();
    });
});

describe('TestEngineCosmeticResult - elemhide', () => {
    const specificRuleContent = 'banner_specific';
    const specificRule = `example.org##${specificRuleContent}`;

    const genericRuleContent = 'banner_generic';
    const genericRule = `##${genericRuleContent}`;

    const genericDisabledRuleContent = 'banner_generic_disabled';
    const genericDisabledRule = `##${genericDisabledRuleContent}`;
    const specificDisablingRule = `example.org#@#${genericDisabledRuleContent}`;

    const extCssSpecificRuleText = '.ext_css_specific[-ext-contains=test]';
    const extCssSpecificRule = `example.org##${extCssSpecificRuleText}`;
    const extCssGenericRuleText = '.ext_css_generic[-ext-contains=test]';
    const extCssGenericRule = `##${extCssGenericRuleText}`;

    const rules = [
        specificRule,
        specificDisablingRule,
        genericRule,
        genericDisabledRule,
        extCssSpecificRule,
        extCssGenericRule,
    ];

    const list = new StringRuleList(1, rules.join('\n'), false);
    const engine = new Engine(new RuleStorage([list]));

    it('works if returns correct cosmetic elemhide result', () => {
        let result = engine.getCosmeticResult('an-other-domain.org', CosmeticOption.CosmeticOptionAll);

        expect(result.elementHiding.generic.length).toEqual(2);
        expect(result.elementHiding.specific.length).toEqual(0);
        expect(result.elementHiding.genericExtCss.length).toBe(1);
        expect(result.elementHiding.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionAll);

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(1);
        expect(result.elementHiding.specificExtCss.length).toBe(1);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionCSS);

        expect(result.elementHiding.generic.length).toEqual(0);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(1);

        result = engine.getCosmeticResult('example.org',
            CosmeticOption.CosmeticOptionCSS | CosmeticOption.CosmeticOptionGenericCSS);

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(1);
        expect(result.elementHiding.specificExtCss.length).toBe(1);
    });
});

describe('TestEngineCosmeticResult - cosmetic css', () => {
    const cssRuleText = '.cosmetic { visibility: hidden; }';
    const specificCssRule = `example.org#$#${cssRuleText}`;
    const genericCssRule = `#$#${cssRuleText}`;
    const extCssCssRuleText = ':has(.ext-css-cosmetic) { visibility: hidden; }';
    const extCssSpecificCssRule = `example.org#$#${extCssCssRuleText}`;
    const extCssGenericCssRule = `#$#${extCssCssRuleText}`;

    const rules = [
        specificCssRule,
        genericCssRule,
        extCssSpecificCssRule,
        extCssGenericCssRule,
    ];

    const list = new StringRuleList(1, rules.join('\n'), false);
    const engine = new Engine(new RuleStorage([list]));

    it('works if returns correct cosmetic css result', () => {
        let result = engine.getCosmeticResult('an-other-domain.org', CosmeticOption.CosmeticOptionAll);

        expect(result.CSS.generic.length).toEqual(1);
        expect(result.CSS.specific.length).toEqual(0);
        expect(result.CSS.genericExtCss.length).toBe(1);
        expect(result.CSS.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionAll);

        expect(result.CSS.generic.length).toEqual(1);
        expect(result.CSS.specific.length).toEqual(1);
        expect(result.CSS.genericExtCss.length).toBe(1);
        expect(result.CSS.specificExtCss.length).toBe(1);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionCSS);

        expect(result.CSS.generic.length).toEqual(0);
        expect(result.CSS.specific.length).toEqual(1);
        expect(result.CSS.genericExtCss.length).toBe(0);
        expect(result.CSS.specificExtCss.length).toBe(1);

        result = engine.getCosmeticResult('example.org',
            CosmeticOption.CosmeticOptionCSS | CosmeticOption.CosmeticOptionGenericCSS);

        expect(result.CSS.generic.length).toEqual(1);
        expect(result.CSS.specific.length).toEqual(1);
        expect(result.CSS.genericExtCss.length).toBe(1);
        expect(result.CSS.specificExtCss.length).toBe(1);
    });
});

describe('TestEngineCosmeticResult - js', () => {
    const jsRuleText = 'window.__gaq = undefined;';
    const specificJsRule = `example.org#%#${jsRuleText}`;
    const genericJsRule = `#%#${jsRuleText}`;

    const rules = [
        jsRuleText,
        specificJsRule,
        genericJsRule,
    ];

    it('works if returns correct cosmetic js result', () => {
        const list = new StringRuleList(1, rules.join('\n'), false);
        const engine = new Engine(new RuleStorage([list]));

        let result = engine.getCosmeticResult('an-other-domain.org', CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(1);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(1);
        expect(result.JS.specific.length).toEqual(1);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionJS);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(1);
    });

    it('works javascript rules are ignored with filter list setting', () => {
        const list = new StringRuleList(1, rules.join('\n'), false, true);
        const engine = new Engine(new RuleStorage([list]));

        let result = engine.getCosmeticResult('an-other-domain.org', CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionJS);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);
    });
});
