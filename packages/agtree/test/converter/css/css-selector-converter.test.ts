/**
 * @file CSS conversion tests
 * We parse and serialize selectors while testing, just for convenience
 */

import { type SelectorListPlain } from '@adguard/ecss-tree';

import { CssSelectorConverter } from '../../../src/converter/css';
import { CssTree } from '../../../src/utils/csstree';
import { CssTreeParserContext } from '../../../src/utils/csstree-constants';

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
            // Parse the selector list into an AST
            const selectorListAst = CssTree.parsePlain(actual, CssTreeParserContext.selectorList) as SelectorListPlain;

            // Convert the selector list with the converter API
            const conversionResult = CssSelectorConverter.convertToAdg(selectorListAst);

            expect(conversionResult).toHaveProperty('isConverted');
            expect(conversionResult.isConverted).toBe(shouldConvert);

            if (conversionResult.isConverted) {
                // Object references should be different if the selector list was converted
                expect(conversionResult.result).not.toBe(selectorListAst);
            } else {
                // Object references should be the same if the selector list was not converted
                expect(conversionResult.result).toBe(selectorListAst);
            }

            // Serialize the converted selector list
            const convertedSelectorList = CssTree.generateSelectorListPlain(conversionResult.result);

            // Check the result
            expect(convertedSelectorList).toBe(expected);
        });
    });
});
