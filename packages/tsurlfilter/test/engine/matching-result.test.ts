import { describe, it, expect } from 'vitest';
import {
    MatchingResult,
    CosmeticOption,
    StealthOptionName,
    type NetworkRule,
} from '../../src';
import { createNetworkRule } from '../helpers/rule-creator';

describe('MatchingResult constructor', () => {
    it('works if basic rule is found', () => {
        const ruleText = '||example.org^';
        const rules = [createNetworkRule(ruleText, 0)];

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        expect(result.getCookieRules()).toHaveLength(0);
        expect(result.getCspRules()).toHaveLength(0);
        expect(result.getRemoveParamRules()).toHaveLength(0);
        expect(result.getReplaceRules()).toHaveLength(0);
        expect(result.basicRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult).toMatchNetworkRule(createNetworkRule(ruleText, 0));
    });

    it('works if allowlist rule is found', () => {
        const ruleText = '||example.org^';
        const sourceRuleText = '@@||example.com^$document';

        const rules = [createNetworkRule(ruleText, 0)];
        const sourceRule = createNetworkRule(sourceRuleText, 0);

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult).toMatchNetworkRule(createNetworkRule(sourceRuleText, 0));
    });

    it('works if document-level rule has lower priority than basic rule', () => {
        const ruleText = '||example.com^$important';
        const sourceRuleText = '@@||example.com^$document';

        const rules = [createNetworkRule(ruleText, 0)];
        const sourceRule = createNetworkRule(sourceRuleText, 0);

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeTruthy();
        expect(result.documentRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toMatchNetworkRule(createNetworkRule(ruleText, 0));
    });

    it('works if allowlist document-level rule is found', () => {
        const ruleText = '||example.org^';
        const sourceRuleText = '@@||example.com^$urlblock';

        const rules = [createNetworkRule(ruleText, 0)];
        const sourceRule = createNetworkRule(sourceRuleText, 0);

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult).toMatchNetworkRule(createNetworkRule(sourceRuleText, 0));
    });

    it('works if allowlist non-document-level rule is not found', () => {
        const sourceRuleText = '@@||example.com^$generichide';
        const sourceRule = createNetworkRule(sourceRuleText, 0);

        const result = new MatchingResult([], sourceRule);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.cosmeticExceptionRule).toBeNull();
        expect(result.documentRule).toBeTruthy();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeNull();
    });
});

