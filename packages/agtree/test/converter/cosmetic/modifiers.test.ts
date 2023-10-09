/* eslint-disable max-len */
import { CosmeticRuleConverter } from '../../../src/converter/cosmetic';
import '../../matchers/check-conversion';

describe('Cosmetic rule modifiers conversion', () => {
    describe('uBO to ADG', () => {
        test.each([
            // Basic cases
            {
                actual: 'example.com##.foo:matches-path(/bar)',
                expected: [
                    '[$path=/bar]example.com##.foo',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com##:matches-path(/bar).foo',
                expected: [
                    '[$path=/bar]example.com##.foo',
                ],
                shouldConvert: true,
            },
            // Extra space
            {
                actual: 'example.com##:matches-path(/bar) .foo',
                expected: [
                    '[$path=/bar]example.com##.foo',
                ],
                shouldConvert: true,
            },
            // Exception rule
            {
                actual: 'example.com#@#.foo:matches-path(/bar)',
                expected: [
                    '[$path=/bar]example.com#@#.foo',
                ],
                shouldConvert: true,
            },

            // Basic negation cases
            {
                actual: 'example.com##.foo:not(:matches-path(/a/))',
                expected: [
                    '[$path=/^((?!a).)*$/]example.com##.foo',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com##.foo:not(:matches-path(/page))',
                expected: [
                    '[$path=/^((?!\\/page).)*$/]example.com##.foo',
                ],
                shouldConvert: true,
            },

            // Test cases from
            // https://github.com/AdguardTeam/tsurlfilter/blob/9b26e0b4a0e30b87690bc60f7cf377d112c3085c/packages/tsurlfilter/test/rules/rule-converter.test.ts
            {
                actual: 'ya.ru##:matches-path(/page)p',
                expected: [
                    '[$path=/page]ya.ru##p',
                ],
                shouldConvert: true,
            },
            {
                actual: 'ya.ru#@#:matches-path(/page)p',
                expected: [
                    '[$path=/page]ya.ru#@#p',
                ],
                shouldConvert: true,
            },
            {
                actual: 'ya.ru#@#p:matches-path(/page)',
                expected: [
                    '[$path=/page]ya.ru#@#p',
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`ya.ru##:matches-path(/\/(sub1|sub2)\/page\.html/)p`,
                expected: [
                    String.raw`[$path=/\\/(sub1|sub2)\\/page\\.html/]ya.ru##p`,
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`ya.ru##:not(:matches-path(/\/(sub1|sub2)\/page\.html/))p`,
                expected: [
                    String.raw`[$path=/^((?!\\/(sub1|sub2)\\/page\\.html).)*$/]ya.ru##p`,
                ],
                shouldConvert: true,
            },
            {
                actual: 'ya.ru##:not(:matches-path(/page))p',
                expected: [
                    String.raw`[$path=/^((?!\/page).)*$/]ya.ru##p`,
                ],
                shouldConvert: true,
            },
            {
                actual: 'ya.ru##p:not(:matches-path(/page))',
                expected: [
                    String.raw`[$path=/^((?!\/page).)*$/]ya.ru##p`,
                ],
                shouldConvert: true,
            },
            {
                actual: 'blog.livedoor.jp##:matches-path(/sexykpopidol) #containerWrap > #container > .blog-title-outer + #content.hfeed',
                expected: [
                    '[$path=/sexykpopidol]blog.livedoor.jp###containerWrap > #container > .blog-title-outer + #content.hfeed',
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`www.google.*##:not(:matches-path(/\/search\?q=.*?tbm=shop/)) #test`,
                expected: [
                    String.raw`[$path=/^((?!\\/search\\?q=.*?tbm=shop).)*$/]www.google.*###test`,
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`exapmle.com##:matches-path(/\/[a|b|,]\/page\.html/) #test`,
                expected: [
                    String.raw`[$path=/\\/\[a|b|\,\]\\/page\\.html/]exapmle.com###test`,
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com#@#:not(:matches-path(/page))h1:style(background-color: blue !important)',
                expected: [
                    String.raw`[$path=/^((?!\/page).)*$/]example.com#@$#h1 { background-color: blue !important; }`,
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`example.org##:matches-path(/\/(sub1|sub2)\/page\.html/)p:has-text(/[\w\W]{30,}/):style(background: #ff0033 !important;)`,
                expected: [
                    String.raw`[$path=/\\/(sub1|sub2)\\/page\\.html/]example.org#$?#p:contains(/[\w\W]{30,}/) { background: #ff0033 !important; }`,
                ],
                shouldConvert: true,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(CosmeticRuleConverter, 'convertToAdg');
        });
    });
});
