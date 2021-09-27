/**
 * @jest-environment jsdom
 */

import { CosmeticRule } from '../../../src/rules/cosmetic-rule';
import { HtmlRuleParser } from '../../../src/content-filtering/rule/html-rule-parser';

describe('Html rule attributes parser', () => {
    it('checks simple attributes parsing', () => {
        let ruleText = 'example.org$$div[id="ad_text"]';
        let rule = new CosmeticRule(ruleText, 0);

        let parsed = HtmlRuleParser.parse(rule);
        expect(parsed.tagName).toBe('div');
        expect(parsed.selector).toBe('div[id*="ad_text"]');

        ruleText = 'example.org$$div';
        rule = new CosmeticRule(ruleText, 0);

        parsed = HtmlRuleParser.parse(rule);
        expect(parsed.tagName).toBe('div');
        expect(parsed.selector).toBe('div');

        ruleText = 'example.org$$div[id]';
        rule = new CosmeticRule(ruleText, 0);

        parsed = HtmlRuleParser.parse(rule);
        expect(parsed.tagName).toBe('div');
        expect(parsed.selector).toBe('div');

        ruleText = 'example.org$$div[id=""';
        rule = new CosmeticRule(ruleText, 0);

        parsed = HtmlRuleParser.parse(rule);
        expect(parsed.tagName).toBe('div');
        expect(parsed.selector).toBe('div[id*=""]');
    });

    it('checks complicated attributes parsing', () => {
        // eslint-disable-next-line max-len
        const ruleText = 'example.org$$div[id="ad_text"][tag-content="teas""ernet"][max-length="500"][min-length="50"][wildcard="*.adriver.*"][parent-search-level="15"][parent-elements="td,table"]';
        const rule = new CosmeticRule(ruleText, 0);

        const parsed = HtmlRuleParser.parse(rule);
        expect(parsed.tagName).toBe('div');
        expect(parsed.selector).toBe('div[id*="ad_text"]');
        expect(parsed.tagContentFilter).toBe('teas"ernet');
        expect(parsed.parentSearchLevel).toBe(15);
        expect(parsed.maxLength).toBe(500);
        expect(parsed.minLength).toBe(50);
        expect(parsed.wildcard).toBeDefined();
        expect(parsed.parentElements).toHaveLength(2);
        expect(parsed.parentElements).toContain('td');
        expect(parsed.parentElements).toContain('table');
    });
});
