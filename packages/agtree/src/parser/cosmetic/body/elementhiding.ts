/**
 * @file Element hiding rule body parser
 */

import { fromPlainObject, type SelectorList, type SelectorListPlain } from '@adguard/ecss-tree';

import { CssTree } from '../../../utils/csstree';
import { CssTreeParserContext } from '../../../utils/csstree-constants';
import { defaultLocation, type ElementHidingRuleBody } from '../../common';
import { locRange } from '../../../utils/location';

/**
 * `ElementHidingBodyParser` is responsible for parsing element hiding rule bodies.
 *
 * It delegates CSS parsing to CSSTree, which is tolerant and therefore able to
 * parse Extended CSS parts as well.
 *
 * Please note that this parser will read ANY selector if it is syntactically correct.
 * Checking whether this selector is actually compatible with a given adblocker is not
 * done at this level.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors}
 * @see {@link https://github.com/AdguardTeam/ExtendedCss}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters#cosmetic-filter-operators}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide-emulation}
 * @see {@link https://github.com/csstree/csstree/tree/master/docs}
 */
export class ElementHidingBodyParser {
    /**
     * Parses a raw cosmetic rule body as an element hiding rule body.
     *
     * @param raw Raw body
     * @param loc Location of the body
     * @returns Element hiding rule body AST
     * @throws If the selector is invalid according to the CSS syntax
     */
    public static parse(raw: string, loc = defaultLocation): ElementHidingRuleBody {
        // eslint-disable-next-line max-len
        const selectorList: SelectorListPlain = <SelectorListPlain>CssTree.parsePlain(raw, CssTreeParserContext.selectorList, false, loc);

        return {
            type: 'ElementHidingRuleBody',
            loc: locRange(loc, 0, raw.length),
            selectorList,
        };
    }

    /**
     * Converts an element hiding rule body AST to a string.
     *
     * @param ast Element hiding rule body AST
     * @returns Raw string
     * @throws If the AST is invalid
     */
    public static generate(ast: ElementHidingRuleBody): string {
        return CssTree.generateSelectorList(<SelectorList>fromPlainObject(ast.selectorList));
    }
}
