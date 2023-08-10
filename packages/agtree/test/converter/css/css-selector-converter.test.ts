/**
 * @file CSS conversion tests
 * We parse and serialize selectors while testing, just for convenience
 */

import { type SelectorList } from '@adguard/ecss-tree';

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
            },
            {
                actual: 'div[attr]',
                expected: 'div[attr]',
            },
            {
                actual: 'div[attr=value]',
                expected: 'div[attr=value]',
            },

            // :-abp-contains(...) → :contains(...)
            {
                actual: '*:-abp-contains(test)',
                expected: '*:contains(test)',
            },

            // :has-text(...) → :contains(...)
            {
                actual: '*:has-text(test)',
                expected: '*:contains(test)',
            },

            // :-abp-has(...) → :has(...)
            {
                actual: '*:-abp-has(div)',
                expected: '*:has(div)',
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
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected }) => {
            // Parse the selector list into an AST
            const selectorListAst = CssTree.parse(actual, CssTreeParserContext.selectorList) as SelectorList;

            // Convert the selector list with the converter API
            const convertedSelectorListAst = CssSelectorConverter.convertToAdg(selectorListAst);

            // Serialize the converted selector list
            const convertedSelectorList = CssTree.generateSelectorList(convertedSelectorListAst);

            // Check the result
            expect(convertedSelectorList).toBe(expected);
        });
    });
});
