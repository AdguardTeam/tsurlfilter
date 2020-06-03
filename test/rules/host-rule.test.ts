import { HostRule } from '../../src/rules/host-rule';

describe('Constructor', () => {
    it('works when it parses the basic rules properly', () => {
        let ruleText = '127.0.0.1       thishost.mydomain.org  thishost';
        let rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getText()).toEqual(ruleText);
        expect(rule.getIp()).toEqual('127.0.0.1');

        ruleText = '209.237.226.90  www.opensource.org';
        rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getText()).toEqual(ruleText);
        expect(rule.getIp()).toEqual('209.237.226.90');

        ruleText = '::1             localhost ip6-localhost ip6-loopback';
        rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getText()).toEqual(ruleText);
        expect(rule.getIp()).toEqual('::1');

        ruleText = 'example.org';
        rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getText()).toEqual(ruleText);
        expect(rule.getIp()).toEqual('0.0.0.0');

        ruleText = '0.0.0.0 www.ruclicks.com  #[clicksagent.com]';
        rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getText()).toEqual(ruleText);
        expect(rule.getIp()).toEqual('0.0.0.0');

        ruleText = '#::1             localhost ip6-localhost ip6-loopback';
        expect(() => {
            rule = new HostRule(ruleText, 1);
        }).toThrowError(/Invalid host rule:.+/);

        ruleText = '';
        expect(() => {
            rule = new HostRule(ruleText, 1);
        }).toThrowError(/Invalid host rule:.+/);

        ruleText = 'invalidhost.';
        expect(() => {
            rule = new HostRule(ruleText, 1);
        }).toThrowError(/Invalid host rule:.+/);
    });

    it('works when it matches rules', () => {
        let rule = new HostRule('127.0.0.1       thishost.mydomain.org  thishost', 1);
        expect(rule.match('thishost.mydomain.org')).toBeTruthy();
        expect(rule.match('thishost')).toBeTruthy();
        expect(rule.match('mydomain.org')).toBeFalsy();
        expect(rule.match('example.org')).toBeFalsy();

        rule = new HostRule('209.237.226.90  www.opensource.org', 1);
        expect(rule.match('www.opensource.org')).toBeTruthy();
        expect(rule.match('opensource.org')).toBeFalsy();
    });
});
