import { MatchingResult } from '../../src/engine/matching-result';
import { NetworkRule } from '../../src';
import { CosmeticOption } from '../../src/engine/cosmetic-option';

describe('TestNewMatchingResult', () => {
    it('works if basic rule is found', () => {
        const ruleText = '||example.org^';
        const rules = [new NetworkRule(ruleText, 0)];

        const result = new MatchingResult(rules, []);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual(ruleText);
    });

    it('works if whitelist rule is found', () => {
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
        // eslint-disable-next-line max-len
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionCSS | CosmeticOption.CosmeticOptionJS | CosmeticOption.CosmeticOptionHtml);
    });

    it('works with $jsinject modifier', () => {
        rules = [new NetworkRule('@@||example.org^$jsinject', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        // eslint-disable-next-line max-len
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionCSS | CosmeticOption.CosmeticOptionGenericCSS | CosmeticOption.CosmeticOptionHtml);
    });

    it('works with $elemhide modifier', () => {
        rules = [new NetworkRule('@@||example.org^$elemhide', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionJS | CosmeticOption.CosmeticOptionHtml);
    });

    it('works with $content modifier', () => {
        rules = [new NetworkRule('@@||example.org^$content', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        // eslint-disable-next-line max-len
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionCSS | CosmeticOption.CosmeticOptionGenericCSS | CosmeticOption.CosmeticOptionJS);
    });

    it('works with $document modifier', () => {
        rules = [new NetworkRule('@@||example.org^$document', 0)];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeDefined();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionNone);
    });
});

describe('TestNewMatchingResult - badfilter modifier', () => {
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

    it('checks badfilter for a distinct domain', () => {
        const rules = [
            new NetworkRule('/some$domain=example.com|example.org', 0),
            new NetworkRule('/some$domain=example.com,badfilter', 0),
        ];
        const sourceRules: NetworkRule[] = [];

        const result = new MatchingResult(rules, sourceRules);

        expect(result.basicRule).toBeNull();
    });

    it('checks badfilter for a few domains', () => {
        const rules = [
            new NetworkRule('/some$domain=example.com|example.org|example.test', 0),
            new NetworkRule('/some$domain=example.com|example.org,badfilter', 0),
        ];
        const sourceRules: NetworkRule[] = [];

        const result = new MatchingResult(rules, sourceRules);

        expect(result.basicRule).toBeNull();
    });

    it('checks badfilter could not be applied - negated domain', () => {
        const rules = [
            new NetworkRule('/some$domain=example.com|example.org|~negated.com', 0),
            new NetworkRule('/some$domain=example.com,badfilter', 0),
        ];
        const sourceRules: NetworkRule[] = [];

        const result = new MatchingResult(rules, sourceRules);

        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getPermittedDomains()).toHaveLength(2);
        expect(result.basicRule!.getPermittedDomains()).toContain('example.com');
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

describe('TestNewMatchingResult - replace rules', () => {
    it('works if replace rules are found', () => {
        const rules = [
            new NetworkRule('||example.org^$replace=/test/test1/g', 0),
            new NetworkRule('||example.org^$replace=/test1/test2/g', 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const replaceRules = result.getReplaceRules();
        expect(replaceRules.length).toBe(rules.length);
    });

    it('works if whitelisted replace filter with same option is omitted', () => {
        const expectedRuleText = '||example.org^$replace=/test/test1/g';

        const ruleTexts = [
            expectedRuleText,
            '||example.org^$replace=/test1/test2/g',
            '@@||example.org^$replace=/test1/test2/g',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const replaceRules = result.getReplaceRules();
        expect(replaceRules.length).toBe(2);
    });

    it('work if @@||example.org^$replace will disable all $replace rules matching ||example.org^.', () => {
        const ruleTexts = [
            '||example.org^$replace=/test1/test2/g',
            '@@||example.org^$replace',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const replaceRules = result.getReplaceRules();
        expect(replaceRules.length).toBe(1);
    });
});

describe('TestNewMatchingResult - cookie rules', () => {
    const cookieRuleTextOne = '$cookie=/__utm[a-z]/';
    const cookieRuleTextTwo = '$cookie=__cfduid';
    const cookieRuleWhitelistTextOne = '@@$cookie=/__utm[a-z]/';
    const cookieRuleWhitelistTextTwo = '@@$cookie=__cfduid';
    const cookieRuleWhitelistText = '@@$cookie';
    const cookieRuleWhitelistRegexpText = '@@$cookie=/__cfd[a-z]/';

    it('works if cookie rules are found', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(rules.length);
        expect(cookieRules[0].getText()).toBe(cookieRuleTextOne);
        expect(cookieRules[1].getText()).toBe(cookieRuleTextTwo);
    });

    it('works if cookie whitelist rule is ok', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
            new NetworkRule(cookieRuleWhitelistTextOne, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(rules.length - 1);
        expect(cookieRules[0].getText()).toBe(cookieRuleWhitelistTextOne);
        expect(cookieRules[1].getText()).toBe(cookieRuleTextTwo);
    });

    it('works if cookie whitelist rule is ok', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
            new NetworkRule(cookieRuleWhitelistTextOne, 0),
            new NetworkRule(cookieRuleWhitelistTextTwo, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(rules.length - 2);
        expect(cookieRules[0].getText()).toBe(cookieRuleWhitelistTextOne);
        expect(cookieRules[1].getText()).toBe(cookieRuleWhitelistTextTwo);
    });

    it('works if cookie whitelist all rule is ok', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
            new NetworkRule(cookieRuleWhitelistTextOne, 0),
            new NetworkRule(cookieRuleWhitelistTextTwo, 0),
            new NetworkRule(cookieRuleWhitelistText, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0].getText()).toBe(cookieRuleWhitelistText);
    });

    it('works if cookie whitelist all rule is ok', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
            new NetworkRule(cookieRuleWhitelistTextOne, 0),
            new NetworkRule(cookieRuleWhitelistRegexpText, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(2);
        expect(cookieRules[0].getText()).toBe(cookieRuleWhitelistTextOne);
        expect(cookieRules[1].getText()).toBe(cookieRuleWhitelistRegexpText);
    });
});

describe('TestNewMatchingResult - stealth modifier', () => {
    it('works if stealth rule is found', () => {
        const ruleText = '@@||example.org^$stealth';
        const rules = [
            new NetworkRule(ruleText, 0),
        ];
        const sourceRules: NetworkRule[] = [];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.stealthRule).not.toBeNull();
        expect(result.stealthRule!.getText()).toBe(ruleText);
    });

    it('works if stealth rule is found for source', () => {
        const ruleText = '@@||example.org^$stealth';
        const rules: NetworkRule[] = [];
        const sourceRules: NetworkRule[] = [
            new NetworkRule(ruleText, 0),
        ];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.stealthRule).not.toBeNull();
        expect(result.stealthRule!.getText()).toBe(ruleText);
    });

    it('works if stealth rule is found with an other rule', () => {
        const ruleText = '||example.org^';
        const stealthRuleText = '@@||example.org^$stealth';
        const rules = [
            new NetworkRule(ruleText, 0),
            new NetworkRule(stealthRuleText, 0),
        ];
        const sourceRules: NetworkRule[] = [];

        const result = new MatchingResult(rules, sourceRules);

        expect(result).toBeTruthy();
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe(ruleText);
        expect(result.documentRule).toBeNull();
        expect(result.stealthRule).not.toBeNull();
        expect(result.stealthRule!.getText()).toBe(stealthRuleText);
    });
});
