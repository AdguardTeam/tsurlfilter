/* eslint-disable max-len */
import { describe, test, expect } from 'vitest';

import { CosmeticRuleConverter } from '../../../src/converter/cosmetic/index.js';

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
                    String.raw`[$path=/^((?!\/page).)*$/]example.com#@$#h1 { background-color: blue !important }`,
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
    describe('ADG to uBO', () => {
        test.each([
            // [$path=....] modifier
            // No value
            {
                actual: '[$path]example.com##.foo',
                expected: [
                    'example.com##:matches-path(/^/$/) .foo',
                ],
                shouldConvert: true,
            },
            // Basic cases
            {
                actual: '[$path=/bar]example.com##.foo',
                expected: [
                    'example.com##:matches-path(/bar) .foo',
                ],
                shouldConvert: true,
            },
            // Exception rule
            {
                actual: '[$path=/bar]example.com#@#.foo',
                expected: [
                    'example.com#@#:matches-path(/bar) .foo',
                ],
                shouldConvert: true,
            },
            // Basic negation cases
            {
                actual: '[$path=/^((?!a).)*$/]example.com##.foo',
                expected: [
                    'example.com##:not(:matches-path(/a/)) .foo',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/^((?!\\/page).)*$/]example.com##.foo',
                expected: [
                    String.raw`example.com##:not(:matches-path(/\\/page/)) .foo`,
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/page]ya.ru##p',
                expected: [
                    'ya.ru##:matches-path(/page) p',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/page]ya.ru#@#p',
                expected: [
                    'ya.ru#@#:matches-path(/page) p',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/\\/(sub1|sub2)\\/page\\.html/]ya.ru##p',
                expected: [
                    String.raw`ya.ru##:matches-path(/\\/(sub1|sub2)\\/page\\.html/) p`,
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/^((?!\\/(sub1|sub2)\\/page\\.html).)*$/]ya.ru##p',
                expected: [
                    String.raw`ya.ru##:not(:matches-path(/\\/(sub1|sub2)\\/page\\.html/)) p`,
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/^((?!\\/page).)*$/]ya.ru##p',
                expected: [
                    String.raw`ya.ru##:not(:matches-path(/\\/page/)) p`,
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/sexykpopidol]blog.livedoor.jp###containerWrap > #container > .blog-title-outer + #content.hfeed',
                expected: [
                    'blog.livedoor.jp##:matches-path(/sexykpopidol) #containerWrap > #container > .blog-title-outer + #content.hfeed',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/^((?!\\/search\\?q=.*?tbm=shop).)*$/]www.google.*###test',
                expected: [
                    String.raw`www.google.*##:not(:matches-path(/\\/search\\?q=.*?tbm=shop/)) #test`,
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/\\/[a|b|,]\\/page\\.html/]example.com###test',
                expected: [
                    String.raw`example.com##:matches-path(/\/[a|b|):]\/page\.html/ #test`,
                ],
                shouldConvert: true,
            },
            {
                actual: '[$path=/^((?!\\/page).)*$/]example.com#@$#h1 { background-color: blue !important }',
                expected: [
                    String.raw`example.com#@#:not(:matches-path(/\\/page/)) h1:style(background-color: blue !important)`,
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`[$path=/q]example.*#$?#body.page_qQuestionRoute div#page > div[class]:first-child > div[class]:first-child > section[class*=" "] > div[class] + div > div:not(:has(> div[id^="content-control-"])):not(:has(a[class])) { height: 0 !important; }`,
                expected: [
                    String.raw`example.*##:matches-path(/q) body.page_qQuestionRoute div#page > div[class]:first-child > div[class]:first-child > section[class*=" "] > div[class] + div > div:not(:has(> div[id^="content-control-"])):not(:has(a[class])):style(height: 0 !important;)`,
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`[$path=/\/(sub1|sub2)\/page\.html/]example.org#$?#p:contains(/[\w\W]{30,}/) { background: #ff0033 !important; }`,
                expected: [
                    String.raw`example.org##:matches-path(/\\/(sub1|sub2)\\/page\\.html/) p:contains(/[\w\W]{30,}/):style(background: #ff0033 !important;)`,
                ],
                shouldConvert: true,
            },
            // [$domain=....] modifier
            {
                actual: '[$domain=example.com]##.textad',
                expected: [
                    'example.com##.textad',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$domain=example.com]#@#.textad',
                expected: [
                    'example.com#@#.textad',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$domain=example.com|example.org]###adblock',
                expected: [
                    'example.com,example.org###adblock',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$domain=example.com|example.org]#@##adblock',
                expected: [
                    'example.com,example.org#@##adblock',
                ],
                shouldConvert: true,
            },
            // PIPE separator escaped for now because of issue with parser
            // https://github.com/AdguardTeam/tsurlfilter/issues/121
            {
                actual: '[$domain=/example.(com\\|org)/]##.banner',
                expected: [
                    '/example.(com\\|org)/##.banner',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$domain=/example.(com\\|org)/]##.banner',
                expected: [
                    '/example.(com\\|org)/##.banner',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$domain=/example.(com\\|org)/|foo.com]##.banner',
                expected: [
                    '/example.(com\\|org)/,foo.com##.banner',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$domain=/example.(com\\|org)/|foo.com]#@#.banner',
                expected: [
                    '/example.(com\\|org)/,foo.com#@#.banner',
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`[$domain=/^example\.org$/]#$#body > * > * > * > *:not(div)[id][class] ~ *:not(div)[id][class] { background: #e6e7e9 !important; }`,
                expected: [
                    String.raw`/^example\.org$/##body > * > * > * > *:not(div)[id][class] ~ *:not(div)[id][class]:style(background: #e6e7e9 !important;)`,
                ],
                shouldConvert: true,
            },
            {
                actual: String.raw`[$domain=/^example\.org$/]#$?#body > * > * > * > *:not(div)[id][class] ~ *:not(div)[id][class] > *:not(div)[class] article:matches-css(height: /^(148(?:\.\d{1,3})?|149(?:\.\d{1,3})?|150(?:\.0{1,3})?)px$/) { remove: true; }`,
                expected: [
                    String.raw`/^example\.org$/##body > * > * > * > *:not(div)[id][class] ~ *:not(div)[id][class] > *:not(div)[class] article:matches-css(height: /^(148(?:\.\d{1,3})?|149(?:\.\d{1,3})?|150(?:\.0{1,3})?)px$/):remove()`,
                ],
                shouldConvert: true,
            },
            // [$url=....] modifier
            {
                actual: '[$url=||example.com/content/*]##div.textad',
                expected: [
                    '/^(http|https|ws|wss)://([a-z0-9-_.]+\\.)?example\\.com\\/content\\/.*/##div.textad',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$url=|example.org]#@#h1',
                expected: [
                    '/^example\\.org/#@#h1',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$url=|example.org]#@#h1',
                expected: [
                    '/^example\\.org/#@#h1',
                ],
                shouldConvert: true,
            },
            {
                actual: '[$url=|example.org|]#@#h1',
                expected: [
                    '/^example\\.org$/#@#h1',
                ],
                shouldConvert: true,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(CosmeticRuleConverter, 'convertToUbo');
        });
    });
});
