/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { RawRuleConverter } from '@adguard/agtree';

import {
    HtmlRuleSelector,
} from '../../../../../../../src/lib/mv2/background/services/content-filtering/rule/html-rule-selector';
import { createCosmeticRule } from '../../../../../../helpers/rule-creator';

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

    it('checks special selector :contains() - converted from [min-length] and [max-length] combined', () => {
        // Convert from raw [min-length][max-length] syntax
        const { result: [convertedRuleText] } = RawRuleConverter.convertToAdg(
            'example.org$$div[min-length="10"][max-length="100"]',
        );
        const rule = createCosmeticRule(convertedRuleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        // Content within range (50 chars) should match
        document.body.innerHTML = `
        <div id="matches">${'x'.repeat(50)}</div>
        `;

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('matches');

        // Content below min (5 chars) should NOT match
        document.body.innerHTML = `
        <div id="too-short">${'x'.repeat(5)}</div>
        `;

        const tooShortElements = selector.getMatchedElements(document);
        expect(tooShortElements).toHaveLength(0);

        // Content above max (200 chars) should NOT match
        document.body.innerHTML = `
        <div id="too-long">${'x'.repeat(200)}</div>
        `;

        const tooLongElements = selector.getMatchedElements(document);
        expect(tooLongElements).toHaveLength(0);

        // Content exactly at min boundary (10 chars) should match
        document.body.innerHTML = `
        <div id="at-min">${'x'.repeat(10)}</div>
        `;

        const atMinElements = selector.getMatchedElements(document);
        expect(atMinElements).toHaveLength(1);
        expect(atMinElements![0].id).toBe('at-min');

        // Content exactly at max boundary (100 chars) should match
        document.body.innerHTML = `
        <div id="at-max">${'x'.repeat(100)}</div>
        `;

        const atMaxElements = selector.getMatchedElements(document);
        expect(atMaxElements).toHaveLength(1);
        expect(atMaxElements![0].id).toBe('at-max');
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

    it('checks special selector :contains() - old two-:contains() form of duplicate [min-length] is not ok', () => {
        // The old (before agtree v4.0.3) conversion produced two separate :contains() for duplicate [min-length]:
        // $$div[min-length="10"][min-length="20"] → $$div:contains(/^(?=.{10,}$).*/s):contains(/^(?=.{20,}$).*/s)
        // Both regexes apply with AND semantics, so the effective minimum is still 20.
        // However this form is incorrect — the fix merges them into a single :contains() with the largest min.
        // This test documents that the old form DOES still match content of 25 chars (≥ 20)...
        const ruleText = 'example.org$$div:contains(/^(?=.{10,}$).*/s):contains(/^(?=.{20,}$).*/s)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        // Content of 25 chars matches both regexes
        document.body.innerHTML = `
        <div id="matches">${'x'.repeat(25)}</div>
        `;

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('matches');

        // ...but content of 15 chars satisfies min=10 yet fails min=20, so it does NOT match
        document.body.innerHTML = `
        <div id="not-matched">${'x'.repeat(15)}</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - converted from duplicate [min-length] (largest chosen)', () => {
        // Rule: $$div[min-length="10"][min-length="20"] → largest min (20) chosen
        // → $$div:contains(/^(?=.{20,}$).*/s)
        const { result: [convertedRuleText] } = RawRuleConverter.convertToAdg(
            'example.org$$div[min-length="10"][min-length="20"]',
        );
        const rule = createCosmeticRule(convertedRuleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        // Content of 25 chars (≥ 20) should match
        document.body.innerHTML = `
        <div id="matches">${'x'.repeat(25)}</div>
        `;

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('matches');

        // Content of 15 chars (≥ 10 but < 20) should NOT match — only winning min=20 applies
        document.body.innerHTML = `
        <div id="not-matched">${'x'.repeat(15)}</div>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - converted from duplicate [max-length] (smallest chosen)', () => {
        // Rule: $$div[max-length="100"][max-length="200"] → smallest max (100) chosen
        // → $$div:contains(/^(?=.{0,100}$).*/s)
        const { result: [convertedRuleText] } = RawRuleConverter.convertToAdg(
            'example.org$$div[max-length="100"][max-length="200"]',
        );
        const rule = createCosmeticRule(convertedRuleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        // Content of 50 chars (≤ 100) should match
        document.body.innerHTML = `
        <div id="matches">${'x'.repeat(50)}</div>
        `;

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements![0].id).toBe('matches');

        // Content of 150 chars (≤ 200 but > 100) should NOT match — only winning max=100 applies
        document.body.innerHTML = `
        <div id="not-matched">${'x'.repeat(150)}</div>
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

    it('checks special selector :contains() - large regex quantifier below 65536', () => {
        // "Example" is 7 chars; pad to exactly 65535 total innerHTML chars
        document.body.innerHTML = `
        <h1 id="matched">Example${'x'.repeat(65528)}</h1>
        `;

        const ruleText = 'example.org$$h1:contains(Example):contains(/^(?=.{1,65535}$).*/s)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements[0].id).toBe('matched');

        // innerHTML of 65536 chars exceeds max of 65535 — must NOT match
        document.body.innerHTML = `
        <h1 id="not-matched">Example${'x'.repeat(65529)}</h1>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - large regex quantifier equal or larger than 65536', () => {
        // "Example" is 7 chars; pad to exactly 65536 total innerHTML chars
        document.body.innerHTML = `
        <h1 id="matched">Example${'x'.repeat(65529)}</h1>
        `;

        const ruleText = 'example.org$$h1:contains(Example):contains(/^(?=.{1,65536}$).*/s)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements[0].id).toBe('matched');

        // Empty element — matchesSpecialSelector returns false when innerHTML is empty
        document.body.innerHTML = `
        <h1 id="not-matched"></h1>
        `;

        const notMatchedElements = selector.getMatchedElements(document);
        expect(notMatchedElements).toHaveLength(0);
    });

    it('checks special selector :contains() - real-world large quantifier range (20000-300000)', () => {
        // "Flags." is 6 chars; pad to 50000 total innerHTML chars (within 20000-300000 range)
        document.body.innerHTML = `
        <script id="matched">Flags.${'x'.repeat(70000)}</script>
        `;

        const ruleText = 'example.org$$script:contains(Flags.):contains(/^(?=.{20000,300000}$).*/s)';
        const rule = createCosmeticRule(ruleText, 0);
        const selector = new HtmlRuleSelector(rule.getHtmlSelectorList()!);

        const matchedElements = selector.getMatchedElements(document);
        expect(matchedElements).toHaveLength(1);
        expect(matchedElements[0].id).toBe('matched');

        // Too short: 1000 chars total (< 20000 minimum) — must NOT match
        document.body.innerHTML = `
        <script id="not-matched-short">Flags.${'x'.repeat(995)}</script>
        `;

        const notMatchedShort = selector.getMatchedElements(document);
        expect(notMatchedShort).toHaveLength(0);

        // Too long: 300001 chars total (> 300000 maximum) — must NOT match
        document.body.innerHTML = `
        <script id="not-matched-long">Flags.${'x'.repeat(299995)}</script>
        `;

        const notMatchedLong = selector.getMatchedElements(document);
        expect(notMatchedLong).toHaveLength(0);

        // In-range length but missing "Flags." — must NOT match
        document.body.innerHTML = `
        <script id="not-matched-no-flags">${'x'.repeat(50000)}</script>
        `;

        const notMatchedNoFlags = selector.getMatchedElements(document);
        expect(notMatchedNoFlags).toHaveLength(0);
    });
});