describe('TestGetCosmeticOption', () => {
    let rules: NetworkRule[];
    let sourceRule: NetworkRule | null = null;

    it('works in simple case - no limitations', () => {
        rules = [createNetworkRule('||example.org^', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionAll);
    });

    it('works with source allowlist rule and blocking rule', () => {
        rules = [createNetworkRule('||example.org^', 0)];
        const allowlistSourceRule = createNetworkRule('@@||another.org^$document,important', 0);

        const result = new MatchingResult(rules, allowlistSourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeDefined();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionNone);
    });

    it('works with $generichide modifier', () => {
        rules = [createNetworkRule('@@||example.org^$generichide', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionSpecificCSS
            | CosmeticOption.CosmeticOptionJS
            | CosmeticOption.CosmeticOptionHtml,
        );
    });

    it('works with $specifichide modifier', () => {
        rules = [createNetworkRule('@@||example.org^$specifichide', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionGenericCSS
            | CosmeticOption.CosmeticOptionJS
            | CosmeticOption.CosmeticOptionHtml,
        );
    });

    it('works with $jsinject modifier', () => {
        rules = [createNetworkRule('@@||example.org^$jsinject', 0)];

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
        rules = [createNetworkRule('@@||example.org^$elemhide', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionJS | CosmeticOption.CosmeticOptionHtml);
    });

    it('works with elemhide modifier and replace modifier', () => {
        rules = [
            createNetworkRule('||example.org^$replace=/test/test/', 0),
            createNetworkRule('@@||example.org^$elemhide', 0),
        ];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionJS | CosmeticOption.CosmeticOptionHtml);
    });

    it('works with $content modifier', () => {
        rules = [createNetworkRule('@@||example.org^$content', 0)];

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
        rules = [createNetworkRule('@@||example.org^$document', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeDefined();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionNone);
    });

    it('works with $all modifier', () => {
        rules = [createNetworkRule('||example.org^$all', 0)];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeTruthy();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionAll);
    });

    it('works with source allowlist rule and $all blocking rule', () => {
        rules = [createNetworkRule('||example.org^$all', 0)];
        const allowlistSourceRule = createNetworkRule('@@||example.org^$document', 0);

        const result = new MatchingResult(rules, allowlistSourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeDefined();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionNone);
    });

    it('works with $all modifier and specifichide allowlist rule', () => {
        rules = [
            createNetworkRule('||example.org^$all', 0),
            createNetworkRule('@@||example.org^$specifichide', 0),
        ];

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeDefined();
        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionAll ^ CosmeticOption.CosmeticOptionSpecificCSS,
        );
    });

    it('works if document-level rule has lower priority than basic rule', () => {
        const ruleText = '||example.com^$important';
        const sourceRuleText = '@@||example.com^$document';

        rules = [createNetworkRule(ruleText, 0)];
        sourceRule = createNetworkRule(sourceRuleText, 0);

        const result = new MatchingResult(rules, sourceRule);

        expect(result).toBeTruthy();
        expect(result.getCosmeticOption()).toBeDefined();
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionAll);
    });
});

describe('MatchingResult constructor handling badfilter modifier', () => {
    it('works if badfilter is ok', () => {
        const rules = [
            createNetworkRule('||example.org^', 0),
            createNetworkRule('||example.org^$badfilter', 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
    });

    it('works if badfilter allowlist is ok', () => {
        const rules = [
            createNetworkRule('||example.org^', 0),
            createNetworkRule('@@||example.org^', 0),
            createNetworkRule('@@||example.org^$badfilter', 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        expect(result.basicRule).toBeTruthy();
        expect(result.documentRule).toBeNull();

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult).toMatchNetworkRule(createNetworkRule('||example.org^', 0));
    });

    it('checks badfilter for a distinct domain', () => {
        const rules = [
            createNetworkRule('/some$domain=example.com|example.org', 0),
            createNetworkRule('/some$domain=example.com,badfilter', 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result.basicRule).toBeNull();
    });

    it('checks badfilter for a few domains', () => {
        const rules = [
            createNetworkRule('/some$domain=example.com|example.org|example.test', 0),
            createNetworkRule('/some$domain=example.com|example.org,badfilter', 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result.basicRule).toBeNull();
    });

    it('checks badfilter could not be applied - negated domain', () => {
        const rules = [
            createNetworkRule('/some$domain=example.com|example.org|~negated.com', 0),
            createNetworkRule('/some$domain=example.com,badfilter', 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getPermittedDomains()).toHaveLength(2);
        expect(result.basicRule!.getPermittedDomains()).toContain('example.com');
    });
});

describe('MatchingResult constructor handling csp rules', () => {
    const cspRule = '||example.org^$third-party,csp=connect-src \'none\',domain=~example.com|test.com';
    const directiveAllowlistRule = '@@||example.org^$csp=connect-src \'none\'';
    const globalAllowlistRule = '@@||example.org^$csp';
    const directiveMissAllowlistRule = '@@||example.org^$csp=frame-src \'none\'';

    it('works if csp rule is found', () => {
        const rules = [createNetworkRule(cspRule, 0)];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0]).toMatchNetworkRule(createNetworkRule(cspRule, 0));
    });

    it('works if csp directive allowlist rule is found', () => {
        const rules = [
            createNetworkRule(cspRule, 0),
            createNetworkRule(directiveAllowlistRule, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0]).toMatchNetworkRule(createNetworkRule(directiveAllowlistRule, 0));
    });

    it('works if csp global allowlist rule is found', () => {
        const rules = [
            createNetworkRule(cspRule, 0),
            createNetworkRule(directiveAllowlistRule, 0),
            createNetworkRule(globalAllowlistRule, 0),
        ];

        const result = new MatchingResult(rules, null);
        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0]).toMatchNetworkRule(createNetworkRule(globalAllowlistRule, 0));
    });

    it('works if csp wrong directive allowlist rule is not found', () => {
        const rules = [
            createNetworkRule(cspRule, 0),
            createNetworkRule(directiveMissAllowlistRule, 0),
        ];

        const result = new MatchingResult(rules, null);
        expect(result).toBeTruthy();
        const cspRules = result.getCspRules();
        expect(cspRules.length).toBe(1);
        expect(cspRules[0]).toMatchNetworkRule(createNetworkRule(cspRule, 0));
    });
});

describe('MatchingResult constructor handling $permissions rules', () => {
    const makeMatchingResult = (ruleTexts: string[]) => {
        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));
        return {
            expectedRules: rules,
            matchingResult: new MatchingResult(rules, null),
        };
    };

    it('finds $permissions rule', () => {
        const { expectedRules, matchingResult } = makeMatchingResult([
            String.raw`/ads^$permissions=sync-xhr=()\,accelerometer=self,domain=example.org`,
        ]);
        expect(matchingResult).toBeTruthy();

        const permissionsRules = matchingResult.getPermissionsPolicyRules();
        expect(permissionsRules.length).toBe(1);
        expect(permissionsRules[0]).toEqual(expectedRules[0]);
    });

    it('finds global allowlist rule', () => {
        const { expectedRules, matchingResult } = makeMatchingResult([
            '||example.*^$permissions=sync-xhr=()|accelerometer=self,domain=example.org',
            '||example.com$permissions=geolocation=(),subdocument',
            '@@||example.com$permissions,subdocument',
            '@@||example.org^$permissions',
        ]);
        expect(matchingResult).toBeTruthy();

        const permissionsRules = matchingResult.getPermissionsPolicyRules();
        expect(permissionsRules.length).toBe(1);
        expect(permissionsRules[0]).toBe(expectedRules[3]);
    });

    it('filters blocking and allowlist rules by modifier value', () => {
        const { expectedRules, matchingResult } = makeMatchingResult([
            '/ads^$permissions=sync-xhr=(self)',
            '/ads^$permissions=sync-xhr=("https://example.com")|accelerometer=self',
            '@@||$permissions=sync-xhr=("https://example.com")|accelerometer=self',
        ]);
        expect(matchingResult).toBeTruthy();

        const permissionsRules = matchingResult.getPermissionsPolicyRules();
        expect(permissionsRules.length).toBe(2);
        expect(permissionsRules[0]).toBe(expectedRules[0]);
        expect(permissionsRules[1]).toBe(expectedRules[2]);
        // Allowlisted rule gets removed from the result
        expect(!permissionsRules.find((r) => r === expectedRules[1])).toBeTruthy();
    });

    it('filters blocking and allowlist rules by modifier value', () => {
        const { expectedRules, matchingResult } = makeMatchingResult([
            '/ads^$permissions=sync-xhr=(self)',
            '/ads^$permissions=sync-xhr=("https://example.com")|accelerometer=self',
            '@@||$permissions=sync-xhr=("https://example.com")|accelerometer=self',
        ]);
        expect(matchingResult).toBeTruthy();

        const permissionsRules = matchingResult.getPermissionsPolicyRules();
        expect(permissionsRules.length).toBe(2);
        expect(permissionsRules[0]).toBe(expectedRules[0]);
        expect(permissionsRules[1]).toBe(expectedRules[2]);
        // Allowlisted rule gets removed from the result
        expect(!permissionsRules.find((r) => r === expectedRules[1])).toBeTruthy();
    });

    it('should handle global allowlist for subdocument', () => {
        const { expectedRules, matchingResult } = makeMatchingResult([
            '||example.com$permissions=autoplay=()', // should be added
            '||example.com$permissions=geolocation=(),subdocument', // should be removed
            '||example.com$permissions=sync-xhr=(),subdocument', // should be removed
            '@@||example.com$permissions,subdocument', // should be added
        ]);
        expect(matchingResult).toBeTruthy();

        const permissionsRules = matchingResult.getPermissionsPolicyRules();

        expect(permissionsRules.length).toBe(2);
        expect(permissionsRules[0]).toBe(expectedRules[0]);
        expect(permissionsRules[1]).toBe(expectedRules[3]);
        // Allowlisted rule gets removed from the result
        expect(!permissionsRules.find((r) => r === expectedRules[1])).toBeTruthy();
    });
});

describe('MatchingResult constructor handling replace rules', () => {
    it('works if replace rules are found', () => {
        const rules = [
            createNetworkRule('||example.org^$replace=/test/test1/g', 0),
            createNetworkRule('||example.org^$replace=/test1/test2/g', 0),
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

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

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

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

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

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const replaceRules = result.getReplaceRules();
        expect(replaceRules.length).toBe(1);

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult).toMatchNetworkRule(createNetworkRule(ruleTexts[1], 0));
    });

    it('work if @@||example.org^$document will be found', () => {
        const ruleTexts = [
            '||example.org^$replace=/test1/test2/g',
            '@@||example.org^$document',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const replaceRules = result.getReplaceRules();
        expect(replaceRules.length).toBe(1);

        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult).toMatchNetworkRule(createNetworkRule(ruleTexts[1], 0));
        expect(result.cosmeticExceptionRule).toMatchNetworkRule(createNetworkRule(ruleTexts[1], 0));
    });

    it('checks only $document and $content rules disable $replace', () => {
        const ruleTexts = [
            '||example.org^$replace=/test1/test2/g',
            '@@||example.org^$genericblock',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);

        expect(result.getReplaceRules()).toHaveLength(1);
        expect(result.getBasicResult()).toBeNull();
    });
});

describe('MatchingResult constructor handling cookie rules', () => {
    const cookieRuleTextOne = '$cookie=/__utm[a-z]/';
    const cookieRuleTextTwo = '$cookie=__cfduid';
    const cookieRuleAllowlistTextOne = '@@$cookie=/__utm[a-z]/';
    const cookieRuleAllowlistTextTwo = '@@$cookie=__cfduid';
    const cookieRuleAllowlistText = '@@$cookie';
    const cookieRuleAllowlistRegexpText = '@@$cookie=/__cfd[a-z]/';

    it('works if cookie rules are found', () => {
        const rules = [
            createNetworkRule(cookieRuleTextOne, 0),
            createNetworkRule(cookieRuleTextTwo, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(rules.length);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(cookieRuleTextOne, 0));
        expect(cookieRules[1]).toMatchNetworkRule(createNetworkRule(cookieRuleTextTwo, 0));
    });

    it('works if cookie allowlist rule is ok', () => {
        const rules = [
            createNetworkRule(cookieRuleTextOne, 0),
            createNetworkRule(cookieRuleTextTwo, 0),
            createNetworkRule(cookieRuleAllowlistTextOne, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(3);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(cookieRuleAllowlistTextOne, 0));
        expect(cookieRules[1]).toMatchNetworkRule(createNetworkRule(cookieRuleTextTwo, 0));
    });

    it('works if cookie allowlist rule is ok', () => {
        const rules = [
            createNetworkRule(cookieRuleTextOne, 0),
            createNetworkRule(cookieRuleTextTwo, 0),
            createNetworkRule(cookieRuleAllowlistTextOne, 0),
            createNetworkRule(cookieRuleAllowlistTextTwo, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(4);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(cookieRuleAllowlistTextOne, 0));
        expect(cookieRules[1]).toMatchNetworkRule(createNetworkRule(cookieRuleAllowlistTextTwo, 0));
    });

    it('works if cookie allowlist all rule is ok', () => {
        const rules = [
            createNetworkRule(cookieRuleTextOne, 0),
            createNetworkRule(cookieRuleTextTwo, 0),
            createNetworkRule(cookieRuleAllowlistTextOne, 0),
            createNetworkRule(cookieRuleAllowlistTextTwo, 0),
            createNetworkRule(cookieRuleAllowlistText, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(4);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(cookieRuleAllowlistText, 0));
    });

    it('works if cookie allowlist regexp rule is ok', () => {
        const rules = [
            createNetworkRule(cookieRuleTextOne, 0),
            createNetworkRule(cookieRuleTextTwo, 0),
            createNetworkRule(cookieRuleAllowlistTextOne, 0),
            createNetworkRule(cookieRuleAllowlistRegexpText, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(4);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(cookieRuleAllowlistTextOne, 0));
        expect(cookieRules[1]).toMatchNetworkRule(createNetworkRule(cookieRuleAllowlistRegexpText, 0));
    });

    it('returns empty list if document allowlist rule added', () => {
        const documentAllowlistRule = '@@||example.com^$document';
        const rules = [
            createNetworkRule(cookieRuleTextOne, 0),
            createNetworkRule(cookieRuleTextTwo, 0),
        ];
        const sourceRule = createNetworkRule(documentAllowlistRule, 0);
        const result = new MatchingResult(rules, sourceRule);
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toEqual([]);
    });

    it('respects $cookie-$important rules', () => {
        const importBlockingRuleText = '||example.com^$cookie=test,important';
        const rules = [
            createNetworkRule('@@||example.com^$cookie=test', 0),
            createNetworkRule(importBlockingRuleText, 0),
        ];

        const result = new MatchingResult(rules, null);
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(2);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(importBlockingRuleText, 0));
    });

    it('checks $cookie rule is negated by regex allowlist', () => {
        const importBlockingRuleText = '||example.com^$cookie=test';
        const allowlistRuleText = '@@||example.com^$cookie=/test|other/';
        const rules = [
            createNetworkRule(allowlistRuleText, 0),
            createNetworkRule(importBlockingRuleText, 0),
        ];

        const result = new MatchingResult(rules, null);
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(2);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(allowlistRuleText, 0));
    });

    it('checks $cookie-$important rule negates regex allowlist', () => {
        const importBlockingRuleText = '||example.com^$cookie=test,important';
        const rules = [
            createNetworkRule('@@||example.com^$cookie=/test|other/', 0),
            createNetworkRule(importBlockingRuleText, 0),
        ];

        const result = new MatchingResult(rules, null);
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(2);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(importBlockingRuleText, 0));
    });

    it('respects $cookie-$important rules - empty option', () => {
        const importBlockingRuleText = '||example.com^$cookie,important';
        const rules = [
            createNetworkRule('@@||example.com^$cookie', 0),
            createNetworkRule(importBlockingRuleText, 0),
        ];

        const result = new MatchingResult(rules, null);
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(2);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(importBlockingRuleText, 0));
    });

    it('respects $cookie-$important rules - allowlist empty option', () => {
        const importBlockingRuleText = '||example.com^$cookie=test,important';
        const rules = [
            createNetworkRule('@@||example.com^$cookie', 0),
            createNetworkRule(importBlockingRuleText, 0),
        ];

        const result = new MatchingResult(rules, null);
        const cookieRules = result.getCookieRules();
        expect(cookieRules).toHaveLength(2);
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(importBlockingRuleText, 0));
    });
});

describe('MatchingResult constructor handling stealth modifier', () => {
    it('works if stealth rule is found', () => {
        const ruleText = '@@||example.org^$stealth';
        const rule = createNetworkRule(ruleText, 0);
        const rules = [rule];

        const result = new MatchingResult(rules, null);
        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.stealthRules).not.toBeNull();

        const stealthRule = result.getStealthRule();
        expect(stealthRule).toBe(rule);
        expect(stealthRule).toMatchNetworkRule(createNetworkRule(ruleText, 0));
    });

    it('manages stealth rules with single and multiple options', () => {
        const singleOptionRule = createNetworkRule(
            `@@||example.org^$stealth=${StealthOptionName.XClientData}`,
            0,
        );
        const multipleOptionsRule = createNetworkRule(
            `@@||example.org^$stealth=${StealthOptionName.HideReferrer}|${StealthOptionName.DoNotTrack}`,
            0,
        );
        const rules = [
            singleOptionRule,
            multipleOptionsRule,
        ];

        const result = new MatchingResult(rules, null);
        expect(result).toBeTruthy();
        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.stealthRules).not.toBeNull();

        expect(result.getStealthRule(StealthOptionName.XClientData)).toBe(singleOptionRule);
        expect(result.getStealthRule(StealthOptionName.HideReferrer)).toBe(multipleOptionsRule);
        expect(result.getStealthRule(StealthOptionName.DoNotTrack)).toBe(multipleOptionsRule);
    });

    it('works if stealth rule is found with an other rule', () => {
        const ruleText = '||example.org^';
        const stealthRuleText = '@@||example.org^$stealth';
        const rules = [
            createNetworkRule(ruleText, 0),
            createNetworkRule(stealthRuleText, 0),
        ];

        const result = new MatchingResult(rules, null);

        expect(result).toBeTruthy();
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule).toMatchNetworkRule(createNetworkRule(ruleText, 0));
        expect(result.documentRule).toBeNull();
        expect(result.stealthRules).not.toBeNull();
        const rule = result.stealthRules![0];
        expect(rule).toMatchNetworkRule(createNetworkRule(stealthRuleText, 0));
    });
});

