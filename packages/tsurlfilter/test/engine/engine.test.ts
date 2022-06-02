import { Engine } from '../../src/engine/engine';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { config, setConfiguration } from '../../src/configuration';
import { CosmeticOption } from '../../src/engine/cosmetic-option';
import { RequestType } from '../../src/request-type';
import { Request } from '../../src/request';

const createRequest = (url: string): Request => new Request(url, null, RequestType.Document);

describe('Engine Tests', () => {
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

    it('works if frame matches rule', () => {
        const ruleText = '@@||example.org$document';
        const rules = [ruleText];
        const list = new StringRuleList(1, rules.join('\n'), false);
        const engine = new Engine(new RuleStorage([list]));

        expect(engine.getRulesCount()).toBe(1);

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);

        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe(ruleText);
        expect(result.documentRule).toBeNull();

        let frameRule = engine.matchFrame('https://example.org');
        expect(frameRule).not.toBeNull();
        expect(frameRule!.getText()).toBe(ruleText);

        frameRule = engine.matchFrame('https://test.com');
        expect(frameRule).toBeNull();
    });
});

describe('TestEngine - postponed load rules', () => {
    const rules = ['||example.org^$third-party', 'example.org##banner'];
    const list = new StringRuleList(1, rules.join('\n'), false);
    const ruleStorage = new RuleStorage([list]);

    it('works rules are loaded', () => {
        const engine = new Engine(ruleStorage, true);

        expect(engine.getRulesCount()).toBe(0);

        engine.loadRules();

        expect(engine.getRulesCount()).toBe(2);
    });

    it('works rules are loaded async', async () => {
        const engine = new Engine(ruleStorage, true);

        expect(engine.getRulesCount()).toBe(0);

        await engine.loadRulesAsync(1);

        expect(engine.getRulesCount()).toBe(2);
    });
});

describe('TestEngine - configuration', () => {
    const rules = ['||example.org^$third-party'];
    const list = new StringRuleList(1, rules.join('\n'), false);
    setConfiguration({
        engine: 'test-engine',
        version: 'test-version',
        verbose: true,
    });

    new Engine(new RuleStorage([list]));

    expect(config.engine).toBe('test-engine');
    expect(config.version).toBe('test-version');
    expect(config.verbose).toBe(true);
});

