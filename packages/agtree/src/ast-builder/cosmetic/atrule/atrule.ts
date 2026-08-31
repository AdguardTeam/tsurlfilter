/**
 * @file CSS at-rule AST builder.
 *
 * Reads parsed data from an Int32Array (produced by
 * `CssAtRuleParser.parse()`) and builds a `CssAtRule` AST node.
 *
 * When `parseBlock` is true and the block body contains a CSS qualified
 * rule (detected by a nested `{`), delegates to `CssRuleParser` and
 * `CssRuleAstBuilder`. When the block contains bare declarations (e.g.,
 * `@font-face`), delegates to `DeclarationListParser` and
 * `DeclarationListAstBuilder` directly.
 */

import type {
    CssAtRule,
    CssAtRuleParseOptions,
    CssAtRulePrelude,
    CssBlock,
    CssDeclarationList,
    Raw,
    Value,
} from '../../../nodes';
import { NodeType } from '../../../nodes';
import type { ParserContext } from '../../../parser/context';
import { CssAtRuleParser } from '../../../parser/css/atrule';
import { AT_HEADER_SIZE, AT_NO_VALUE } from '../../../parser/css/atrule/constants';
import { DeclarationListParser } from '../../../parser/css/declaration-list';
import { DEFAULT_MAX_DECLARATIONS } from '../../../parser/css/declaration-list/constants';
import { CssRuleParser } from '../../../parser/css/rule';
import { TokenType } from '../../../tokenizer/token-types';
import { DeclarationListAstBuilder } from '../declaration-list/declaration-list';
import { CssRuleAstBuilder } from '../rule/rule';

/**
 * CSS at-rule AST builder.
 *
 * Reads structural boundaries from a pre-populated `Int32Array` and produces
 * a typed `CssAtRule` AST node. Optionally delegates to sub-parsers for the
 * block body content.
 */