describe('MatchingResult constructor handling redirect rules', () => {
    it('works if redirect rules are found', () => {
        const rules = [
            createNetworkRule('||8s8.eu^*fa.js$script,redirect=noopjs', 0),
            createNetworkRule('||8s8.eu^*fa.js$script', 0),
        ];

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBeTruthy();
        expect(resultRule).toMatchNetworkRule(createNetworkRule('||8s8.eu^*fa.js$script,redirect=noopjs', 0));
    });

    it('works if allowlisted redirect rule with same option is omitted', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '@@||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=2x2-transparent.png,image',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBeTruthy();
        expect(resultRule).toMatchNetworkRule(createNetworkRule('||ya.ru$redirect=2x2-transparent.png,image', 0));
    });

    it('works if allowlist rule omit all resource types', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=1x1-transparent.gif',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toBeNull();
    });

    it('checks that unrelated exception does not exclude other blocking rules', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=2x2-transparent.png',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBeTruthy();
        expect(resultRule).toMatchNetworkRule(createNetworkRule('||ya.ru$redirect=1x1-transparent.gif', 0));
    });

    it('checks that it is possible to exclude all redirects with `@@$redirect` rule', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$redirect',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toBeNull();
    });

    // eslint-disable-next-line max-len
    it('checks that it is not possible to exclude all redirects with simple allowlist rule without using $important', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$document',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule('@@||ya.ru$document', 0));
    });

    it('checks that it is possible to exclude all redirects with important allowlist rule', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$document,important',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule('@@||ya.ru$document,important', 0));
    });

    it('checks that important redirect rule negates allowlist rule', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png,important',
            '@@||ya.ru$document',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toMatchNetworkRule(
            createNetworkRule('||ya.ru$redirect=2x2-transparent.png,important', 0),
        );
    });

    it('checks that important allowlist rule negates important redirect rule', () => {
        const ruleTexts = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png,important',
            '@@||ya.ru$document,important',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule('@@||ya.ru$document,important', 0));
    });

    it('checks that common allowlist rule negates redirect rule without $important', () => {
        const ruleTexts = [
            '||*/redirect-exception-test.js$redirect=noopjs',
            '@@||*/redirect-exception-test.js',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule('@@||*/redirect-exception-test.js', 0));
    });

    it('checks that common allowlist rule not negates redirect rule with $important', () => {
        const ruleTexts = [
            '||*/redirect-exception-test.js$redirect=noopjs,important',
            '@@||*/redirect-exception-test.js',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toEqual(
            createNetworkRule('||*/redirect-exception-test.js$redirect=noopjs,important', 0),
        );
    });

    it('checks that common allowlist rule with $important negates redirect rule', () => {
        const ruleTexts = [
            '||*/redirect-exception-test.js$redirect=noopjs',
            '@@||*/redirect-exception-test.js$important',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toMatchNetworkRule(
            createNetworkRule('@@||*/redirect-exception-test.js$important', 0),
        );
    });

    it('checks that redirect allowlist rule negates redirect rule', () => {
        const ruleTexts = [
            '||*/redirect-exception-test.js$redirect=noopjs',
            '@@||*/redirect-exception-test.js$redirect',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        expect(result.getBasicResult()).toBeNull();
    });
});

describe('MatchingResult constructor handling redirect-rule rules', () => {
    it('works if redirect-rule rule is found', () => {
        const rules = [
            createNetworkRule('*$script,redirect-rule=noopjs,domain=example.org', 0),
            createNetworkRule('/pagead2', 0),
        ];

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBeTruthy();
        expect(resultRule).toMatchNetworkRule(createNetworkRule('*$script,redirect-rule=noopjs,domain=example.org', 0));
    });

    it('checks if redirect and redirect-rule modifiers are ok together', () => {
        const ruleTexts = [
            '||example.org^$redirect-rule=noopjs',
            '||example.org^$redirect=noopjs',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getBasicResult();
        expect(found).not.toBeNull();
        expect(found).toMatchNetworkRule(createNetworkRule('||example.org^$redirect=noopjs', 0));
    });

    it('checks if redirect and redirect-rule modifiers are ok together with blocking rule', () => {
        const ruleTexts = [
            '||example.org',
            '||example.org^$redirect-rule=noopjs',
            '||example.org^$redirect=noopjs',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getBasicResult();
        expect(found).not.toBeNull();
        expect(found).toMatchNetworkRule(createNetworkRule('||example.org^$redirect=noopjs', 0));
    });

    it('checks if redirect and redirect-rule modifiers are ok together with different priorities', () => {
        const ruleTexts = [
            '||ya.ru',
            '||ya.ru$redirect=nooptext',
            '||ya.ru$redirect=nooptext,image',
            '||ya.ru$redirect=nooptext,image,document',
            '||ya.ru$redirect-rule=nooptext',
            '||ya.ru$redirect-rule=nooptext,image',
            '||ya.ru$redirect-rule=nooptext,image,document',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getBasicResult();
        expect(found).not.toBeNull();
        expect(found).toMatchNetworkRule(createNetworkRule('||ya.ru$redirect=nooptext,image', 0));
    });

    it('returns redirect-rule if there is blocking rule', () => {
        const blockingRule = createNetworkRule('!/googleads.$~script,domain=~github.com|~github.io', 0);
        const redirectRuleRule = createNetworkRule(
            '||googleads.g.doubleclick.net/pagead/id^$xmlhttprequest,redirect=nooptext',
            0,
        );
        const rules = [
            blockingRule,
            redirectRuleRule,
        ];

        const result = new MatchingResult(rules, null);
        const resultRule = result.getBasicResult();
        expect(resultRule).toBe(redirectRuleRule);
    });
});

describe('MatchingResult constructor handling removeparam rules', () => {
    it('works if removeparam rules are found', () => {
        const rules = [
            createNetworkRule('||example.org^$removeparam=/p1|p2/', 0),
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

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveParamRules();
        expect(found.length).toBe(2);
        expect(found.filter((x) => x.getAdvancedModifier()?.getValue() === 'p0')).toHaveLength(1);
        expect(found.filter((x) => x.getAdvancedModifier()?.getValue() === 'p1')).toHaveLength(1);
    });

    it('works if important removeparam rule is more important than allowlist rule', () => {
        const ruleTexts = [
            '||example.org$important,removeparam=p1',
            '@@||example.org$removeparam=p1',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveParamRules();
        expect(found.length).toBe(1);
        expect(found.filter((x) => x.getAdvancedModifier()?.getValue() === 'p1')).toHaveLength(1);
    });

    it('work if @@||example.org^$removeparam will disable all $removeparam rules matching ||example.org^.', () => {
        const allowlistRule = '@@||example.org^$removeparam';
        const ruleTexts = [
            '||example.org^$removeparam=/p1|p2/',
            allowlistRule,
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveParamRules();
        expect(found.length).toBe(1);
        expect(found[0]).toMatchNetworkRule(createNetworkRule(allowlistRule, 0));
    });

    it('works if inverted removeparam rule is found', () => {
        const rules = [
            createNetworkRule('||example.org^$removeparam=~p0', 0),
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

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

        const result = new MatchingResult(rules, null);
        const found = result.getRemoveParamRules();
        expect(found.length).toBe(2);
    });
});

describe('MatchingResult constructor handling removeheader rules', () => {
    it('works if removeheader rules are found', () => {
        const rules = [
            createNetworkRule('||example.org^$removeheader=header-name', 0),
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

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));

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

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(1);
        expect(found[0]).toMatchNetworkRule(createNetworkRule(allowlistRule, 0));
    });

    it('work if document allowlist rule will disable all $removeheader rules ', () => {
        const ruleTexts = [
            '||example.org^$removeheader=h2',
            '@@||example.org^$document',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(0);
    });

    it('work if urlblock allowlist rule will disable all $removeheader rules ', () => {
        const ruleTexts = [
            '||example.org^$removeheader=h2',
            '@@||example.org^$urlblock',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(0);
    });

    it('work if allowlist rule will not disable $removeheader rules ', () => {
        const ruleTexts = [
            '||example.org^$removeheader=h2',
            '@@||example.org^',
        ];

        const rules = ruleTexts.map((rule) => createNetworkRule(rule, 0));
        const result = new MatchingResult(rules, null);

        const found = result.getRemoveHeaderRules();
        expect(found.length).toBe(1);
    });
});

describe('MatchingResult constructor handling cosmetic exception rules', () => {
    it('correctly saves cosmetic exception rule', () => {
        // $generichide
        let basicRuleText = '||platform.twitter.com/widgets/tweet_button$third-party';
        let cosmeticExceptionRuleText = '@@||twitter.com^$generichide';
        let rules = [createNetworkRule(basicRuleText, 0), createNetworkRule(cosmeticExceptionRuleText, 0)];
        let result = new MatchingResult(rules, null);

        expect(result.basicRule).toMatchNetworkRule(createNetworkRule(basicRuleText, 0));

        expect(result.cosmeticExceptionRule).toMatchNetworkRule(createNetworkRule(cosmeticExceptionRuleText, 0));
        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionSpecificCSS
            | CosmeticOption.CosmeticOptionJS
            | CosmeticOption.CosmeticOptionHtml,
        );

        // $specific hide
        basicRuleText = '||safeframe.googlesyndication.com$subdocument,domain=clien.net';
        cosmeticExceptionRuleText = '@@||clien.net$specifichide';
        rules = [createNetworkRule(basicRuleText, 0), createNetworkRule(cosmeticExceptionRuleText, 0)];
        result = new MatchingResult(rules, null);

        expect(result.basicRule).toMatchNetworkRule(createNetworkRule(basicRuleText, 0));
        expect(result.cosmeticExceptionRule).toMatchNetworkRule(createNetworkRule(cosmeticExceptionRuleText, 0));
        expect(result.getCosmeticOption()).toEqual(
            CosmeticOption.CosmeticOptionGenericCSS
            | CosmeticOption.CosmeticOptionJS
            | CosmeticOption.CosmeticOptionHtml,
        );

        // $important should not matter, as cosmetic option modifier must be used separately
        basicRuleText = '||facebook.com/plugins/$domain=~facebook.com';
        cosmeticExceptionRuleText = '@@||facebook.com^$elemhide,important';
        rules = [createNetworkRule(basicRuleText, 0), createNetworkRule(cosmeticExceptionRuleText, 0)];
        result = new MatchingResult(rules, null);

        expect(result.basicRule).toMatchNetworkRule(createNetworkRule(basicRuleText, 0));
        expect(result.cosmeticExceptionRule).toMatchNetworkRule(createNetworkRule(cosmeticExceptionRuleText, 0));
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionJS | CosmeticOption.CosmeticOptionHtml);
    });

    it('correctly picks from multiple cosmetic option rules', () => {
        const basicRuleText = '||platform.twitter.com/widgets/tweet_button$third-party';
        const genericHideRule = '@@||twitter.com^$generichide';
        const mixedRule = '@@||twitter.com^$elemhide,jsinject';

        const rules = [
            createNetworkRule(basicRuleText, 0),
            createNetworkRule(genericHideRule, 0),
            createNetworkRule(mixedRule, 0),
        ];
        const result = new MatchingResult(rules, null);

        expect(result.basicRule).toMatchNetworkRule(createNetworkRule(basicRuleText, 0));

        expect(result.cosmeticExceptionRule).toMatchNetworkRule(createNetworkRule(mixedRule, 0));
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionHtml);
    });

    it('places allowlist $document rule in both .cosmeticExceptionRule and .basicRule slots', () => {
        const rule = '@@||example.org$document';

        const result = new MatchingResult([createNetworkRule(rule, 0)], null);

        expect(result.basicRule).toMatchNetworkRule(createNetworkRule(rule, 0));

        expect(result.cosmeticExceptionRule).toMatchNetworkRule(createNetworkRule(rule, 0));
        expect(result.getCosmeticOption()).toEqual(CosmeticOption.CosmeticOptionNone);
    });
});

describe('getResponseHeadersResult', () => {
    it('finds $header rule with matching header value', () => {
        const matchingRule = '||example.org/r/w64$header=Content-Length:138';
        const nonMatchingRule = '||example.org/r/w64$header=Etag:yes';
        const rules = [
            createNetworkRule(matchingRule, 0),
            createNetworkRule(nonMatchingRule, 0),
        ];
        const responseHeaders = [
            {
                name: 'Content-Length',
                value: '138',
            },
        ];

        const matchingResult = new MatchingResult(rules, null);
        const headersResult = matchingResult.getResponseHeadersResult(responseHeaders);
        expect(headersResult).toBeTruthy();
        expect(headersResult).toMatchNetworkRule(createNetworkRule(matchingRule, 0));
    });

    it('returns null if no rules are found', () => {
        const nonMatchingRule = '||example.org/r/w64$header=Etag:yes';
        const rules = [
            createNetworkRule(nonMatchingRule, 0),
        ];
        const responseHeaders = [
            {
                name: 'Content-Length',
                value: '138',
            },
        ];

        const matchingResult = new MatchingResult(rules, null);
        const headersResult = matchingResult.getResponseHeadersResult(responseHeaders);
        expect(headersResult).toBeNull();
    });

    it('returns allowlist rule against blocking rule', () => {
        const blockingRule = '||example.org/r/w64$header=Content-Length:138';
        const allowlistRule = '@@||example.org$header=Content-Length:138';
        const rules = [
            createNetworkRule(blockingRule, 0),
            createNetworkRule(allowlistRule, 0),
        ];
        const responseHeaders = [
            {
                name: 'Content-Length',
                value: '138',
            },
        ];

        const matchingResult = new MatchingResult(rules, null);
        const headersResult = matchingResult.getResponseHeadersResult(responseHeaders);
        expect(headersResult?.isAllowlist()).toBeTruthy();
    });

    it('returns blocking rule with higher priority against allowlist rule', () => {
        const blockingRule = '||example.org/r/w64$header=Content-Length:138,important';
        const allowlistRule = '@@||example.org$header=Content-Length:138';
        const rules = [
            createNetworkRule(blockingRule, 0),
            createNetworkRule(allowlistRule, 0),
        ];
        const responseHeaders = [
            {
                name: 'Content-Length',
                value: '138',
            },
        ];

        const matchingResult = new MatchingResult(rules, null);
        const headersResult = matchingResult.getResponseHeadersResult(responseHeaders);
        expect(headersResult?.isAllowlist()).toBeFalsy();
    });

    it('returns null when basic or document allowlist rule is present', () => {
        const headerRule = '||example.org/r/w64$header=Content-Length:138,important';
        let allowlistRule = '@@||example.org';
        const rules = [
            createNetworkRule(headerRule, 0),
            createNetworkRule(allowlistRule, 0),
        ];
        const responseHeaders = [
            {
                name: 'Content-Length',
                value: '138',
            },
        ];

        // Basic allowlist rule prevents header rule from being applied
        let matchingResult = new MatchingResult(rules, null);
        let headersResult = matchingResult.getResponseHeadersResult(responseHeaders);
        expect(headersResult).toBeNull();

        // Document allowlist rule prevents header rule from being applied
        allowlistRule = '@@||example.org^$document';
        rules[1] = createNetworkRule(allowlistRule, 0);
        matchingResult = new MatchingResult(rules, null);
        headersResult = matchingResult.getResponseHeadersResult(responseHeaders);
        expect(headersResult).toBeNull();

        // Returns null when response headers are empty
        headersResult = matchingResult.getResponseHeadersResult([]);
        expect(headersResult).toBeNull();
    });

    it('picks highest priority rule that has no allowlist counterpart from a set of rules', () => {
        const rules = [
            createNetworkRule('||example.org/r/w64$header=Content-Length:138', 0),
            createNetworkRule('@@||example.org$header=Content-Length:138', 0),
            createNetworkRule('||example.org$header=$header=etag:y,important', 0),
            createNetworkRule('|@@|example.org$header=$header=etag:y', 0),
        ];
        const responseHeaders = [
            {
                // Headers match case-insensitively
                name: 'content-length',
                value: '138',
            },
            {
                // Headers match case-insensitively
                name: 'etag',
                value: 'y',
            },
        ];

        const matchingResult = new MatchingResult(rules, null);
        const headersResult = matchingResult.getResponseHeadersResult(responseHeaders);
        expect(headersResult).toMatchNetworkRule(createNetworkRule('||example.org$header=$header=etag:y,important', 0));
    });
});
