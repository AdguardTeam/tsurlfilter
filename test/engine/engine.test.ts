import { Engine } from '../../src/engine/engine';
import { Request, RequestType } from '../../src';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { CosmeticOption } from '../../src/engine/matching-result';

describe('TestEngineMatchRequest', () => {
    it('works if request matches rule', () => {
        const rules = ['||example.org^$third-party'];
        const list = new StringRuleList(1, rules.join('\n'), false);
        const engine = new Engine(new RuleStorage([list]));

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules).toBeNull();
        expect(result.cspRules).toBeNull();
        expect(result.cookieRules).toBeNull();
        expect(result.stealthRule).toBeNull();
    });
});

describe('TestEngineCosmeticResult', () => {
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

    const list = new StringRuleList(1, rules.join('\n'), false);
    const engine = new Engine(new RuleStorage([list]));

    it('works if returns correct cosmetic elemhide result', () => {
        let result = engine.getCosmeticResult('an-other-domain.org', CosmeticOption.CosmeticOptionAll);

        expect(result.elementHiding.generic.length).toEqual(2);
        expect(result.elementHiding.specific.length).toEqual(0);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionAll);

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult('example.org', CosmeticOption.CosmeticOptionCSS);

        expect(result.elementHiding.generic.length).toEqual(0);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult('example.org',
            CosmeticOption.CosmeticOptionCSS | CosmeticOption.CosmeticOptionGenericCSS);

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);
    });
});
