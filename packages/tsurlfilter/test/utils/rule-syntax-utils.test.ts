import { describe, expect, it } from 'vitest';

import { RuleSyntaxUtils } from '../../src/utils/rule-syntax-utils';

describe('RuleSyntaxUtils', () => {
    it('removes rules matched by permitted domains', () => {
        const cosmeticRule = 'example.org##h1';
        const nonMatchingCosmeticRule = 'example.com##h1';
        const networkRule = '||example.org/favicon.ico^$domain=example.org';
        const nonMatchingNetworkRule = '||example.org/favicon.ico^$domain=example.com';

        const domain = 'https://example.org/path';

        expect(RuleSyntaxUtils.isRuleForUrl(cosmeticRule, domain)).toBeTruthy();
        expect(RuleSyntaxUtils.isRuleForUrl(nonMatchingCosmeticRule, domain)).toBeFalsy();
        expect(RuleSyntaxUtils.isRuleForUrl(networkRule, domain)).toBeTruthy();
        expect(RuleSyntaxUtils.isRuleForUrl(nonMatchingNetworkRule, domain)).toBeFalsy();
    });

    it('removes rules matched by permitted third-level domains', () => {
        const cosmeticRule = 'subdomain.example.org##h1';
        const nonMatchingCosmeticRule = 'subdomain.example.com##h1';
        const networkRule = '||example.org/favicon.ico^$domain=subdomain.example.org';
        const nonMatchingNetworkRule = '||example.org/favicon.ico^$domain=subdomain.example.com';

        const url = 'https://subdomain.example.org/path';

        expect(RuleSyntaxUtils.isRuleForUrl(cosmeticRule, url)).toBeTruthy();
        expect(RuleSyntaxUtils.isRuleForUrl(nonMatchingCosmeticRule, url)).toBeFalsy();
        expect(RuleSyntaxUtils.isRuleForUrl(networkRule, url)).toBeTruthy();
        expect(RuleSyntaxUtils.isRuleForUrl(nonMatchingNetworkRule, url)).toBeFalsy();
    });
});