describe('TestEngineMatchRequest - advanced modifiers', () => {
    it('works if advanced modifier rules are found', () => {
        const cspRule = '||example.org^$csp=frame-src \'none\'';
        const replaceRule = '||example.org^$replace=/text-to-be-replaced/new-text/i';
        const cookieRule = '||example.org^$cookie';
        const removeParamRule = '||example.org^$removeparam=p1';
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

    it('it excludes allowlist rules, even if there are two badfilter rules', () => {
        const redirectRule = '/fuckadblock.$script,redirect=prevent-fab-3.2.0';
        const allowlistRule = '@@/fuckadblock.min.js$domain=example.org';
        const allowlistBadfilterRule = '@@/fuckadblock.min.js$domain=example.org,badfilter';
        const badfilterRule = '/fuckadblock.min.js$badfilter';

        const baseRuleList = new StringRuleList(1, [
            redirectRule,
            allowlistRule,
            badfilterRule,
            allowlistBadfilterRule,
        ].join('\n'), false, false);
        const engine = new Engine(new RuleStorage([baseRuleList]));

        const request = new Request(
            'https://example.org/fuckadblock.min.js',
            'https://example.org/url.html',
            RequestType.Script,
        );
        const result = engine.matchRequest(request);

        expect(result.getBasicResult()!.getText()).toBe(redirectRule);
    });
});

describe('TestEngineMatchRequest - redirect modifier', () => {
    it('checks if with redirect modifier resource type is not ignored', () => {
        const baseRuleList = new StringRuleList(1, [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=1x1-transparent.gif',
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        const request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        const result = engine.matchRequest(request);

        expect(result.getBasicResult()).toBeNull();
    });

    it('checks if with allowlist redirect modifier resource type is not ignored', () => {
        const baseRuleList = new StringRuleList(1, [
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=1x1-transparent.gif,image',
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        expect(engine.matchRequest(request).getBasicResult()).toBeNull();

        request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Media,
        );
        expect(engine.matchRequest(request).getBasicResult()).not.toBeNull();
    });

    it('checks that unrelated exception does not exclude other blocking rules', () => {
        const baseRuleList = new StringRuleList(1, [
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=2x2-transparent.png',
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        const request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        const basicResult = engine.matchRequest(request).getBasicResult();
        expect(basicResult).not.toBeNull();
        expect(basicResult!.getText()).toBe('||ya.ru$redirect=1x1-transparent.gif');
    });

    it('checks that it is possible to exclude all redirects with `@@$redirect` rule', () => {
        const baseRuleList = new StringRuleList(1, [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$redirect',
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        expect(engine.matchRequest(request).getBasicResult()).toBeNull();

        request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Media,
        );
        expect(engine.matchRequest(request).getBasicResult()).toBeNull();
    });

    it('checks that it is possible to exclude all redirects with `@@$redirect` rule - resource type', () => {
        const baseRuleList = new StringRuleList(1, [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$redirect,image',
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        expect(engine.matchRequest(request).getBasicResult()).toBeNull();

        request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Media,
        );
        expect(engine.matchRequest(request).getBasicResult()).not.toBeNull();
    });
});

describe('TestEngineMatchRequest - redirect-rule modifier', () => {
    it('checks if redirect-rule is found for blocked requests only', () => {
        const baseRuleList = new StringRuleList(1, [
            '||example.org/script.js',
            '||example.org^$redirect-rule=noopjs',
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'https://example.org/script.js',
            null,
            RequestType.Script,
        );
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()!.getText()).toBe('||example.org^$redirect-rule=noopjs');

        request = new Request(
            'https://example.org/index.js',
            null,
            RequestType.Script,
        );
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
    });

    it('checks if redirect-rule is negated by allowlist $redirect rule', () => {
        const baseRuleList = new StringRuleList(1, [
            '||example.org/script.js',
            '||example.org^$redirect-rule=noopjs',
            '@@||example.org/script.js?unblock$redirect',
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'https://example.org/script.js',
            null,
            RequestType.Script,
        );
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()!.getText()).toBe('||example.org^$redirect-rule=noopjs');

        request = new Request(
            'https://example.org/index.js',
            null,
            RequestType.Script,
        );
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();

        request = new Request(
            'https://example.org/script.js?unblock',
            null,
            RequestType.Script,
        );
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()!.getText()).toBe('||example.org/script.js');
    });
});

describe('TestEngineMatchRequest - document modifier', () => {
    it('respects document modifier request type in blocking rules', () => {
        const documentBlockingRuleText = '||example.org^$document';
        const baseRuleList = new StringRuleList(1, [
            documentBlockingRuleText,
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request('http://example.org/', null, RequestType.Document);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()!.getText()).toBe(documentBlockingRuleText);

        request = new Request('http://other.org/', null, RequestType.Document);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();

        request = new Request('http://example.org/', null, RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
    });

    it('respects document modifier request type in blocking rules - other request types', () => {
        const documentBlockingRuleText = '||example.org^$document,script';
        const baseRuleList = new StringRuleList(1, [
            documentBlockingRuleText,
        ].join('\n'));

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request('http://example.org/', null, RequestType.Document);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()!.getText()).toBe(documentBlockingRuleText);

        request = new Request('http://example.org/', null, RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()!.getText()).toBe(documentBlockingRuleText);

        request = new Request('http://example.org/', null, RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
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
        let result = engine.getCosmeticResult(createRequest('an-other-domain.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.elementHiding.generic.length).toEqual(2);
        expect(result.elementHiding.specific.length).toEqual(0);
        expect(result.elementHiding.genericExtCss.length).toBe(1);
        expect(result.elementHiding.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(1);
        expect(result.elementHiding.specificExtCss.length).toBe(1);

        result = engine.getCosmeticResult(
            createRequest('example.org'),
            CosmeticOption.CosmeticOptionGenericCSS & CosmeticOption.CosmeticOptionSpecificCSS,
        );

        expect(result.elementHiding.generic.length).toEqual(0);
        expect(result.elementHiding.specific.length).toEqual(0);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult(
            createRequest('example.org'),
            CosmeticOption.CosmeticOptionGenericCSS
            | CosmeticOption.CosmeticOptionSpecificCSS,
        );

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
        let result = engine.getCosmeticResult(createRequest('an-other-domain.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.CSS.generic.length).toEqual(1);
        expect(result.CSS.specific.length).toEqual(0);
        expect(result.CSS.genericExtCss.length).toBe(1);
        expect(result.CSS.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.CSS.generic.length).toEqual(1);
        expect(result.CSS.specific.length).toEqual(1);
        expect(result.CSS.genericExtCss.length).toBe(1);
        expect(result.CSS.specificExtCss.length).toBe(1);

        result = engine.getCosmeticResult(
            createRequest('example.org'),
            CosmeticOption.CosmeticOptionSpecificCSS & CosmeticOption.CosmeticOptionGenericCSS,
        );

        expect(result.CSS.generic.length).toEqual(0);
        expect(result.CSS.specific.length).toEqual(0);
        expect(result.CSS.genericExtCss.length).toBe(0);
        expect(result.CSS.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult(
            createRequest('example.org'),
            CosmeticOption.CosmeticOptionGenericCSS | CosmeticOption.CosmeticOptionSpecificCSS,
        );

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
        specificJsRule,
        genericJsRule,
    ];

    it('works if returns correct cosmetic js result', () => {
        const list = new StringRuleList(1, rules.join('\n'), false);
        const engine = new Engine(new RuleStorage([list]));

        let result = engine.getCosmeticResult(createRequest('an-other-domain.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(1);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(1);
        expect(result.JS.specific.length).toEqual(1);

        result = engine.getCosmeticResult(createRequest('example.org'), CosmeticOption.CosmeticOptionJS);

        expect(result.JS.generic.length).toEqual(1);
        expect(result.JS.specific.length).toEqual(1);
    });

    it('works javascript rules are ignored with filter list setting', () => {
        const list = new StringRuleList(1, rules.join('\n'), false, true);
        const engine = new Engine(new RuleStorage([list]));

        let result = engine.getCosmeticResult(createRequest('an-other-domain.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult(createRequest('example.org'), CosmeticOption.CosmeticOptionJS);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);
    });
});

describe('$urlblock modifier', () => {
    it('should have higher priority than important', () => {
        const important = '||example.com$important';
        const urlblock = '@@||example.org$urlblock';

        const list = new StringRuleList(1, [important, urlblock].join('\n'));
        const engine = new Engine(new RuleStorage([list]));

        const frameRule = engine.matchFrame('http://example.org');
        expect(frameRule).not.toBeNull();
        expect(frameRule!.getText()).toBe(urlblock);

        const request = new Request('http://example.com/image.png', 'http://example.org', RequestType.Image);
        const result = engine.matchRequest(request, frameRule).getBasicResult();
        expect(result).toBeTruthy();
        expect(result?.getText()).toEqual(urlblock);
    });
});

describe('$badfilter modifier', () => {
    it('checks badfilter rule negates network rule', () => {
        const rules = [
            '$script,domain=example.com|example.org',
            '$script,domain=example.com,badfilter',
        ];
        const list = new StringRuleList(1, rules.join('\n'), false);
        const engine = new Engine(new RuleStorage([list]));

        expect(engine.getRulesCount()).toBe(2);

        let request = new Request('https://example.com', 'https://example.com', RequestType.Script);
        let result = engine.matchRequest(request);
        expect(result.basicRule).toBeNull();

        request = new Request('https://example.org', 'https://example.org', RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.basicRule).not.toBeNull();
    });
});

describe('$genericblock modifier', () => {
    it('disables network generic rules', () => {
        const genericblockRule = '@@||domain.com^$genericblock';
        const networkGenericRule = '||example.org^';
        const networkNegatedGenericRule = '||domain.com^$domain=~example.com';

        const list = new StringRuleList(1, [
            networkGenericRule,
            networkNegatedGenericRule,
            genericblockRule,
        ].join('\n'));

        const engine = new Engine(new RuleStorage([list]));

        const frameRule = engine.matchFrame('https://domain.com');
        expect(frameRule).not.toBeNull();
        expect(frameRule!.getText()).toBe(genericblockRule);

        const result = engine.matchRequest(new Request(
            'https://example.org',
            'https://domain.com',
            RequestType.Script,
        ), frameRule);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule!.getText()).toBe(genericblockRule);
    });
});

describe('Match subdomains', () => {
    it('should find css rules for subdomains', () => {
        const specificHidingRule = 'example.org##div';
        const specificHidingRuleSubdomain = 'sub.example.org##h1';
        const rules = [
            specificHidingRule,
            specificHidingRuleSubdomain,
        ];
        const list = new StringRuleList(1, rules.join('\n'), false, false);
        const engine = new Engine(new RuleStorage([list]));

        let res = engine.getCosmeticResult(createRequest('www.example.org'), CosmeticOption.CosmeticOptionAll);
        expect(res).toBeDefined();
        expect(res.elementHiding.specific[0].getText()).toBe(specificHidingRule);

        res = engine.getCosmeticResult(createRequest('sub.example.org'), CosmeticOption.CosmeticOptionAll);
        expect(res).toBeDefined();
        expect(res.elementHiding.specific).toHaveLength(2);
        expect(res.elementHiding.specific.map((rule) => rule.getText()).includes(specificHidingRule))
            .toBeTruthy();
        expect(res.elementHiding.specific.map((rule) => rule.getText()).includes(specificHidingRuleSubdomain))
            .toBeTruthy();
    });

    it('should find css rules with www only for domains with www', () => {
        const specificHidingRuleWithWww = 'www.i.ua###Premium';
        const specificHidingRuleWithoutWww = 'i.ua###Premium';
        const rules = [
            specificHidingRuleWithWww,
            specificHidingRuleWithoutWww,
        ];
        const list = new StringRuleList(1, rules.join('\n'), false, false);
        const engine = new Engine(new RuleStorage([list]));

        let res = engine.getCosmeticResult(createRequest('i.ua'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific[0].getText()).toBe(specificHidingRuleWithoutWww);

        res = engine.getCosmeticResult(createRequest('mail.i.ua'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific[0].getText()).toBe(specificHidingRuleWithoutWww);

        // both rules match
        res = engine.getCosmeticResult(createRequest('www.i.ua'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(2);
    });

    it('should find js rules for subdomains', () => {
        const scriptletRule = 'example.org#%#//scriptlet("abort-on-property-read", "alert")';
        const subDomainScriptletRule = 'sub.example.org#%#//scriptlet("abort-on-property-read", "alert")';
        const otherSubDomainScriptletRule = 'other-sub.example.org#%#//scriptlet("abort-on-property-read", "alert")';

        const rules = [
            scriptletRule,
            subDomainScriptletRule,
            otherSubDomainScriptletRule,
        ];

        const list = new StringRuleList(1, rules.join('\n'), false, false);
        const engine = new Engine(new RuleStorage([list]));

        const resOne = engine.getCosmeticResult(
            createRequest('https://example.org/test'),
            CosmeticOption.CosmeticOptionAll,
        );
        expect(resOne).toBeDefined();
        expect(resOne.JS.specific[0].getText()).toBe(scriptletRule);

        const resTwo = engine.getCosmeticResult(
            createRequest('https://sub.example.org/test'),
            CosmeticOption.CosmeticOptionAll,
        );
        expect(resTwo).toBeDefined();
        expect(resTwo.JS.specific).toHaveLength(2);
        const rulesTexts = resTwo.JS.specific.map((rule) => rule.getText());
        expect(rulesTexts.includes(scriptletRule)).toBeTruthy();
        expect(rulesTexts.includes(subDomainScriptletRule)).toBeTruthy();
        expect(rulesTexts.includes(otherSubDomainScriptletRule)).toBeFalsy();
    });

    it('should match rules with tld domain only', () => {
        const hidingRule = 'org##body';
        const rules = [hidingRule];
        const list = new StringRuleList(1, rules.join('\n'), false, false);
        const engine = new Engine(new RuleStorage([list]));

        let res = engine.getCosmeticResult(createRequest('example.org'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific[0].getText()).toBe(hidingRule);

        res = engine.getCosmeticResult(createRequest('www.example.org'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific[0].getText()).toBe(hidingRule);
    });
});

describe('$specifichide modifier', () => {
    it('should not allowlist generic rules', () => {
        const elemhideRule = 'example.org##div';
        const cosmeticRule = 'example.org#$#div { display: none !important; }';
        const genericCosmeticRule = '#$#div { display: none !important; }';
        const genericElemhideRule = '##div';
        const genericCssRuleWithExclusion = '~google.com#$#div { display: none !important }';
        const specifichideRule = '@@||example.org^$specifichide';
        const list = new StringRuleList(1, [
            elemhideRule,
            cosmeticRule,
            genericCosmeticRule,
            genericElemhideRule,
            genericCssRuleWithExclusion,
            specifichideRule,
        ].join('\n'));
        const engine = new Engine(new RuleStorage([list]));
        const request = new Request('http://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);
        const cosmeticResult = engine.getCosmeticResult(createRequest('example.org'), result.getCosmeticOption());
        expect(cosmeticResult).toBeTruthy();
        expect(cosmeticResult.elementHiding.specific).toHaveLength(0);
        expect(cosmeticResult.elementHiding.generic).toHaveLength(1);
        expect(cosmeticResult.elementHiding.generic[0].getText()).toBe(genericElemhideRule);
        expect(cosmeticResult.CSS.specific).toHaveLength(0);
        expect(cosmeticResult.CSS.generic).toHaveLength(2);

        const cssGenericRules = cosmeticResult.CSS.generic;
        expect(cssGenericRules.some((rule) => rule.getText() === genericCssRuleWithExclusion)).toBeTruthy();
        expect(cssGenericRules.some((rule) => rule.getText() === genericCosmeticRule)).toBeTruthy();
    });
});

describe('Stealth cookie rules', () => {
    it('allowlists stealth cookie rules', () => {
        const stealthCookieRule = '$cookie=/.+/;maxAge=60';
        let list = new StringRuleList(1, [
            stealthCookieRule,
        ].join('\n'));
        let engine = new Engine(new RuleStorage([list]));
        let request = new Request('http://example.org', '', RequestType.Document);
        let result = engine.matchRequest(request);
        let cookieRules = result.getCookieRules();
        expect(cookieRules[0].getText()).toBe(stealthCookieRule);

        const allowlistRule = '@@||example.org^$stealth,removeparam,cookie';
        list = new StringRuleList(1, [
            stealthCookieRule,
            allowlistRule,
        ].join('\n'));
        engine = new Engine(new RuleStorage([list]));
        request = new Request('http://example.org', '', RequestType.Document);
        result = engine.matchRequest(request);
        cookieRules = result.getCookieRules();
        expect(cookieRules[0].getText()).toBe(allowlistRule);
    });
});
