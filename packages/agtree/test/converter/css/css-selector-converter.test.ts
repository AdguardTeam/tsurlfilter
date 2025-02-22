/**
 * @file CSS conversion tests
 *
 * Some of these tests are taken from the ExtendedCss project:
 * @see {@link https://github.com/AdguardTeam/ExtendedCss/blob/master/test/selector/converter.test.ts}
 */
import { describe, test, expect } from 'vitest';

import { CssSelectorConverter } from '../../../src/converter/css';

describe('CssSelectorConverter', () => {
    describe('convertToAdg', () => {
        test.each([
            // Leave non-affected selectors as is
            {
                actual: 'div',
                expected: 'div',
                shouldConvert: false,
            },
            {
                actual: 'div[attr]',
                expected: 'div[attr]',
                shouldConvert: false,
            },
            {
                actual: 'div[attr=value]',
                expected: 'div[attr=value]',
                shouldConvert: false,
            },

            // :after → ::after
            {
                actual: ':after',
                expected: '::after',
                shouldConvert: true,
            },
            {
                actual: 'div:after',
                expected: 'div::after',
                shouldConvert: true,
            },
            {
                actual: 'div:after, section:after',
                expected: 'div::after, section::after',
                shouldConvert: true,
            },

            // :before → ::before
            {
                actual: ':before',
                expected: '::before',
                shouldConvert: true,
            },
            {
                actual: 'div:before',
                expected: 'div::before',
                shouldConvert: true,
            },
            {
                actual: 'div:before, section:before',
                expected: 'div::before, section::before',
                shouldConvert: true,
            },

            // Do not convert ::before and ::after, because they are already in the expected format
            {
                actual: 'div::after, section::after',
                expected: 'div::after, section::after',
                shouldConvert: false,
            },

            // Combined
            {
                actual: 'div:before, section:after',
                expected: 'div::before, section::after',
                shouldConvert: true,
            },

            {
                actual: 'div',
                expected: 'div',
                shouldConvert: false,
            },
            {
                actual: 'div[attr]',
                expected: 'div[attr]',
                shouldConvert: false,
            },
            {
                actual: 'div[attr=value]',
                expected: 'div[attr=value]',
                shouldConvert: false,
            },
            {
                actual: "div[attr='value']",
                expected: "div[attr='value']",
                shouldConvert: false,
            },
            {
                actual: 'div[attr="value"]',
                expected: 'div[attr="value"]',
                shouldConvert: false,
            },
            {
                actual: 'div[attr="value" i]',
                expected: 'div[attr="value" i]',
                shouldConvert: false,
            },

            // :-abp-contains(...) → :contains(...)
            {
                actual: '*:-abp-contains(test)',
                expected: '*:contains(test)',
                shouldConvert: true,
            },

            // :has-text(...) → :contains(...)
            {
                actual: '*:has-text(test)',
                expected: '*:contains(test)',
                shouldConvert: true,
            },

            // :-abp-has(...) → :has(...)
            {
                actual: '*:-abp-has(div)',
                expected: '*:has(div)',
                shouldConvert: true,
            },

            // [-abp-contains="..."] → :contains(...)
            {
                actual: '*[-abp-contains="test"]',
                expected: '*:contains(test)',
                shouldConvert: true,
            },

            // [-abp-has="..."] → :has(...)
            {
                actual: '*[-abp-has="div"]',
                expected: '*:has(div)',
                shouldConvert: true,
            },

            // [-ext-contains="..."] → :contains(...)
            {
                actual: '*[-ext-contains="test"]',
                expected: '*:contains(test)',
                shouldConvert: true,
            },

            // Convert 'matches-css-before' and 'matches-css-after' pseudo-classes
            {
                actual: 'div:matches-css-before(content:ad*)',
                expected: 'div:matches-css(before,content:ad*)',
                shouldConvert: true,
            },
            {
                actual: 'div:matches-css-before(color: rgb(255, 255, 255))',
                expected: 'div:matches-css(before,color: rgb(255, 255, 255))',
                shouldConvert: true,
            },
            {
                actual: 'div:matches-css-after(content:ad*)',
                expected: 'div:matches-css(after,content:ad*)',
                shouldConvert: true,
            },
            {
                actual: 'div:matches-css-after(color: rgb(255, 255, 255))',
                expected: 'div:matches-css(after,color: rgb(255, 255, 255))',
                shouldConvert: true,
            },

            // has
            {
                actual: 'div[-ext-has=".banner"]',
                expected: 'div:has(.banner)',
                shouldConvert: true,
            },
            {
                actual: 'div[-abp-has=".banner"]',
                expected: 'div:has(.banner)',
                shouldConvert: true,
            },
            {
                actual: 'div.test-class[-ext-has="time.g-time"]',
                expected: 'div.test-class:has(time.g-time)',
                shouldConvert: true,
            },
            {
                actual: 'div#test-div[-ext-has="#test"]',
                expected: 'div#test-div:has(#test)',
                shouldConvert: true,
            },
            {
                actual: '[-ext-has="div.advert"]',
                expected: ':has(div.advert)',
                shouldConvert: true,
            },
            {
                actual: '[-ext-has="div.test-class-two"]',
                expected: ':has(div.test-class-two)',
                shouldConvert: true,
            },
            {
                actual: '.block[-ext-has=\'a[href^="https://example.net/"]\']',
                expected: '.block:has(a[href^="https://example.net/"])',
                shouldConvert: true,
            },
            {
                actual: 'div[style*="z-index:"][-ext-has=\'>div[id$="_content"]>iframe#overlay_iframe\']',
                expected: 'div[style*="z-index:"]:has(>div[id$="_content"]>iframe#overlay_iframe)',
                shouldConvert: true,
            },

            // contains
            {
                actual: 'div a[-ext-contains="text"]',
                expected: 'div a:contains(text)',
                shouldConvert: true,
            },
            {
                actual: 'div a[-abp-contains="text"]',
                expected: 'div a:contains(text)',
                shouldConvert: true,
            },
            {
                actual: 'a[target="_blank"][-ext-contains="Advertisement"]',
                expected: 'a[target="_blank"]:contains(Advertisement)',
                shouldConvert: true,
            },
            {
                /* eslint-disable max-len */
                actual: 'div[style="text-align: center"] > b[-ext-contains="Ads:"]+a[href^="http://example.com/test.html?id="]+br',
                expected: 'div[style="text-align: center"] > b:contains(Ads:)+a[href^="http://example.com/test.html?id="]+br',
                /* eslint-enable max-len */
                shouldConvert: true,
            },

            // matches-css
            {
                actual: '#test-matches-css div[-ext-matches-css="background-image: url(data:*)"]',
                expected: '#test-matches-css div:matches-css(background-image: url(data:*))',
                shouldConvert: true,
            },
            {
                actual: '#test-opacity-property[-ext-matches-css="opacity: 0.9"]',
                expected: '#test-opacity-property:matches-css(opacity: 0.9)',
                shouldConvert: true,
            },
            {
                actual: '#test-matches-css div[-ext-matches-css-before="content: *find me*"]',
                expected: '#test-matches-css div:matches-css(before,content: *find me*)',
                shouldConvert: true,
            },
            {
                actual: '#test-matches-css div[-ext-matches-css-after="content: *find me*"]',
                expected: '#test-matches-css div:matches-css(after,content: *find me*)',
                shouldConvert: true,
            },

            // combinations
            {
                actual: 'div[-ext-contains="adg-test"][-ext-has="div.test-class-two"]',
                expected: 'div:contains(adg-test):has(div.test-class-two)',
                shouldConvert: true,
            },
            {
                actual: 'div[i18n][-ext-contains="adg-test"][-ext-has="div.test-class-two"]',
                expected: 'div[i18n]:contains(adg-test):has(div.test-class-two)',
                shouldConvert: true,
            },
            {
                actual: 'div[-ext-has="div.test-class-two"] > .test-class[-ext-contains="test"]',
                expected: 'div:has(div.test-class-two) > .test-class:contains(test)',
                shouldConvert: true,
            },
            {
                actual: '#sidebar div[class^="text-"][-ext-has=">.box-inner>h2:contains(ads)"]',
                expected: '#sidebar div[class^="text-"]:has(>.box-inner>h2:contains(ads))',
                shouldConvert: true,
            },
            {
                actual: '.sidebar > h3[-ext-has="a:contains(Recommended)"]',
                expected: '.sidebar > h3:has(a:contains(Recommended))',
                shouldConvert: true,
            },
            {
                actual: '.sidebar > h3[-ext-has="a:contains(Recommended)"] + div',
                expected: '.sidebar > h3:has(a:contains(Recommended)) + div',
                shouldConvert: true,
            },
            {
                actual: '*[-ext-contains=\'/\\s[a-t]{8}$/\'] + *:contains(/^[^\\"\\\'"]{30}quickly/)',
                expected: '*:contains(/\\s[a-t]{8}$/) + *:contains(/^[^\\"\\\'"]{30}quickly/)',
                shouldConvert: true,
            },
            {
                actual: '[-ext-matches-css-before=\'content:  /^[A-Z][a-z]{2}\\s/  \']',
                expected: ':matches-css(before,content:  /^[A-Z][a-z]{2}\\s/  )',
                shouldConvert: true,
            },
            {
                // eslint-disable-next-line max-len
                actual: '[-ext-has=\'+:matches-css-after( content  :   /(\\d+\\s)*me/  ):contains(/^(?![\\s\\S])/)\']',
                expected: ':has(+:matches-css(after, content  :   /(\\d+\\s)*me/  ):contains(/^(?![\\s\\S])/))',
                shouldConvert: true,
            },
            {
                /* eslint-disable max-len */
                actual: ':matches-css(    background-image: /^url\\((.)[a-z]{4}:[a-z]{2}\\1nk\\)$/    ) + [-ext-matches-css-before=\'content:  /^[A-Z][a-z]{2}\\s/  \'][-ext-has=\'+:matches-css-after( content  :   /(\\d+\\s)*me/  ):contains(/^(?![\\s\\S])/)\']',
                expected: ':matches-css(    background-image: /^url\\((.)[a-z]{4}:[a-z]{2}\\1nk\\)$/    ) + :matches-css(before,content:  /^[A-Z][a-z]{2}\\s/  ):has(+:matches-css(after, content  :   /(\\d+\\s)*me/  ):contains(/^(?![\\s\\S])/))',
                /* eslint-enable max-len */
                shouldConvert: true,
            },

            // Complicated case:
            //  - [-ext-has-text="test"] → :contains(test)
            //  - :-abp-has(div) → :has(div)
            //  - [-ext-matches-css-before="content: *find me*"] → :matches-css(before,content: *find me*)
            //  - :after → ::after
            {
                // eslint-disable-next-line max-len
                actual: 'div[-ext-has-text="test"]:-abp-has(div) + div[-ext-matches-css-before="content: *find me*"]:after',
                expected: 'div:contains(test):has(div) + div:matches-css(before,content: *find me*)::after',
                shouldConvert: true,
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected, shouldConvert }) => {
            // Convert the selector list with the converter API
            const conversionResult = CssSelectorConverter.convertToAdg(actual);

            expect(conversionResult).toHaveProperty('isConverted');
            expect(conversionResult.isConverted).toBe(shouldConvert);

            // Check the result
            expect(conversionResult.result).toBe(expected);
        });
    });
});
