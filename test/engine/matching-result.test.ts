import { MatchingResult, NetworkRule, CosmeticOption } from '../../src';

describe('TestNewMatchingResult', () => {
    it('works if basic rule is found', () => {
        const ruleText = '||example.org^';
        const rules = [new NetworkRule(ruleText, 0)];

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        expect(result.getCookieRules()).toHaveLength(0);
        expect(result.getCspRules()).toHaveLength(0);
        expect(result.getRemoveParamRules()).toHaveLength(0);
        expect(result.getReplaceRules()).toHaveLength(0);
        expect(result.basicRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual(ruleText);
    });

    it('works if allowlist rule is found', () => {
        const ruleText = '||example.org^';
        const sourceRuleText = '@@||example.com^$document';

        const rules = [new NetworkRule(ruleText, 0)];
        const sourceRule = new NetworkRule(sourceRuleText, 0);

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual(sourceRuleText);
    });

    it('works if allowlist document-level rule is found', () => {
        const ruleText = '||example.org^';
        const sourceRuleText = '@@||example.com^$urlblock';

        const rules = [new NetworkRule(ruleText, 0)];
        const sourceRule = new NetworkRule(sourceRuleText, 0);

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual(sourceRuleText);
    });

    it('works if allowlist non-document-level rule is not found', () => {
        const sourceRuleText = '@@||example.com^$generichide';
        const sourceRule = new NetworkRule(sourceRuleText, 0);

        const result = new MatchingResult([], sourceRule);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeNull();
    });
});

describe('TestGetCosmeticOption', () => {
    let rules: NetworkRule[];
    const sourceRule: NetworkRule | null = null;

    it('works in simple case - no limitations', () => {
        rules = [new NetworkRule('||example.org^', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionAll);
    });

    it('works with $generichide modifier', () => {
        rules = [new NetworkRule('@@||example.org^$generichide', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionSpecificCSS
            | CosmeticOption.CosmeticOptionJS
            | CosmeticOption.CosmeticOptionHtml,
        );
    });

    it('works with $specifichide modifier', () => {
        rules = [new NetworkRule('@@||example.org^$specifichide', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionGenericCSS
            | CosmeticOption.CosmeticOptionJS
            | CosmeticOption.CosmeticOptionHtml,
        );
    });

    it('works with $jsinject modifier', () => {
        rules = [new NetworkRule('@@||example.org^$jsinject', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionGenericCSS
            | CosmeticOption.CosmeticOptionSpecificCSS
            | CosmeticOption.CosmeticOptionHtml,
        );
    });

    it('works with $elemhide modifier', () => {
        rules = [new NetworkRule('@@||example.org^$elemhide', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionJS | CosmeticOption.CosmeticOptionHtml);
    });

    it('works with $content modifier', () => {
        rules = [new NetworkRule('@@||example.org^$content', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionGenericCSS
            | CosmeticOption.CosmeticOptionSpecificCSS
            | CosmeticOption.CosmeticOptionJS,
        );
    });

    it('works with $document modifier', () => {
        rules = [new NetworkRule('@@||example.org^$document', 0)];

        const result = new MatchingResult(rules, sourceRule);

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

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
    });

    it('works if badfilter allowlist is ok', () => {
        const rules = [
            new NetworkRule('||example.org^', 0),
            new NetworkRule('@@||example.org^', 0),
            new NetworkRule('@@||example.org^$badfilter', 0),
        ];

        const result = new MatchingResult(rules, null);

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

        const result = new MatchingResult(rules, null);

        expect(result.basicRule).toBeNull();
    });

    it('checks badfilter for a few domains', () => {
        const rules = [
            new NetworkRule('/some$domain=example.com|example.org|example.test', 0),
            new NetworkRule('/some$domain=example.com|example.org,badfilter', 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result.basicRule).toBeNull();
    });

    it('checks badfilter could not be applied - negated domain', () => {
        const rules = [
            new NetworkRule('/some$domain=example.com|example.org|~negated.com', 0),
            new NetworkRule('/some$domain=example.com,badfilter', 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getPermittedDomains()).toHaveLength(2);
        expect(result.basicRule!.getPermittedDomains()).toContain('example.com');
    });
});

describe('TestNewMatchingResult - csp rules', () => {
    const cspRule = '||example.org^$third-party,csp=connect-src \'none\',domain=~example.com|test.com';
    const directiveAllowlistRule = '@@||example.org^$csp=connect-src \'none\'';
    const globalAllowlistRule = '@@||example.org^$csp';
    const directiveMissAllowlistRule = '@@||example.org^$csp=frame-src \'none\'';

    it('works if csp rule is found', () => {
        const rules = [new NetworkRule(cspRule, 0)];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0].getText()).toBe(cspRule);
    });

    it('works if csp directive allowlist rule is found', () => {
        const rules = [
            new NetworkRule(cspRule, 0),
            new NetworkRule(directiveAllowlistRule, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0].getText()).toBe(directiveAllowlistRule);
    });

    it('works if csp global allowlist rule is found', () => {
        const rules = [
            new NetworkRule(cspRule, 0),
            new NetworkRule(directiveAllowlistRule, 0),
            new NetworkRule(globalAllowlistRule, 0),
        ];

        const result = new MatchingResult(rules, null);
        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0].getText()).toBe(globalAllowlistRule);
    });

    it('works if csp wrong directive allowlist rule is not found', () => {
        const rules = [
            new NetworkRule(cspRule, 0),
            new NetworkRule(directiveMissAllowlistRule, 0),
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

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeNull();
    });

    it('works if allowlisted replace filter with same option is omitted', () => {
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

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeNull();
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

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeNull();
    });

    it('work if @@||example.org^$content will be found', () => {
        const ruleTexts = [
            '||example.org^$replace=/test1/test2/g',
            '@@||example.org^$content',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const replaceRules = result.getReplaceRules();
        expect(replaceRules.length).toBe(1);

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult!.getText()).toEqual('@@||example.org^$content');
    });

    it('checks only $document and $content rules disable $replace', () => {
        const ruleTexts = [
            '||example.org^$replace=/test1/test2/g',
            '@@||example.org^$genericblock',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);

        expect(result.getReplaceRules()).toHaveLength(1);
        expect(result.getBasicResult()).toBeNull();
    });
});

describe('TestNewMatchingResult - cookie rules', () => {
    const cookieRuleTextOne = '$cookie=/__utm[a-z]/';
    const cookieRuleTextTwo = '$cookie=__cfduid';
    const cookieRuleAllowlistTextOne = '@@$cookie=/__utm[a-z]/';
    const cookieRuleAllowlistTextTwo = '@@$cookie=__cfduid';
    const cookieRuleAllowlistText = '@@$cookie';
    const cookieRuleAllowlistRegexpText = '@@$cookie=/__cfd[a-z]/';

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

    it('works if cookie allowlist rule is ok', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
            new NetworkRule(cookieRuleAllowlistTextOne, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(rules.length - 1);
        expect(cookieRules[0].getText()).toBe(cookieRuleAllowlistTextOne);
        expect(cookieRules[1].getText()).toBe(cookieRuleTextTwo);
    });

    it('works if cookie allowlist rule is ok', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
            new NetworkRule(cookieRuleAllowlistTextOne, 0),
            new NetworkRule(cookieRuleAllowlistTextTwo, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(rules.length - 2);
        expect(cookieRules[0].getText()).toBe(cookieRuleAllowlistTextOne);
        expect(cookieRules[1].getText()).toBe(cookieRuleAllowlistTextTwo);
    });

    it('works if cookie allowlist all rule is ok', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
            new NetworkRule(cookieRuleAllowlistTextOne, 0),
            new NetworkRule(cookieRuleAllowlistTextTwo, 0),
            new NetworkRule(cookieRuleAllowlistText, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0].getText()).toBe(cookieRuleAllowlistText);
    });

    it('works if cookie allowlist all rule is ok', () => {
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
            new NetworkRule(cookieRuleAllowlistTextOne, 0),
            new NetworkRule(cookieRuleAllowlistRegexpText, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(2);
        expect(cookieRules[0].getText()).toBe(cookieRuleAllowlistTextOne);
        expect(cookieRules[1].getText()).toBe(cookieRuleAllowlistRegexpText);
    });

    it('returns empty list if document allowlist rule added', () => {
        const documentAllowlistRule = '@@||example.com^$document';
        const rules = [
            new NetworkRule(cookieRuleTextOne, 0),
            new NetworkRule(cookieRuleTextTwo, 0),
        ];
        const sourceRule = new NetworkRule(documentAllowlistRule, 0);
        const result = new MatchingResult(rules, sourceRule);
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toEqual([]);
    });
});

describe('TestNewMatchingResult - stealth modifier', () => {
    it('works if stealth rule is found', () => {
        const ruleText = '@@||example.org^$stealth';
        const rules = [
            new NetworkRule(ruleText, 0),
        ];

        const result = new MatchingResult(rules, null);

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

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe(ruleText);
        expect(result.documentRule).toBeNull();
        expect(result.stealthRule).not.toBeNull();
        expect(result.stealthRule!.getText()).toBe(stealthRuleText);
    });
});

describe('TestNewMatchingResult - redirect rules', () => {
    it('works if redirect rules are found', () => {
        const rules = [
            new NetworkRule('||8s8.eu^*fa.js$script,redirect=noopjs', 0),
            new NetworkRule('||8s8.eu^*fa.js$script', 0),
        ];

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBeTruthy();
        expect(resultRule!.getText()).toBe('||8s8.eu^*fa.js$script,redirect=noopjs');
    });

    it('works if allowlisted redirect rule with same option is omitted', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '@@||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=2x2-transparent.png,image',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBeTruthy();
        expect(resultRule!.getText()).toBe('||ya.ru$redirect=2x2-transparent.png,image');
    });

    it('works if allowlist rule omit all resource types', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=1x1-transparent.gif',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toBeNull();
    });

    it('checks that unrelated exception does not exclude other blocking rules', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=2x2-transparent.png',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBeTruthy();
        expect(resultRule!.getText()).toBe('||ya.ru$redirect=1x1-transparent.gif');
    });

    it('checks that it is possible to exclude all redirects with `@@$redirect` rule', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$redirect',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toBeNull();
    });

    it('checks that it is possible to exclude all redirects with allowlist rule', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$document',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()!.getText()).toBe('@@||ya.ru$document');
    });

    it('checks that important redirect rule negates allowlist rule', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png,important',
            '@@||ya.ru$document',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()!.getText()).toBe('||ya.ru$redirect=2x2-transparent.png,important');
    });

    it('checks that important allowlist rule negates important redirect rule', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png,important',
            '@@||ya.ru$document,important',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()!.getText()).toBe('@@||ya.ru$document,important');
    });

    it('checks that common allowlist rule negates redirect rule', () => {
        const ruleTexts = [
            '||*/redirect-exception-test.js$redirect=noopjs',
            '@@||*/redirect-exception-test.js',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()!.getText()).toBe('@@||*/redirect-exception-test.js');
    });

    it('checks that redirect allowlist rule negates redirect rule', () => {
        const ruleTexts = [
            '||*/redirect-exception-test.js$redirect=noopjs',
            '@@||*/redirect-exception-test.js$redirect',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toBeNull();
    });
});

