import { RuleParser } from '@adguard/agtree/parser';
import { describe, expect, it } from 'vitest';

import { isJsInjectionRule, parseFilterList } from '../../src/common/local-script-rules-base';

describe('isJsInjectionRule', () => {
    it('returns false for null', () => {
        expect(isJsInjectionRule(null)).toBe(false);
    });

    it('returns true for a JS injection rule and narrows the type', () => {
        const rule = RuleParser.parse('example.com#%#window._foo = 1;');
        expect(isJsInjectionRule(rule)).toBe(true);
        if (isJsInjectionRule(rule)) {
            // TypeScript should know the type is JsInjectionRule here
            expect(rule.body).toBeDefined();
        }
    });

    it('returns false for a scriptlet injection rule', () => {
        const rule = RuleParser.parse('example.com#%#//scriptlet(\'log\')');
        expect(isJsInjectionRule(rule)).toBe(false);
    });

    it('returns false for an element hiding rule', () => {
        const rule = RuleParser.parse('example.com##.banner');
        expect(isJsInjectionRule(rule)).toBe(false);
    });

    it('returns false for a network rule', () => {
        const rule = RuleParser.parse('||ads.example.com^');
        expect(isJsInjectionRule(rule)).toBe(false);
    });

    it('returns false for a comment rule', () => {
        const rule = RuleParser.parse('! This is a comment');
        expect(isJsInjectionRule(rule)).toBe(false);
    });
});

describe('parseFilterList', () => {
    it('parses a filter list with multiple rule types', () => {
        const input = [
            '||ads.example.com^',
            'example.com##.banner',
            'example.com#%#window._foo = 1;',
        ].join('\n');

        const result = parseFilterList(input);
        expect(result.type).toBe('FilterList');
        expect(result.children).toHaveLength(3);
    });

    it('parses an empty string without throwing', () => {
        const result = parseFilterList('');
        expect(result.type).toBe('FilterList');
    });

    it('includes raws when includeRaws is true', () => {
        const rule = '||ads.example.com^';
        const result = parseFilterList(rule, true);
        expect(result.children[0]?.raws).toBeDefined();
    });

    it('does not include raws by default', () => {
        const rule = '||ads.example.com^';
        const result = parseFilterList(rule);
        expect(result.children[0]?.raws).toBeUndefined();
    });
});
