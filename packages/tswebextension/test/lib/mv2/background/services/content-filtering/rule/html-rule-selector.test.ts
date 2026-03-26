/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { createCosmeticRule } from '../../../../../../helpers/rule-creator';
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
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('childDiv');

        document.body.innerHTML = `
        <span class="testSpan">Hello World</span>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks complex selector with combinators (descendant)', () => {
        document.body.innerHTML = `
        <div class="container">
            <div class="parent">
                <div id="descendant-combinator" class="child"></div>
            </div>
        </div>
        `;

        const ruleText = 'example.org$$.container .parent .child';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('descendant-combinator');

        document.body.innerHTML = `
        <div class="container">
            <div id="not-matched" class="child"></div>
        </div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks complex selector with combinators (child)', () => {
        document.body.innerHTML = `
        <div class="container">
            <div class="parent">
                <div id="child-combinator" class="child"></div>
            </div>
        </div>
        `;

        const ruleText = 'example.org$$.container > .parent > .child';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('child-combinator');

        document.body.innerHTML = `
        <div class="container">
            <div class="parent">
                <div>
                    <div id="not-matched" class="child"></div>
                </div>
            </div>
        </div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks complex selector with combinators (next-sibling)', () => {
        document.body.innerHTML = `
        <div class="container">
            <div class="sibling1"></div>
            <div id="next-sibling-combinator" class="sibling2"></div>
        </div>
        `;

        const ruleText = 'example.org$$.sibling1 + .sibling2';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('next-sibling-combinator');

        document.body.innerHTML = `
        <div class="container">
            <div class="sibling1"></div>
            <div></div>
            <div id="not-matched" class="sibling2"></div>
        </div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks complex selector with combinators (subsequent-sibling)', () => {
        document.body.innerHTML = `
        <div class="container">
            <div class="sibling1"></div>
            <div></div>
            <div id="subsequent-sibling-combinator" class="sibling2"></div>
        </div>
        `;

        const ruleText = 'example.org$$.sibling1 ~ .sibling2';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('subsequent-sibling-combinator');

        document.body.innerHTML = `
        <div class="container">
            <div id="not-matched" class="sibling2"></div>
            <div class="sibling1"></div>
        </div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks multiple selectors', () => {
        document.body.innerHTML = `
        <div id="first-element" class="test-class"></div>
        <div id="second-element" class="test-class"></div>
        `;

        const ruleText = 'example.org$$#first-element, #second-element';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(2);
        expect(matchedElements![0].id).toBe('first-element');
        expect(matchedElements![1].id).toBe('second-element');

        document.body.innerHTML = `
        <div id="only-element" class="test-class"></div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - substring', () => {
        document.body.innerHTML = `
        <div id="contains-substring" class="test-class">This is a test string.</div>
        `;

        const ruleText = 'example.org$$div:contains(test string)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('contains-substring');

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">This is another string.</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - regexp', () => {
        document.body.innerHTML = `
        <div id="contains-regexp" class="test-class">User123 logged in.</div>
        `;

        const ruleText = 'example.org$$div:contains(/User\\d+/)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('contains-regexp');

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">Guest logged in.</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - regexp with flags', () => {
        document.body.innerHTML = `
        <div id="contains-regexp-flags" class="test-class">Error: Something went wrong.</div>
        `;

        const ruleText = 'example.org$$div:contains(/error: .*/i)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('contains-regexp-flags');

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">Warning: Something went wrong.</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - converted from [wildcard]', () => {
        document.body.innerHTML = `
        <div id="contains-wildcard" class="test-class">Welcome to AdGuard!</div>
        `;

        // This is a rule converted from `example.org$$div[wildcard="*to*"]`
        const ruleText = 'example.org$$div:contains(/^.*to.*$/)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('contains-wildcard');

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">Welcome AdGuard!</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - converted from [min-length]', () => {
        document.body.innerHTML = `
        <div id="contains-wildcard" class="test-class">Welcome to AdGuard!</div>
        `;

        // This is a rule converted from `example.org$$div[min-length="10"]`
        const ruleText = 'example.org$$div:contains(/^(?=.{10,}$).*/)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('contains-wildcard');

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">Short</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - converted from [max-length]', () => {
        document.body.innerHTML = `
        <div id="contains-wildcard" class="test-class">Short text</div>
        `;

        // This is a rule converted from `example.org$$div[max-length="20"]`
        const ruleText = 'example.org$$div:contains(/^(?=.{0,20}$).*/)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('contains-wildcard');

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">This text is definitely too long.</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - multiple usages in one selector', () => {
        document.body.innerHTML = `
        <div id="multiple-contains" class="test-class">Error: User123 failed to login.</div>
        `;

        const ruleText = 'example.org$$div:contains(/error/i):contains(User):contains(failed)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('multiple-contains');

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">Error: Guest failed to login.</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - multiple selectors with :contains()', () => {
        document.body.innerHTML = `
        <div id="first-element" class="test-class">Hello World</div>
        <div id="second-element" class="test-class">Goodbye World</div>
        `;

        const ruleText = 'example.org$$div:contains(Hello), div:contains(Goodbye)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(2);
        expect(matchedElements![0].id).toBe('first-element');
        expect(matchedElements![1].id).toBe('second-element');

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">Welcome to AdGuard!</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - chained with combinators', () => {
        document.body.innerHTML = `
        <div class="container">
            Container Content
            <div class="parent">
                Parent Content
                <div id="child-element" class="child">Child Content</div>
            </div>
        </div>
        `;

        // eslint-disable-next-line max-len
        const ruleText = 'example.org$$.container:contains(Container Content) > .parent:contains(Parent Content) > .child:contains(Child Content)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('child-element');

        document.body.innerHTML = `
        <div class="container">
            Container Content
            <div class="parent">
                Parent Content
                <div id="not-matched" class="child">Regular Content</div>
            </div>
        </div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - edge case with empty native selector', () => {
        document.body.innerHTML = `
        <div id="contains-only" class="test-class">Just some content</div>
        `;

        const ruleText = 'example.org$$:contains(Just some)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0]).toBe(document.documentElement);

        document.body.innerHTML = `
        <div id="not-matched" class="test-class">Different content</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - edge case with empty native selector and combinator', () => {
        document.body.innerHTML = `
        <div class="parent">
            <div id="contains-only-child-1" class="child">Some unique content</div>
        </div>
        <div class="parent">
            <div id="contains-only-child-2" class="child">Some content</div>
        </div>
        `;

        const ruleText = 'example.org$$div.parent > :contains(Some unique)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('contains-only-child-1');

        document.body.innerHTML = `
        <div class="parent">
            <div id="not-matched" class="child">Other content</div>
        </div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });
});
