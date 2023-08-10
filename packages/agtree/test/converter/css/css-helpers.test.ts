/**
 * @file CSS conversion helpers.
 *
 * Some of these tests are taken from the ExtendedCss project:
 * @see {@link https://github.com/AdguardTeam/ExtendedCss/blob/master/test/selector/converter.test.ts}
 *
 * We parse and serialize selectors while testing, just for convenience
 */

import { type SelectorList } from '@adguard/ecss-tree';

import { convertFromLegacyExtendedCss, convertToPseudoElements } from '../../../src/converter/css';
import { CssTree } from '../../../src/utils/csstree';
import { CssTreeParserContext } from '../../../src/utils/csstree-constants';

describe('CSS conversion helpers', () => {
    describe('convertPseudoClasses', () => {
        test.each([
            // Leave non-affected selectors as is
            {
                actual: 'div',
                expected: 'div',
            },
            {
                actual: 'div[attr]',
                expected: 'div[attr]',
            },
            {
                actual: 'div[attr=value]',
                expected: 'div[attr=value]',
            },

            // :after → ::after
            {
                actual: ':after',
                expected: '::after',
            },
            {
                actual: 'div:after',
                expected: 'div::after',
            },
            {
                actual: 'div:after, section:after',
                expected: 'div::after, section::after',
            },

            // :before → ::before
            {
                actual: ':before',
                expected: '::before',
            },
            {
                actual: 'div:before',
                expected: 'div::before',
            },
            {
                actual: 'div:before, section:before',
                expected: 'div::before, section::before',
            },

            // Combined
            {
                actual: 'div:before, section:after',
                expected: 'div::before, section::after',
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected }) => {
            // Parse the selector list into an AST
            const selectorListAst = CssTree.parse(actual, CssTreeParserContext.selectorList) as SelectorList;

            // Convert the selector list with the converter API
            const convertedSelectorListAst = convertToPseudoElements(selectorListAst);

            // Serialize the converted selector list
            const convertedSelectorList = CssTree.generateSelectorList(convertedSelectorListAst);

            // Check the result
            expect(convertedSelectorList).toBe(expected);
        });
    });

    describe('convertFromLegacyExtendedCss', () => {
        test.each([
            {
                actual: 'div',
                expected: 'div',
            },
            {
                actual: 'div[attr]',
                expected: 'div[attr]',
            },
            {
                actual: 'div[attr=value]',
                expected: 'div[attr=value]',
            },
            {
                actual: 'div[attr=\'value\']',
                // CSSTree serializes apostrophes as double quotes
                expected: 'div[attr="value"]',
            },
            {
                actual: 'div[attr="value"]',
                expected: 'div[attr="value"]',
            },
            {
                actual: 'div[attr="value" i]',
                expected: 'div[attr="value" i]',
            },

            // Don't convert modern Extended CSS
            {
                actual: 'div:has(a)',
                expected: 'div:has(a)',
            },
            {
                actual: 'div:-abp-has(a)',
                expected: 'div:-abp-has(a)',
            },

            // Convert 'matches-css-before' and 'matches-css-after' pseudo-classes
            {
                actual: 'div:matches-css-before(content:ad*)',
                expected: 'div:matches-css(before,content:ad*)',
            },
            {
                actual: 'div:matches-css-before(color: rgb(255, 255, 255))',
                expected: 'div:matches-css(before,color: rgb(255, 255, 255))',
            },
            {
                actual: 'div:matches-css-after(content:ad*)',
                expected: 'div:matches-css(after,content:ad*)',
            },
            {
                actual: 'div:matches-css-after(color: rgb(255, 255, 255))',
                expected: 'div:matches-css(after,color: rgb(255, 255, 255))',
            },

            // has
            {
                actual: 'div[-ext-has=".banner"]',
                expected: 'div:has(.banner)',
            },
            {
                actual: 'div.test-class[-ext-has="time.g-time"]',
                expected: 'div.test-class:has(time.g-time)',
            },
            {
                actual: 'div#test-div[-ext-has="#test"]',
                expected: 'div#test-div:has(#test)',
            },
            {
                actual: '[-ext-has="div.advert"]',
                expected: ':has(div.advert)',
            },
            {
                actual: '[-ext-has="div.test-class-two"]',
                expected: ':has(div.test-class-two)',
            },
            {
                actual: '.block[-ext-has=\'a[href^="https://example.net/"]\']',
                expected: '.block:has(a[href^="https://example.net/"])',
            },
            {
                actual: 'div[style*="z-index:"][-ext-has=\'>div[id$="_content"]>iframe#overlay_iframe\']',
                expected: 'div[style*="z-index:"]:has(> div[id$="_content"] > iframe#overlay_iframe)',
            },

            // contains
            {
                actual: 'div a[-ext-contains="text"]',
                expected: 'div a:contains(text)',
            },
            {
                actual: 'a[target="_blank"][-ext-contains="Advertisement"]',
                expected: 'a[target="_blank"]:contains(Advertisement)',
            },
            {
                /* eslint-disable max-len */
                actual: 'div[style="text-align: center"] > b[-ext-contains="Ads:"]+a[href^="http://example.com/test.html?id="]+br',
                expected: 'div[style="text-align: center"] > b:contains(Ads:) + a[href^="http://example.com/test.html?id="] + br',
                /* eslint-enable max-len */
            },

            // matches-css
            {
                actual: '#test-matches-css div[-ext-matches-css="background-image: url(data:*)"]',
                expected: '#test-matches-css div:matches-css(background-image: url(data:*))',
            },
            {
                actual: '#test-opacity-property[-ext-matches-css="opacity: 0.9"]',
                expected: '#test-opacity-property:matches-css(opacity: 0.9)',
            },
            {
                actual: '#test-matches-css div[-ext-matches-css-before="content: *find me*"]',
                expected: '#test-matches-css div:matches-css(before,content: *find me*)',
            },
            {
                actual: '#test-matches-css div[-ext-matches-css-after="content: *find me*"]',
                expected: '#test-matches-css div:matches-css(after,content: *find me*)',
            },

            // combinations
            {
                actual: 'div[-ext-contains="adg-test"][-ext-has="div.test-class-two"]',
                expected: 'div:contains(adg-test):has(div.test-class-two)',
            },
            {
                actual: 'div[i18n][-ext-contains="adg-test"][-ext-has="div.test-class-two"]',
                expected: 'div[i18n]:contains(adg-test):has(div.test-class-two)',
            },
            {
                actual: 'div[-ext-has="div.test-class-two"] > .test-class[-ext-contains="test"]',
                expected: 'div:has(div.test-class-two) > .test-class:contains(test)',
            },
            {
                actual: '#sidebar div[class^="text-"][-ext-has=">.box-inner>h2:contains(ads)"]',
                expected: '#sidebar div[class^="text-"]:has(> .box-inner > h2:contains(ads))',
            },
            {
                actual: '.sidebar > h3[-ext-has="a:contains(Recommended)"]',
                expected: '.sidebar > h3:has(a:contains(Recommended))',
            },
            {
                actual: '.sidebar > h3[-ext-has="a:contains(Recommended)"] + div',
                expected: '.sidebar > h3:has(a:contains(Recommended)) + div',
            },
            {
                actual: '*[-ext-contains=\'/\\\\s[a-t]{8}$/\'] + *:contains(/^[^\\"\\\'"]{30}quickly/)',
                expected: '*:contains(/\\s[a-t]{8}$/) + *:contains(/^[^\\"\\\'"]{30}quickly/)',
            },
            {
                actual: '[-ext-matches-css-before=\'content:  /^[A-Z][a-z]{2}\\\\s/  \']',
                expected: ':matches-css(before,content:  /^[A-Z][a-z]{2}\\s/  )',
            },
            {
                // eslint-disable-next-line max-len
                actual: '[-ext-has=\'+:matches-css-after( content  :   /(\\\\d+\\\\s)*me/  ):contains(/^(?![\\\\s\\\\S])/)\']',
                expected: ':has(+ :matches-css(after, content  :   /(\\d+\\s)*me/  ):contains(/^(?![\\s\\S])/))',
            },
            {
                /* eslint-disable max-len */
                actual: ':matches-css(    background-image: /^url\\((.)[a-z]{4}:[a-z]{2}\\1nk\\)$/    ) + [-ext-matches-css-before=\'content:  /^[A-Z][a-z]{2}\\\\s/  \'][-ext-has=\'+:matches-css-after( content  :   /(\\\\d+\\\\s)*me/  ):contains(/^(?![\\\\s\\\\S])/)\']',
                expected: ':matches-css(    background-image: /^url\\((.)[a-z]{4}:[a-z]{2}\\1nk\\)$/    ) + :matches-css(before,content:  /^[A-Z][a-z]{2}\\s/  ):has(+ :matches-css(after, content  :   /(\\d+\\s)*me/  ):contains(/^(?![\\s\\S])/))',
                /* eslint-enable max-len */
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected }) => {
            // Parse the selector list into an AST
            const selectorListAst = CssTree.parse(actual, CssTreeParserContext.selectorList) as SelectorList;

            // Convert the selector list with the converter API
            const convertedSelectorListAst = convertFromLegacyExtendedCss(selectorListAst);

            // Serialize the converted selector list
            const convertedSelectorList = CssTree.generateSelectorList(convertedSelectorListAst);

            // Check the result
            expect(convertedSelectorList).toBe(expected);
        });
    });
});
