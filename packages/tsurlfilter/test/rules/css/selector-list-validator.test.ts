import { validateSelectorList } from '../../../src/rules/css/selector-list-validator';

describe('Selector list validator', () => {
    describe('validateSelectorList - valid cases', () => {
        test.each([
            // [selectorList, isExtendedCss]
            ['div', false],
            ['div + p', false],
            ['div > p', false],
            ['div ~ p', false],

            ['a:active', false],
            ['a:focus', false],
            ['a:hover', false],
            ['a:link', false],
            ['a:visited', false],

            ['input:checked', false],
            ['input:disabled', false],
            ['input:enabled', false],
            ['input:in-range', false],
            ['input:optional', false],
            ['input:out-of-range', false],
            ['input:read-only', false],
            ['input:read-write', false],
            ['input:required', false],

            [':empty', false],
            [':lang(en)', false],
            [':root', false],
            [':target', false],

            ['.target:first-child', false],
            ['.target:last-child', false],
            ['.target:nth-child(1)', false],
            ['.target:nth-child(2n+1)', false],
            ['.target:nth-last-child(1)', false],
            ['.target:nth-last-child(2n+1)', false],
            ['.target:only-child', false],

            ['.target:first-of-type', false],
            ['.target:last-of-type', false],
            ['.target:nth-last-of-type(1)', false],
            ['.target:nth-last-of-type(2n+1)', false],
            ['.target:nth-of-type(1)', false],
            ['.target:nth-of-type(2n+1)', false],
            ['.target:only-of-type', false],

            ['.target:not(a)', false],
            ['.target:where(a)', false],

            // do not confuse pseudo-elements with pseudo-classes
            ['.target::after', false],
            ['.target::yay', false],

            // Tricky case: seems like an Extended CSS selector, but it's not
            ['[attr=":contains(a)"]', false],

            // Should handle Extended CSS selectors
            ['.target:-abp-contains(a)', true],
            ['.target:-abp-has(a)', true],
            ['.target:contains(a)', true],
            ['.target:has(a)', true],
            ['.target:has-text(a)', true],
            ['.target:if(a)', true],
            ['.target:if-not(a)', true],
            ['.target:matches-attr("a-*"="b")', true],
            ['.target:matches-css(before, a: /b/)', true],
            ['.target:matches-property(a.b)', true],
            ['.target:nth-ancestor(1)', true],
            ['.target:remove()', true],
            ['.target:upward(1)', true],
            ['.target:upward(a[b])', true],
            ['.target:xpath(//*[@class="inner"]/..)', true],

            // Should handle legacy Extended CSS selectors
            ['.target[-ext-contains="a"]', true],
            ['.target[-ext-has-text="a"]', true],
            ['.target[-ext-has="a"]', true],
            ['.target[-ext-matches-css-after="a: b"]', true],
            ['.target[-ext-matches-css-before="a: b"]', true],
            ['.target[-ext-matches-css="a: b"]', true],

            // Should handle combined Extended CSS elements
            ['.target:-abp-contains(a):-abp-has(a)', true],
            ['.target:contains(a):has(a)', true],
            ['.target:if(a):if-not(b)', true],

            // Should handle regular CSS selector lists
            ['div, a:hover', false],

            // Should handle Extended CSS selector lists
            ['[a="b"], a:contains(a)', true],
            ['[a="b"], a:has(a)', true],
            ['[a="b"], a[-ext-contains="a"]', true],
        ])("should validate '%s' correctly", (selectorList, isExtendedCss) => {
            expect(validateSelectorList(selectorList)).toEqual({
                isValid: true,
                isExtendedCss,
            });
        });
    });

    describe('validateSelectorList - invalid cases', () => {
        // valid cases
        test.each([
            // [selectorList, isExtendedCss, errorMessage]
            // Should detect unsupported pseudo-classes
            ['div:foo', false, "Unsupported pseudo-class: ':foo'"],
            ['div:foo():bar(a)', false, "Unsupported pseudo-class: ':foo'"],
            ['div:foo(a)', false, "Unsupported pseudo-class: ':foo'"],
            ['div:foo(a):bar', false, "Unsupported pseudo-class: ':foo'"],
            ['div:foo:bar', false, "Unsupported pseudo-class: ':foo'"],
            ['div:foo:bar(a)', false, "Unsupported pseudo-class: ':foo'"],
            ['div:bar:foo', false, "Unsupported pseudo-class: ':bar'"],
            ['div:bar():foo', false, "Unsupported pseudo-class: ':bar'"],

            // Should detect unsupported legacy Extended CSS selectors
            ['[-ext-foo="bar"]', true, "Unsupported Extended CSS attribute selector: '-ext-foo'"],
            ['[-ext-foo="bar"][b=c]', true, "Unsupported Extended CSS attribute selector: '-ext-foo'"],

            // Should detect combined case
            // First case is not detected as Extended CSS selector, because it fails before
            // the Extended CSS selector is reached
            ['div:foo(a):bar, [-ext-foo="bar"]', false, "Unsupported pseudo-class: ':foo'"],
            ['[-ext-foo="bar"], div:foo(a):bar', true, "Unsupported Extended CSS attribute selector: '-ext-foo'"],

            ['foo /* bar */', false, 'Comments are not allowed in selector lists'],
            ['foo /* bar */ baz', false, 'Comments are not allowed in selector lists'],
            ['body { background: red!important; }', false, 'Curly brackets are not allowed in selector lists'],
        ])("should validate '%s' correctly", (selectorList, isExtendedCss, errorMessage) => {
            expect(validateSelectorList(selectorList)).toEqual({
                isValid: false,
                isExtendedCss,
                errorMessage,
            });
        });
    });
});
