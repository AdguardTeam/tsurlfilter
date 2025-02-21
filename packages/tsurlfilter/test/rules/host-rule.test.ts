import { describe, it, expect } from 'vitest';
import { HostRuleParser, type HostRule as HostRuleNode } from '@adguard/agtree';
import { isString } from 'lodash-es';

import { HostRule as HostRuleOriginal } from '../../src/rules/host-rule';

class HostRule extends HostRuleOriginal {
    constructor(rule: string | HostRuleNode, filterListId: number, ruleIndex?: number) {
        let node: HostRuleNode;

        if (isString(rule)) {
            node = HostRuleParser.parse(rule.trim());
        } else {
            node = rule;
        }

        super(node, filterListId, ruleIndex);
    }
}

describe('Constructor', () => {
    it('works when it parses the basic rules properly', () => {
        let ruleText = '127.0.0.1       thishost.mydomain.org  thishost';
        let rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getIp()).toEqual('127.0.0.1');
        expect(rule.getHostnames()).toHaveLength(2);
        expect(rule.getHostnames()).toContain('thishost.mydomain.org');
        expect(rule.getHostnames()).toContain('thishost');

        ruleText = '209.237.226.90  www.opensource.org';
        rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getIp()).toEqual('209.237.226.90');
        expect(rule.getHostnames()).toHaveLength(1);
        expect(rule.getHostnames()).toContain('www.opensource.org');

        ruleText = '::1             localhost ip6-localhost ip6-loopback';
        rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getIp()).toEqual('::1');
        expect(rule.getHostnames()).toHaveLength(3);
        expect(rule.getHostnames()).toContain('localhost');
        expect(rule.getHostnames()).toContain('ip6-localhost');
        expect(rule.getHostnames()).toContain('ip6-loopback');

        ruleText = 'example.org';
        rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getIp()).toEqual('0.0.0.0');
        expect(rule.getHostnames()).toHaveLength(1);
        expect(rule.getHostnames()).toContain('example.org');

        ruleText = '0.0.0.0 www.ruclicks.com  #[clicksagent.com]';
        rule = new HostRule(ruleText, 1);
        expect(rule.getFilterListId()).toEqual(1);
        expect(rule.getIp()).toEqual('0.0.0.0');
        expect(rule.getHostnames()).toHaveLength(1);
        expect(rule.getHostnames()).toContain('www.ruclicks.com');

        ruleText = '#::1             localhost ip6-localhost ip6-loopback';
        expect(() => new HostRule(ruleText, 1)).toThrowError();

        ruleText = '';
        expect(() => new HostRule(ruleText, 1)).toThrowError();

        ruleText = 'invalidhost.';
        expect(() => new HostRule(ruleText, 1)).toThrowError();

        ruleText = '999.1.1.1 host.com';
        expect(() => new HostRule(ruleText, 1)).toThrowError();

        ruleText = '_prebid_';
        expect(() => new HostRule(ruleText, 1)).toThrowError();

        ruleText = '_728x90.';
        expect(() => new HostRule(ruleText, 1)).toThrowError();

        ruleText = '_prebid._';
        expect(() => new HostRule(ruleText, 1)).toThrowError();
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
