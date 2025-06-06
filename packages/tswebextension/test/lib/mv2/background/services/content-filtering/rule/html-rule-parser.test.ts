/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { createCosmeticRule } from '../../../../../../helpers/rule-creator';
import {
    HtmlRuleParser,
} from '../../../../../../../src/lib/mv2/background/services/content-filtering/rule/html-rule-parser';

describe('Html rule attributes parser', () => {
    it('checks simple attributes parsing', () => {
        let ruleText = 'example.org$$div[id="ad_text"]';
        let rule = createCosmeticRule(ruleText, 0);

        let parsed = HtmlRuleParser.parse(rule);
        expect(parsed).not.toBeNull();
        expect(parsed!.tagName).toBe('div');
        expect(parsed!.selector).toBe('div[id*="ad_text"]');

        ruleText = 'example.org$$div';
        rule = createCosmeticRule(ruleText, 0);

        parsed = HtmlRuleParser.parse(rule);
        expect(parsed).not.toBeNull();
        expect(parsed!.tagName).toBe('div');
        expect(parsed!.selector).toBe('div');

        ruleText = 'example.org$$div[id=""';
        rule = createCosmeticRule(ruleText, 0);

        parsed = HtmlRuleParser.parse(rule);
        expect(parsed).not.toBeNull();
        expect(parsed!.tagName).toBe('div');
        expect(parsed!.selector).toBe('div[id*=""]');
    });

    it('checks complicated attributes parsing', () => {
        // eslint-disable-next-line max-len
        const ruleText = 'example.org$$div[id="ad_text"][tag-content="teas""ernet"][max-length="500"][min-length="50"][wildcard="*.adriver.*"][parent-search-level="15"][parent-elements="td,table"]';
        const rule = createCosmeticRule(ruleText, 0);

        const parsed = HtmlRuleParser.parse(rule);
        expect(parsed).not.toBeNull();
        expect(parsed!.tagName).toBe('div');
        expect(parsed!.selector).toBe('div[id*="ad_text"]');
        expect(parsed!.tagContentFilter).toBe('teas"ernet');
        expect(parsed!.parentSearchLevel).toBe(15);
        expect(parsed!.maxLength).toBe(500);
        expect(parsed!.minLength).toBe(50);
        expect(parsed!.wildcard).toBeDefined();
        expect(parsed!.parentElements).toHaveLength(2);
        expect(parsed!.parentElements).toContain('td');
        expect(parsed!.parentElements).toContain('table');
    });

    it('returns null for invalid or unsupported selector', () => {
        let ruleText = 'example.org$$[id*="foo"]';
        let rule = createCosmeticRule(ruleText, 0);
        let parsed = HtmlRuleParser.parse(rule);
        expect(parsed).toBeNull();

        // TODO: Add support for `:contains()` (https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3150)
        ruleText = 'example.org$$div:contains(foo)';
        rule = createCosmeticRule(ruleText, 0);
        parsed = HtmlRuleParser.parse(rule);
        expect(parsed).toBeNull();
    });

    it('checks parsing of attribute with no value', () => {
        let ruleText = 'example.org$$div[custom_attr]';
        let rule = createCosmeticRule(ruleText, 0);

        let parsed = HtmlRuleParser.parse(rule);
        expect(parsed).not.toBeNull();
        expect(parsed!.tagName).toBe('div');
        expect(parsed!.selector).toBe('div[custom_attr]');

        ruleText = 'example.org$$div[id]';
        rule = createCosmeticRule(ruleText, 0);

        parsed = HtmlRuleParser.parse(rule);
        expect(parsed).not.toBeNull();
        expect(parsed!.tagName).toBe('div');
        expect(parsed!.selector).toBe('div[id]');
    });
});
