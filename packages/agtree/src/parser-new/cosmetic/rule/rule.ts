/**
 * @file CSS qualified rule AST builder.
 *
 * Reads preparsed data from an Int32Array (produced by
 * `CssRulePreparser.preparse()`) and builds a CssRule AST node. Delegates
 * to `SelectorListPreparser`/`SelectorListAstParser` for the prelude and
 * `DeclarationListPreparser`/`DeclarationListAstParser` for the block body,
 * unless sub-parsing is disabled via options.
 */

import type {
    CssBlock,
    CssDeclarationList,
    CssRule,
    CssRuleParseOptions,
    Raw,
    SelectorList,
} from '../../../nodes-new';
import type { PreparserContext } from '../../../preparser/context';
import { DeclarationListPreparser } from '../../../preparser/css/declaration-list';
import { DEFAULT_MAX_DECLARATIONS } from '../../../preparser/css/declaration-list/constants';
import { CssRulePreparser } from '../../../preparser/css/rule';
import { CR_HEADER_SIZE } from '../../../preparser/css/rule/constants';
import { SelectorListPreparser } from '../../../preparser/css/selector-list';
import { DEFAULT_MAX_COMPLEX, SL_MIN_DATA_SLOTS } from '../../../preparser/css/selector-list/constants';
import { DeclarationListAstParser } from '../declaration-list/declaration-list';
import { SelectorListAstParser } from '../selector-list/selector-list';

/**
 * CSS qualified rule AST builder.
 *
 * Reads structural boundaries from a pre-populated `Int32Array` and produces
 * a typed `CssRule` AST node. Optionally invokes sub-preparsers and
 * sub-AST-builders for the prelude (selector list) and block body
 * (declaration list).
 */
export class CssRuleAstParser {
    /**
     * Build a CssRule AST node from preparsed data.
     *
     * @param ctx Preparser context (needed for sub-preparsing selector/declaration lists).
     * @param source Original source string.
     * @param data Int32Array written by `CssRulePreparser.preparse()`.
     * @param dataOffset Base offset within `data` where rule data starts.
     * @param ruleStart Source offset of the first character of the rule
     *   (used for `CssRule.start` when `isLocIncluded` is true).
     * @param ruleEnd Source offset just past the last character of the rule
     *   (used for `CssRule.end` when `isLocIncluded` is true).
     * @param options Parse options.
     *
     * @returns CssRule AST node.
     */
    public static parse(
        ctx: PreparserContext,
        source: string,
        data: Int32Array,
        dataOffset: number = 0,
        ruleStart: number = 0,
        ruleEnd: number = source.length,
        options: CssRuleParseOptions = {},
    ): CssRule {
        const {
            isLocIncluded = true,
            parsePrelude = true,
            parseBlock = true,
        } = options;

        // All positions from the preparser are LOCAL (0-based within `source`)
        // because CssRuleParser always calls initPreparserContext with sourceStart=0.
        // We add `shift` (= ruleStart = baseOffset) to convert local offsets to
        // absolute positions for node boundary metadata, while keeping source.slice()
        // calls on the unshifted local offsets.
        const shift = ruleStart;

        // Read structural boundaries from preparsed data
        const slSourceStart = CssRulePreparser.selectorListSourceStart(data, dataOffset);
        const slSourceEnd = CssRulePreparser.selectorListSourceEnd(data, dataOffset);
        const slStartTi = CssRulePreparser.selectorListStartTi(data, dataOffset);
        const slEndTi = CssRulePreparser.selectorListEndTi(data, dataOffset);

        const openBraceSourcePos = CssRulePreparser.openBraceSourcePos(data, dataOffset);
        const closeBraceSourcePos = CssRulePreparser.closeBraceSourcePos(data, dataOffset);

        const dlSourceStart = CssRulePreparser.declListSourceStart(data, dataOffset);
        const dlSourceEnd = CssRulePreparser.declListSourceEnd(data, dataOffset);
        const dlStartTi = CssRulePreparser.declListStartTi(data, dataOffset);
        const dlEndTi = CssRulePreparser.declListEndTi(data, dataOffset);

        // --- Build prelude ---
        let prelude: SelectorList | Raw;

        if (parsePrelude) {
            // Sub-preparse selector list into the region after the rule header
            const slDataOffset = dataOffset + CR_HEADER_SIZE;
            const maxComplex = DEFAULT_MAX_COMPLEX;

            SelectorListPreparser.preparse(
                ctx,
                slStartTi,
                slEndTi,
                slDataOffset,
                maxComplex,
            );

            // Pass shifted boundary so SelectorList.start/end are absolute.
            prelude = SelectorListAstParser.parse(
                source,
                data,
                slDataOffset,
                maxComplex,
                slSourceStart + shift,
                slSourceEnd + shift,
                { isLocIncluded },
            );
        } else {
            // source.slice uses local (unshifted) offsets; metadata positions are shifted.
            const rawPrelude: Raw = {
                type: 'Raw',
                value: source.slice(slSourceStart, slSourceEnd),
            };
            if (isLocIncluded) {
                rawPrelude.start = slSourceStart + shift;
                rawPrelude.end = slSourceEnd + shift;
            }
            prelude = rawPrelude;
        }

        // --- Build block ---
        let block: CssBlock | Raw;

        if (parseBlock) {
            // Sub-preparse declaration list into the region after selector list data
            const dlDataOffset = dataOffset + CR_HEADER_SIZE + SL_MIN_DATA_SLOTS;
            const maxDeclarations = DEFAULT_MAX_DECLARATIONS;

            DeclarationListPreparser.preparse(
                ctx,
                dlStartTi,
                dlEndTi,
                dlDataOffset,
                maxDeclarations,
            );

            // Pass shifted boundary so CssDeclarationList.start/end are absolute.
            const declarationList: CssDeclarationList = DeclarationListAstParser.parse(
                source,
                data,
                dlDataOffset,
                maxDeclarations,
                dlSourceStart + shift,
                dlSourceEnd + shift,
                { isLocIncluded },
            );

            const cssBlock: CssBlock = {
                type: 'CssBlock',
                declarationList,
            };
            if (isLocIncluded) {
                cssBlock.start = openBraceSourcePos + shift;
                cssBlock.end = closeBraceSourcePos + 1 + shift;
            }
            block = cssBlock;
        } else {
            // source.slice uses local (unshifted) offsets; metadata positions are shifted.
            const rawBlock: Raw = {
                type: 'Raw',
                value: source.slice(dlSourceStart, dlSourceEnd),
            };
            if (isLocIncluded) {
                rawBlock.start = dlSourceStart + shift;
                rawBlock.end = dlSourceEnd + shift;
            }
            block = rawBlock;
        }

        // --- Build CssRule ---
        const result: CssRule = {
            type: 'CssRule',
            prelude,
            block,
        };

        if (isLocIncluded) {
            result.start = ruleStart;
            result.end = ruleEnd;
        }

        return result;
    }
}