export class CssAtRuleAstBuilder {
    /**
     * Build a `CssAtRule` AST node from parsed data.
     *
     * @param ctx Parser context (needed for block body sub-parsing).
     * @param source Original source string.
     * @param data Int32Array written by `CssAtRuleParser.parse()`.
     * @param dataOffset Base offset within `data` where at-rule data starts.
     * @param ruleStart Source offset of the first character of the at-rule
     *   (absolute, used for `CssAtRule.start` and as a shift for child nodes).
     * @param ruleEnd Source offset just past the last character of the at-rule
     *   (absolute, used for `CssAtRule.end`).
     * @param options Parse options.
     *
     * @returns `CssAtRule` AST node.
     */
    public static parse(
        ctx: ParserContext,
        source: string,
        data: Int32Array,
        dataOffset: number = 0,
        ruleStart: number = 0,
        ruleEnd: number = source.length,
        options: CssAtRuleParseOptions = {},
    ): CssAtRule {
        const {
            isLocIncluded = true,
            parsePrelude = true,
            parseBlock = true,
            parseBlockRules = true,
        } = options;

        // All positions read from `data` are local (0-based within `source`).
        // We add `shift` to convert them to absolute positions for node metadata.
        const shift = ruleStart;

        // --- Read structural boundaries from parsed data ---
        const atSourceStart = CssAtRuleParser.sourceStart(data, dataOffset);

        const nameSourceStart = CssAtRuleParser.nameSourceStart(data, dataOffset);
        const nameSourceEnd = CssAtRuleParser.nameSourceEnd(data, dataOffset);

        const preludeSourceStart = CssAtRuleParser.preludeSourceStart(data, dataOffset);
        const preludeSourceEnd = CssAtRuleParser.preludeSourceEnd(data, dataOffset);

        const openBracePos = CssAtRuleParser.openBracePos(data, dataOffset);
        const closeBracePos = CssAtRuleParser.closeBracePos(data, dataOffset);

        const blockStartTi = CssAtRuleParser.blockStartTi(data, dataOffset);
        const blockEndTi = CssAtRuleParser.blockEndTi(data, dataOffset);

        // --- Build name node ---
        const name: Value = {
            type: NodeType.Value,
            value: source.slice(nameSourceStart, nameSourceEnd),
        };
        if (isLocIncluded) {
            name.start = nameSourceStart + shift;
            name.end = nameSourceEnd + shift;
        }

        // --- Build prelude node ---
        let prelude: CssAtRulePrelude | Raw | null;

        if (preludeSourceStart === AT_NO_VALUE) {
            prelude = null;
        } else if (parsePrelude) {
            const atRulePrelude: CssAtRulePrelude = {
                type: NodeType.CssAtRulePrelude,
                value: source.slice(preludeSourceStart, preludeSourceEnd),
            };
            if (isLocIncluded) {
                atRulePrelude.start = preludeSourceStart + shift;
                atRulePrelude.end = preludeSourceEnd + shift;
            }
            prelude = atRulePrelude;
        } else {
            const rawPrelude: Raw = {
                type: NodeType.Raw,
                value: source.slice(preludeSourceStart, preludeSourceEnd),
            };
            if (isLocIncluded) {
                rawPrelude.start = preludeSourceStart + shift;
                rawPrelude.end = preludeSourceEnd + shift;
            }
            prelude = rawPrelude;
        }

        // --- Build block node ---
        let block: CssBlock | Raw | null;

        if (openBracePos === AT_NO_VALUE) {
            // Statement at-rule: no block.
            block = null;
        } else if (!parseBlock) {
            // Return block body as raw text (between `{` and `}`).
            const rawBlock: Raw = {
                type: NodeType.Raw,
                value: source.slice(openBracePos + 1, closeBracePos),
            };
            if (isLocIncluded) {
                rawBlock.start = openBracePos + 1 + shift;
                rawBlock.end = closeBracePos + shift;
            }
            block = rawBlock;
        } else {
            // parseBlock=true → produce a CssBlock.
            const bodyDataOffset = dataOffset + AT_HEADER_SIZE;
            const blockIsEmpty = blockStartTi >= blockEndTi;

            if (!blockIsEmpty && parseBlockRules) {
                // Check if the block body contains a nested `{` (qualified rule).
                let blockHasQualifiedRule = false;
                for (let ti = blockStartTi; ti < blockEndTi; ti += 1) {
                    if (ctx.types[ti] === TokenType.OpenBrace) {
                        blockHasQualifiedRule = true;
                        break;
                    }
                }

                if (blockHasQualifiedRule) {
                    // Block body is a CSS qualified rule (e.g., `selector { decls }`).
                    // Delegate to CssRuleParser + CssRuleAstBuilder. The CssRule.block
                    // already contains a CssBlock with declarationList.
                    //
                    // If the sub-parsers throw (e.g., unsupported CSS feature such as
                    // pseudo-element selectors), fall back to an empty CssBlock.
                    let declarationList: CssDeclarationList;

                    try {
                        CssRuleParser.parse(ctx, blockStartTi, blockEndTi, bodyDataOffset);

                        const innerRule = CssRuleAstBuilder.parse(
                            ctx,
                            source,
                            data,
                            bodyDataOffset,
                            shift,
                            ruleEnd,
                            { isLocIncluded },
                        );

                        // innerRule.block is a CssBlock — extract its declarationList.
                        declarationList = innerRule.block.type === NodeType.CssBlock
                            ? innerRule.block.declarationList
                            : { type: NodeType.CssDeclarationList, children: [] };
                    } catch {
                        // Sub-parser does not support this inner rule
                        // (e.g., pseudo-element selectors like `::after`).
                        declarationList = { type: NodeType.CssDeclarationList, children: [] };
                    }

                    const cssBlock: CssBlock = {
                        type: NodeType.CssBlock,
                        declarationList,
                    };
                    if (isLocIncluded) {
                        cssBlock.start = openBracePos + shift;
                        cssBlock.end = closeBracePos + 1 + shift;
                    }
                    block = cssBlock;
                } else {
                    // Block body contains bare declarations (e.g., `@font-face`).
                    DeclarationListParser.parse(
                        ctx,
                        blockStartTi,
                        blockEndTi,
                        bodyDataOffset,
                        DEFAULT_MAX_DECLARATIONS,
                    );
                    if (ctx.status === 1) {
                        // eslint-disable-next-line max-len
                        throw new Error('Parser data buffer overflow: declaration list too large for current capacity');
                    }

                    const declarationList: CssDeclarationList = DeclarationListAstBuilder.parse(
                        source,
                        data,
                        bodyDataOffset,
                        DEFAULT_MAX_DECLARATIONS,
                        openBracePos + 1 + shift,
                        closeBracePos + shift,
                        { isLocIncluded },
                    );

                    const cssBlock: CssBlock = {
                        type: NodeType.CssBlock,
                        declarationList,
                    };
                    if (isLocIncluded) {
                        cssBlock.start = openBracePos + shift;
                        cssBlock.end = closeBracePos + 1 + shift;
                    }
                    block = cssBlock;
                }
            } else if (!blockIsEmpty) {
                // parseBlockRules=false, non-empty block → preserve content as Raw.
                const rawStart = blockStartTi === 0
                    ? ctx.sourceStart
                    : ctx.ends[blockStartTi - 1];
                const rawEnd = ctx.ends[blockEndTi - 1];

                const rawBlock: Raw = {
                    type: NodeType.Raw,
                    value: source.slice(rawStart, rawEnd),
                };
                if (isLocIncluded) {
                    rawBlock.start = rawStart + shift;
                    rawBlock.end = rawEnd + shift;
                }
                block = rawBlock;
            } else {
                // parseBlockRules=false, empty block — CssBlock with no declarations.
                const declarationList: CssDeclarationList = {
                    type: NodeType.CssDeclarationList,
                    children: [],
                };
                if (isLocIncluded) {
                    declarationList.start = openBracePos + 1 + shift;
                    declarationList.end = closeBracePos + shift;
                }

                const cssBlock: CssBlock = {
                    type: NodeType.CssBlock,
                    declarationList,
                };
                if (isLocIncluded) {
                    cssBlock.start = openBracePos + shift;
                    cssBlock.end = closeBracePos + 1 + shift;
                }
                block = cssBlock;
            }
        }

        // --- Build CssAtRule node ---
        const result: CssAtRule = {
            type: NodeType.CssAtRule,
            name,
            prelude,
            block,
        };
        if (isLocIncluded) {
            result.start = atSourceStart + shift;
            result.end = ruleEnd;
        }

        return result;
    }
}
