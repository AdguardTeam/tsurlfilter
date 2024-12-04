/**
 * @vitest-environment jsdom
 */

import { createCosmeticRule } from '../../../../../../helpers/rule-creator';
import {
    HtmlRuleParser,
} from '../../../../../../../src/lib/mv2/background/services/content-filtering/rule/html-rule-parser';
import {
    HtmlRuleSelector,
} from '../../../../../../../src/lib/mv2/background/services/content-filtering/rule/html-rule-selector';

describe('Html rule selector', () => {
    it('checks simple cases', () => {
        document.body.innerHTML = `
        <p>test</p>
        <div id="testDiv">
            <div id="childDiv"></div>
         </div>
        `;

        const ruleText = 'example.org$$div[id="childDiv"]';
        const rule = createCosmeticRule(ruleText, 0);

        const parsed = HtmlRuleParser.parse(rule);
        const elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).not.toBeNull();
        expect(elements).toHaveLength(1);
        expect(elements![0].id).toBe('childDiv');
    });

    it('checks wildcard', () => {
        document.body.innerHTML = `
        <html><body><div id="ad_text">tratata teasernet\n \ntararar</div></body></html>
        `;

        let rule = createCosmeticRule('example.org$$div[id="ad_text"][wildcard="*teasernet*tararar*"]', 0);
        let parsed = HtmlRuleParser.parse(rule);
        let elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).not.toBeNull();
        expect(elements).toHaveLength(1);
        expect(elements).toContain(document.getElementsByTagName('div')[0]);

        rule = createCosmeticRule('example.org$$div[id="ad_text"][wildcard="*AN_OTHER_ONE*"]', 0);
        parsed = HtmlRuleParser.parse(rule);
        elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).toBeNull();
    });

    it('checks wildcard with escaped', () => {
        document.body.innerHTML = `
        <html><body><div>Testtest [123]{123}</div></body></html>
        `;

        const rule = createCosmeticRule('example.org$$div[wildcard="*Test*[123]{123}*"]', 0);
        const parsed = HtmlRuleParser.parse(rule);
        const elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).not.toBeNull();
        expect(elements).toHaveLength(1);
        expect(elements).toContain(document.getElementsByTagName('div')[0]);
    });

    it('checks tag content attribute', () => {
        document.body.innerHTML = `
        <html><body><div id="ad_text">tratata teasernet tararar</div></body></html>
        `;

        let rule = createCosmeticRule('example.org$$div[id="ad_text"][tag-content="teasernet"]', 0);
        let parsed = HtmlRuleParser.parse(rule);
        let elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).not.toBeNull();
        expect(elements).toHaveLength(1);
        expect(elements).toContain(document.getElementsByTagName('div')[0]);

        rule = createCosmeticRule('example.org$$div[id="ad_text"][tag-content="an-other"]', 0);
        parsed = HtmlRuleParser.parse(rule);
        elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).toBeNull();
    });

    it('checks tag min max length attribute', () => {
        document.body.innerHTML = `
        <html><body><div id="ad_text">tratata teasernet tararar</div></body></html>
        `;

        let rule = createCosmeticRule('example.org$$div[max-length="500"][min-length="5"]', 0);
        let parsed = HtmlRuleParser.parse(rule);
        let elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).not.toBeNull();
        expect(elements).toHaveLength(1);
        expect(elements).toContain(document.getElementsByTagName('div')[0]);

        rule = createCosmeticRule('example.org$$div[max-length="5"][min-length="1"]', 0);
        parsed = HtmlRuleParser.parse(rule);
        elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).toBeNull();

        rule = createCosmeticRule('example.org$$div[max-length="500"][min-length="100"]', 0);
        parsed = HtmlRuleParser.parse(rule);
        elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).toBeNull();
    });

    it('checks tag parent-elements attributes', () => {
        document.body.innerHTML = `
        <html><body><table><tr><td><div id="ad_text">tratata teasernet tararar</div></td></tr></table></body></html>
        `;

        let rule = createCosmeticRule('example.org$$div[parent-search-level="5"][parent-elements="td,table"]', 0);
        let parsed = HtmlRuleParser.parse(rule);
        let elements = new HtmlRuleSelector(parsed).getMatchedElements(document);

        expect(elements).not.toBeNull();
        expect(elements).toHaveLength(1);
        expect(elements).toContain(document.getElementsByTagName('table')[0]);

        rule = createCosmeticRule('example.org$$div[parent-search-level="5"][parent-elements=""]', 0);
        parsed = HtmlRuleParser.parse(rule);
        elements = new HtmlRuleSelector(parsed).getMatchedElements(document);
        expect(elements).toBeNull();
    });
});