describe('TestNewMatchingResult - redirect-rule rules', () => {
    it('works if redirect-rule rule is found', () => {
        const rules = [
            new NetworkRule('*$script,redirect-rule=noopjs,domain=example.org', 0),
            new NetworkRule('/pagead2', 0),
        ];

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBeTruthy();
        expect(resultRule!.getText()).toBe('*$script,redirect-rule=noopjs,domain=example.org');
    });

    it('checks if redirect and redirect-rule modifiers are ok together', () => {
        const ruleTexts = [
            '||example.org^$redirect-rule=noopjs',
            '||example.org^$redirect=noopjs',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getBasicResult();
        expect(found).not.toBeNull();
        expect(found!.getText()).toBe('||example.org^$redirect=noopjs');
    });
});

describe('TestNewMatchingResult - removeparam rules', () => {
    it('works if removeparam rules are found', () => {
        const rules = [
            new NetworkRule('||example.org^$removeparam=/p1|p2/', 0),
        ];

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveParamRules();
        expect(found.length).toBe(rules.length);
    });

    it('works if allowlisted removeparam filter with same option is omitted', () => {
        const ruleTexts = [
            '||example.org^$removeparam=p0',
            '||example.org^$removeparam=p1',
            '@@||example.org^$removeparam=p1',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveParamRules();
        expect(found.length).toBe(2);
        expect(found.filter((x) => x.getText() === '||example.org^$removeparam=p0')).toHaveLength(1);
        expect(found.filter((x) => x.getText() === '@@||example.org^$removeparam=p1')).toHaveLength(1);
    });

    it('works if important removeparam rule is more important than allowlist rule', () => {
        const ruleTexts = [
            '||example.org$important,removeparam=p1',
            '@@||example.org$removeparam=p1',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveParamRules();
        expect(found.length).toBe(1);
        expect(found.filter((x) => x.getText() === '||example.org$important,removeparam=p1')).toHaveLength(1);
    });

    it('work if @@||example.org^$removeparam will disable all $removeparam rules matching ||example.org^.', () => {
        const allowlistRule = '@@||example.org^$removeparam';
        const ruleTexts = [
            '||example.org^$removeparam=/p1|p2/',
            allowlistRule,
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveParamRules();
        expect(found.length).toBe(1);
        expect(found[0].getText()).toBe(allowlistRule);
    });

    it('works if inverted removeparam rule is found', () => {
        const rules = [
            new NetworkRule('||example.org^$removeparam=~p0', 0),
        ];

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveParamRules();
        expect(found.length).toBe(rules.length);
    });

    it('works if inverted allowlisted removeparam filter with same option is omitted', () => {
        const ruleTexts = [
            '||example.org^$removeparam=~p0',
            '||example.org^$removeparam=~p1',
            '@@||example.org^$removeparam=~p1',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveParamRules();
        expect(found.length).toBe(2);
    });
});

describe('TestNewMatchingResult - removeheader rules', () => {
    it('works if removeheader rules are found', () => {
        const rules = [
            new NetworkRule('||example.org^$removeheader=header-name', 0),
        ];

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(rules.length);
    });

    it('works if allowlisted removeheader filter with same option is omitted', () => {
        const ruleTexts = [
            '||example.org^$removeheader=h1',
            '||example.org^$removeheader=h2',
            '@@||example.org^$removeheader=h1',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(2);
    });

    it('work if @@||example.org^$removeheader will disable all $removeheader rules matching ||example.org^.', () => {
        const allowlistRule = '@@||example.org^$removeheader';
        const ruleTexts = [
            '||example.org^$removeheader=h2',
            allowlistRule,
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(1);
        expect(found[0].getText()).toBe(allowlistRule);
    });

    it('work if document allowlist rule will disable all $removeheader rules ', () => {
        const ruleTexts = [
            '||example.org^$removeheader=h2',
            '@@||example.org^$document',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(0);
    });

    it('work if urlblock allowlist rule will disable all $removeheader rules ', () => {
        const ruleTexts = [
            '||example.org^$removeheader=h2',
            '@@||example.org^$urlblock',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(0);
    });

    it('work if allowlist rule will not disable $removeheader rules ', () => {
        const ruleTexts = [
            '||example.org^$removeheader=h2',
            '@@||example.org^',
        ];

        const rules = ruleTexts.map((rule) => new NetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(1);
    });
});
