import { CosmeticOption, MatchingResult } from '../../src/engine/matching-result';
import { NetworkRule } from '../../src';

describe('TestNewMatchingResult', () => {
    it('works if constructor is ok', () => {
        const ruleText = '||example.org^';
        const rules = [new NetworkRule(ruleText, 0)];

        const result = new MatchingResult(rules, []);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual(ruleText);
    });
});

describe('TestNewMatchingResultWhitelist', () => {
    it('works if constructor is ok', () => {
        const ruleText = '||example.org^';
        const sourceRuleText = '@@||example.com^$document';

        const rules = [new NetworkRule(ruleText, 0)];
        const sourceRules = [new NetworkRule(sourceRuleText, 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual(sourceRuleText);
    });
});

describe('TestGetCosmeticOption', () => {
    let rules: NetworkRule[];
    const sourceRules: NetworkRule[] = [];

    it('works in simple case - no limitations', () => {
        rules = [new NetworkRule('||example.org^', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionAll);
    });

    it('works with $generichide modifier', () => {
        rules = [new NetworkRule('@@||example.org^$generichide', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption())
            .toEqual(CosmeticOption.CosmeticOptionCSS | CosmeticOption.CosmeticOptionJS);
    });

    it('works with $jsinject modifier', () => {
        rules = [new NetworkRule('@@||example.org^$jsinject', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption())
            .toEqual(CosmeticOption.CosmeticOptionCSS | CosmeticOption.CosmeticOptionGenericCSS);
    });

    it('works with $elemhide modifier', () => {
        rules = [new NetworkRule('@@||example.org^$elemhide', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionJS);
    });

    it('works with $document modifier', () => {
        rules = [new NetworkRule('@@||example.org^$document', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeDefined();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionNone);
    });
});

describe('TestNewMatchingResultBadfilter', () => {
    it('works if badfilter is ok', () => {
        const rules = [
            new NetworkRule('||example.org^', 0),
            new NetworkRule('||example.org^$badfilter', 0),
        ];
        const sourceRules: NetworkRule[] = [];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
    });
});

describe('TestNewMatchingResultBadfilterWhitelist', () => {
    it('works if badfilter whitelist is ok', () => {
        const rules = [
            new NetworkRule('||example.org^', 0),
            new NetworkRule('@@||example.org^', 0),
            new NetworkRule('@@||example.org^$badfilter', 0),
        ];
        const sourceRules: NetworkRule[] = [];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeTruthy();
        expect(result.documentRule).toBeNull();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual('||example.org^');
    });
});

describe('TestNewMatchingResultBadfilterSourceRules', () => {
    it('works if badfilter source whitelist is ok', () => {
        const rules = [
            new NetworkRule('||example.org^', 0),
        ];
        const sourceRules: NetworkRule[] = [
            new NetworkRule('@@||example.org^$document', 0),
            new NetworkRule('@@||example.org^$document,badfilter', 0),
        ];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeTruthy();
        expect(result.documentRule).toBeNull();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual('||example.org^');
    });
});

describe('TestNewMatchingResult - csp rules', () => {
    const cspRule = '||example.org^$third-party,csp=connect-src \'none\',domain=~example.com|test.com';
    const directiveWhiteListRule = '@@||example.org^$csp=connect-src \'none\'';
    const globalWhiteListRule = '@@||example.org^$csp';
    const directiveMissWhiteListRule = '@@||example.org^$csp=frame-src \'none\'';

    it('works if csp rule is found', () => {
        const rules = [new NetworkRule(cspRule, 0)];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0].getText()).toBe(cspRule);
    });

    it('works if csp directive whitelist rule is found', () => {
        const rules = [
            new NetworkRule(cspRule, 0),
            new NetworkRule(directiveWhiteListRule, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0].getText()).toBe(directiveWhiteListRule);
    });

    it('works if csp global whitelist rule is found', () => {
        const rules = [
            new NetworkRule(cspRule, 0),
            new NetworkRule(directiveWhiteListRule, 0),
            new NetworkRule(globalWhiteListRule, 0),
        ];

        const result = new MatchingResult(rules, null);
        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0].getText()).toBe(globalWhiteListRule);
    });

    it('works if csp wrong directive whitelist rule is not found', () => {
        const rules = [
            new NetworkRule(cspRule, 0),
            new NetworkRule(directiveMissWhiteListRule, 0),
        ];

        const result = new MatchingResult(rules, null);
        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0].getText()).toBe(cspRule);
    });
});
