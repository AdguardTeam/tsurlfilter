import { describe, it, expect } from 'vitest';

import escapeStringRegexp from 'escape-string-regexp';

import { DnsEngine } from '../../src/engine-new/dns-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage-new';
import { StringRuleList } from '../../src/filterlist/string-rule-list';

describe('General DNS engine tests', () => {
    /**
     * Helper function to get the rule index from the raw filter list by the rule text.
     *
     * @param rawFilterList Raw filter list.
     * @param rule Rule text.
     *
     * @returns Rule index or -1 if the rule couldn't be found.
     */
    const getRawRuleIndex = (rawFilterList: string, rule: string): number => {
        return rawFilterList.search(new RegExp(`^${escapeStringRegexp(rule)}$`, 'm'));
    };

    it('works if empty engine is ok', () => {
        const rules: string[] = [];
        const text = rules.join('\n');
        const list = new StringRuleList(1, text, false, false, false);
        const storage = new RuleStorage([list]);
        const engine = new DnsEngine(storage);
        const result = engine.match('example.org');

        expect(result).not.toBeNull();
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks engine match', () => {
        const rules = [
            '||example.org^',
            '||example2.org/*',
            '@@||example3.org^',
            '0.0.0.0 v4.com',
            '127.0.0.1 v4.com',
            ':: v6.com',
            '127.0.0.1 v4and6.com',
            '127.0.0.2 v4and6.com',
            '::1 v4and6.com',
            '::2 v4and6.com',
        ];
        const text = rules.join('\n');
        const list = new StringRuleList(1, text, false, false, false);
        const storage = new RuleStorage([list]);
        const engine = new DnsEngine(storage);

        let result;

        result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getIndex()).toBe(getRawRuleIndex(text, '||example.org^'));
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('example2.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getIndex()).toBe(getRawRuleIndex(text, '||example2.org/*'));
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('example3.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getIndex()).toBe(getRawRuleIndex(text, '@@||example3.org^'));
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('v4.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(2);
        expect(result.hostRules[0].getIndex()).toBe(getRawRuleIndex(text, '0.0.0.0 v4.com'));
        expect(result.hostRules[1].getIndex()).toBe(getRawRuleIndex(text, '127.0.0.1 v4.com'));

        result = engine.match('v6.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(1);
        expect(result.hostRules[0].getIndex()).toBe(getRawRuleIndex(text, ':: v6.com'));

        result = engine.match('v4and6.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(4);
        expect(result.hostRules[0].getIndex()).toBe(getRawRuleIndex(text, '127.0.0.1 v4and6.com'));
        expect(result.hostRules[1].getIndex()).toBe(getRawRuleIndex(text, '127.0.0.2 v4and6.com'));
        expect(result.hostRules[2].getIndex()).toBe(getRawRuleIndex(text, '::1 v4and6.com'));
        expect(result.hostRules[3].getIndex()).toBe(getRawRuleIndex(text, '::2 v4and6.com'));

        result = engine.match('example.net');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - protocol', () => {
        const rules = [
            '://example.org',
        ];
        const list = new StringRuleList(1, rules.join('\n'), false, false, false);
        const storage = new RuleStorage([list]);
        const engine = new DnsEngine(storage);

        const result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - regex', () => {
        const rules = [
            '/^stats?\\./',
        ];
        const list = new StringRuleList(1, rules.join('\n'), false, false, false);
        const storage = new RuleStorage([list]);
        const engine = new DnsEngine(storage);

        const result = engine.match('stats.test.com');
        expect(result.basicRule).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - regex allowlist', () => {
        const rules = [
            '||stats.test.com^',
            '@@/stats?\\./',
        ];
        const list = new StringRuleList(1, rules.join('\n'), false, false, false);
        const storage = new RuleStorage([list]);
        const engine = new DnsEngine(storage);

        const result = engine.match('stats.test.com');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.isAllowlist()).toBeTruthy();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for badfilter rules', () => {
        const rules = [
            '||example.org^',
            '||example.org^$badfilter',
        ];
        const list = new StringRuleList(1, rules.join('\n'), false, false, false);
        const storage = new RuleStorage([list]);
        const engine = new DnsEngine(storage);

        const result = engine.match('example.org');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for dnsrewrite rules', () => {
        const rules = [
            '||example.org^',
            '||example.org^$dnsrewrite=1.2.3.4',
        ];
        const list = new StringRuleList(1, rules.join('\n'), false, false, false);
        const storage = new RuleStorage([list]);
        const engine = new DnsEngine(storage);

        const result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getAdvancedModifier()).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });
});
