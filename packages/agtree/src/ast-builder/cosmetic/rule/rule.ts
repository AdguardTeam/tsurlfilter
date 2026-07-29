/**
 * @file CSS qualified rule AST builder.
 *
 * Reads parsed data from an Int32Array (produced by
 * `CssRuleParser.parse()`) and builds a CssRule AST node. Delegates
 * to `SelectorListParser`/`SelectorListAstBuilder` for the prelude and
 * `DeclarationListParser`/`DeclarationListAstBuilder` for the block body,
 * unless sub-parsing is disabled via options.
 */

import type {
    CssBlock,
    CssDeclarationList,
    CssRule,
    CssRuleParseOptions,
    Raw,
    SelectorList,
} from '../../../nodes';
import { NodeType } from '../../../nodes';
import type { ParserContext } from '../../../parser/context';
import { DeclarationListParser } from '../../../parser/css/declaration-list';
import { DEFAULT_MAX_DECLARATIONS } from '../../../parser/css/declaration-list/constants';
import { CssRuleParser } from '../../../parser/css/rule';
import { CR_HEADER_SIZE } from '../../../parser/css/rule/constants';
import { SelectorListParser } from '../../../parser/css/selector-list';
import { DEFAULT_MAX_COMPLEX, SL_MIN_DATA_SLOTS } from '../../../parser/css/selector-list/constants';
import { DeclarationListAstBuilder } from '../declaration-list/declaration-list';
import { SelectorListAstBuilder } from '../selector-list/selector-list';

/**
 * CSS qualified rule AST builder.
 *
 * Reads structural boundaries from a pre-populated `Int32Array` and produces
 * a typed `CssRule` AST node. Optionally invokes sub-parsers and
 * sub-AST-builders for the prelude (selector list) and block body
 * (declaration list).
 */
export class CssRuleAstBuilder {
    /**
     * Build a CssRule AST node from parsed data.
     *
     * @param ctx Parser context (needed for sub-preparsing selector/declaration lists).
     * @param source Original source string.
     * @param data Int32Array written by `CssRuleParser.parse()`.
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
        ctx: ParserContext,
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

        // All positions from the parser are LOCAL (0-based within `source`)
        // because CssRuleParser always calls initParserContext with sourceStart=0.
        // We add `shift` (= ruleStart = baseOffset) to convert local offsets to
        // absolute positions for node boundary metadata, while keeping source.slice()
        // calls on the unshifted local offsets.
        const shift = ruleStart;

        // Read structural boundaries from parsed data
        const slSourceStart = CssRuleParser.selectorListSourceStart(data, dataOffset);
        const slSourceEnd = CssRuleParser.selectorListSourceEnd(data, dataOffset);
        const slStartTi = CssRuleParser.selectorListStartTi(data, dataOffset);
        const slEndTi = CssRuleParser.selectorListEndTi(data, dataOffset);

        const openBraceSourcePos = CssRuleParser.openBraceSourcePos(data, dataOffset);
        const closeBraceSourcePos = CssRuleParser.closeBraceSourcePos(data, dataOffset);

        const dlSourceStart = CssRuleParser.declListSourceStart(data, dataOffset);
        const dlSourceEnd = CssRuleParser.declListSourceEnd(data, dataOffset);
        const dlStartTi = CssRuleParser.declListStartTi(data, dataOffset);
        const dlEndTi = CssRuleParser.declListEndTi(data, dataOffset);

        // --- Build prelude ---
        let prelude: SelectorList | Raw;

        if (parsePrelude) {
            // Sub-parse selector list into the region after the rule header
            const slDataOffset = dataOffset + CR_HEADER_SIZE;
            const maxComplex = DEFAULT_MAX_COMPLEX;

            SelectorListParser.parse(
                ctx,
                slStartTi,
                slEndTi,
                slDataOffset,
                maxComplex,
            );

            // Pass shifted boundary so SelectorList.start/end are absolute.
            prelude = SelectorListAstBuilder.parse(
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
                type: NodeType.Raw,
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
            // Sub-parse declaration list into the region after selector list data
            const dlDataOffset = dataOffset + CR_HEADER_SIZE + SL_MIN_DATA_SLOTS;
            const maxDeclarations = DEFAULT_MAX_DECLARATIONS;

            DeclarationListParser.parse(
                ctx,
                dlStartTi,
                dlEndTi,
                dlDataOffset,
                maxDeclarations,
            );
            if (ctx.status === 1) {
                throw new Error('Parser data buffer overflow: declaration list too large for current capacity');
            }

            // Pass shifted boundary so CssDeclarationList.start/end are absolute.
            const declarationList: CssDeclarationList = DeclarationListAstBuilder.parse(
                source,
                data,
                dlDataOffset,
                maxDeclarations,
                dlSourceStart + shift,
                dlSourceEnd + shift,
                { isLocIncluded },
            );

            const cssBlock: CssBlock = {
                type: NodeType.CssBlock,
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
                type: NodeType.Raw,
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
            type: NodeType.CssRule,
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
