import { CosmeticRuleType, CosmeticRule } from '../src/cosmetic-rule';

describe('Element hiding rules constructor', () => {
    it('works if it creates element hiding rules', () => {
        const rule = new CosmeticRule('##.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getPermittedDomains()).toEqual(null);
        expect(rule.getRestrictedDomains()).toEqual(null);
        expect(rule.getFilterListId()).toEqual(0);
        expect(rule.getText()).toEqual('##.banner');
        expect(rule.getContent()).toEqual('.banner');
        expect(rule.isWhitelist()).toEqual(false);
    });

    it('works if it parses domains properly', () => {
        const rule = new CosmeticRule('example.org,~sub.example.org##banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);
        expect(rule.getContent()).toEqual('banner');

        const permittedDomains = rule.getPermittedDomains()!;
        const restrictedDomains = rule.getRestrictedDomains()!;
        expect(permittedDomains[0]).toEqual('example.org');
        expect(restrictedDomains[0]).toEqual('sub.example.org');
    });

    it('works if it creates whitelist element hiding rules', () => {
        const rule = new CosmeticRule('example.org#@#.banner', 0);
        expect(rule.getType()).toEqual(CosmeticRuleType.ElementHiding);

        const permittedDomains = rule.getPermittedDomains();
        expect(permittedDomains).not.toEqual(null);
        expect(permittedDomains![0]).toEqual('example.org');
        expect(rule.isWhitelist()).toEqual(true);
    });

    it('works if it verifies rules properly', () => {
        expect(() => {
            new CosmeticRule('||example.org^', 0);
        }).toThrowError(/This is not a cosmetic rule/);

        expect(() => {
            new CosmeticRule('example.org## ', 0);
        }).toThrowError(/Empty rule content/);

        expect(() => {
            new CosmeticRule('#@#.banner', 0);
        }).toThrowError(/Whitelist rule must have at least one domain specified/);
    });
});

describe('CosmeticRule match', () => {
    it('works if it matches wide rules', () => {
        const rule = new CosmeticRule('##banner', 0);
        expect(rule.match('example.org')).toEqual(true);
    });

    it('works if it matches domain restrictions properly', () => {
        const rule = new CosmeticRule('example.org,~sub.example.org##banner', 0);
        expect(rule.match('example.org')).toEqual(true);
        expect(rule.match('test.example.org')).toEqual(true);
        expect(rule.match('testexample.org')).toEqual(false);
        expect(rule.match('sub.example.org')).toEqual(false);
        expect(rule.match('sub.sub.example.org')).toEqual(false);
    });
});
