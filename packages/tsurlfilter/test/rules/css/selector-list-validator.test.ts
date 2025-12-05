import { describe, expect, it } from 'vitest';

import { validateSelectorList } from '../../../src/rules/css/selector-list-validator';

describe('Selector list validator', () => {
    describe('validateSelectorList - valid cases', () => {
        it.each([
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
            ['.target:contains(a)', true],
            ['.target:has-text(a)', true],
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

            // :has(), :is(), :not() are conditionally extended CSS
            // When used alone, they should be treated as native CSS
            ['.target:has(a)', false],
            ['.target:has(.banner)', false],
            ['div:has(> p)', false],
            ['.target:is(div, p)', false],
            ['.target:not(.excluded)', false],
            ['div:is(.class1, .class2)', false],
            ['div:not(.hidden, .invisible)', false],

            // -abp-has is always extended CSS (ABP-specific syntax)
            ['.target:-abp-has(a)', true],

            // But when :has() or :is() or :not() are combined with extended CSS,
            // they become extended CSS
            ['.target:contains(a):has(a)', true],
            ['.target:has(a):contains(b)', true],
            ['.target:is(div):contains(text)', true],

            // Should handle combined Extended CSS elements
            ['.target:-abp-contains(a):-abp-has(a)', true],
            ['.target:contains(a):upward(b)', true],

            // Should handle regular CSS selector lists
            ['div, a:hover', false],

            // Should handle Extended CSS selector lists
            ['[a="b"], a:contains(a)', true],
            ['[a="b"], a[-ext-contains="a"]', true],

            // :has() in a selector list with other extended CSS becomes extended
            ['a:has(b), div:contains(c)', true],

            // :has() alone in a selector list remains native
            ['[a="b"], a:has(> a)', false],

            // Nested :has() is not supported in native CSS,
            // so it should be treated as extended CSS
            // https://developer.mozilla.org/en-US/docs/Web/CSS/:has#syntax
            ['div:has(> div:has(> a))', true],
            ['div:has(.foo:has(.bar))', true],
            ['section:has(div:has(p))', true],
            ['.container:has(> .item:has(> span))', true],
            // Triple nesting
            ['div:has(div:has(div:has(a)))', true],
            // Nested :has() in selector list
            ['div:has(> div:has(> a)), span', true],
            ['span, div:has(> div:has(> a))', true],

            // selector list with few non-nested :has() should be treated as native CSS
            ['a:has(> b), c:has(> d)', false],
        ])("should validate '%s' correctly", (selectorList, isExtendedCss) => {
            expect(validateSelectorList(selectorList)).toEqual({
                isValid: true,
                isExtendedCss,
            });
        });
    });

    describe('validateSelectorList - invalid cases', () => {
        // valid cases
        it.each([
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

            // :if() is no longer supported as a synonym for :has()
            // https://github.com/AdguardTeam/ExtendedCss#extended-css-has
            ['.target:if(a)', false, "Unsupported pseudo-class: ':if'"],
            ['.target:if(a):if-not(b)', false, "Unsupported pseudo-class: ':if'"],

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
