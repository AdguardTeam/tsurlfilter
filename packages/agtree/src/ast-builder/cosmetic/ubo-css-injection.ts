/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file CSS injection cosmetic rule AST builder for uBO rules.
 *
 * Builds `CssInjectionRule` AST nodes from parsed data produced by
 * `ElementHidingParser.parse()` when the body contains `:style()` or
 * `:remove()` action operators.
 *
 * The data layout reuses the cosmetic header + uBO modifier records
 * (stride 7) at `CR_UBO_MODS_OFFSET`. Body fields come from records:
 * `:matches-media()` → `mediaQueryList`, `:matches-path()` → `modifiers`,
 * `:style()` → `declarationList`, `:remove()` → `remove: true`.
 */

import { UboPseudoName } from '../../common/ubo-selector-common';
import {
    CosmeticRuleType,
    ListNodeType,
    NodeType,
    RuleCategory,
} from '../../nodes';
import type {
    CssDeclarationList,
    CssInjectionRule,
    CssInjectionRuleBody,
    DomainList,
    Modifier,
    ModifierList,
    Node,
    Raw,
    SelectorList,
    Value,
} from '../../nodes';
import { createParserContext, initParserContext, MAX_MODIFIER_RECORD_STRIDE } from '../../parser/context';
import type { ParserContext } from '../../parser/context';
import {
    CR_BODY_END,
    CR_BODY_START,
    CR_DOMAIN_COUNT,
    CR_FLAG_EXCEPTION,
    CR_FLAGS_OFFSET,
    CR_MODIFIER_COUNT_OFFSET,
    CR_SEP_LEN_MASK,
    CR_SEP_LEN_SHIFT,
    CR_SEP_SOURCE_START,
    CR_UBO_MODS_OFFSET,
    UBO_MOD_FIELD_FLAGS,
    UBO_MOD_FIELD_NAME_END,
    UBO_MOD_FIELD_NAME_START,
    UBO_MOD_FIELD_SRC_END,
    UBO_MOD_FIELD_SRC_START,
    UBO_MOD_FIELD_VALUE_END,
    UBO_MOD_FIELD_VALUE_START,
    UBO_MODIFIER_RECORD_STRIDE,
} from '../../parser/cosmetic/constants';
import { DeclarationListParser } from '../../parser/css/declaration-list';
import { DEFAULT_MAX_DECLARATIONS } from '../../parser/css/declaration-list/constants';
import { SelectorListParser } from '../../parser/css/selector-list';
import { DEFAULT_MAX_COMPLEX } from '../../parser/css/selector-list/constants';
import { MODIFIER_FLAG_NEGATED, NO_VALUE } from '../../parser/network/constants';
import { Tokenizer } from '../../tokenizer/tokenizer';
import { COMMA } from '../../utils/constants';
import { SYNTAX_UBO } from '../../utils/syntax-flags';
import { DomainListAstBuilder } from '../misc/domain-list';
import { type ParseOptions } from '../options';

import { tryCssSubParse } from './css-sub-parse';
import { DeclarationListAstBuilder } from './declaration-list/declaration-list';
import { SelectorListAstBuilder } from './selector-list/selector-list';

// ---------------------------------------------------------------------------
// Sub-parser singletons
// ---------------------------------------------------------------------------

const SUB_PARSE_TOKEN_CAPACITY = 1024;

/**
 * Lazily-allocated tokenizer + parser context used exclusively for CSS
 * sub-parsing inside `UboCssInjectionAstBuilder`. Allocated on first use
 * and reused across all subsequent calls.
 */
let subTokenizer: Tokenizer | undefined;
let subCtx: ParserContext | undefined;

/**
 * Ensure the module-level sub-parser singletons are initialized.
 *
 * @returns The shared tokenizer and parser context.
 */
function ensureSubParserContext(): { tokenizer: Tokenizer; ctx: ParserContext } {
    if (!subTokenizer || !subCtx) {
        subTokenizer = new Tokenizer(SUB_PARSE_TOKEN_CAPACITY);
        // createParserContext sizes ctx.data to at least HF_MIN_DATA_SLOTS
        // which covers SL_MIN_DATA_SLOTS starting at offset 0.
        subCtx = createParserContext(SUB_PARSE_TOKEN_CAPACITY, 1);
    }
    return { tokenizer: subTokenizer, ctx: subCtx };
}

/**
 * Map from character offsets in the cleaned selector text to character
 * offsets in the original rule source.
 *
 * `offsets[i]` is the source offset of `cleanedSelector[i]`.
 */
type SelectorOffsetMap = readonly number[];

/**
 * Translate a start offset from the cleaned selector text to the original
 * rule source. The offset is clamped to the map length.
 *
 * @param offsets Offset map of the cleaned selector text.
 * @param offset Start offset in the cleaned selector text.
 *
 * @returns Start offset in the original rule source.
 */
function mapStartOffset(offsets: SelectorOffsetMap, offset: number): number {
    if (offsets.length === 0) {
        return offset;
    }

    const index = offset < offsets.length ? offset : offsets.length - 1;

    return offsets[index];
}

/**
 * Translate an exclusive end offset from the cleaned selector text to the
 * original rule source. The offset is clamped to the map length.
 *
 * @param offsets Offset map of the cleaned selector text.
 * @param offset Exclusive end offset in the cleaned selector text.
 *
 * @returns Exclusive end offset in the original rule source.
 */
function mapEndOffset(offsets: SelectorOffsetMap, offset: number): number {
    if (offsets.length === 0) {
        return offset;
    }

    if (offset <= 0) {
        return offsets[0];
    }

    const index = offset - 1 < offsets.length ? offset - 1 : offsets.length - 1;

    return offsets[index] + 1;
}

/**
 * Remap the location of a node from cleaned-selector offsets to original
 * source offsets. Nodes without a location stay unchanged.
 *
 * @param node AST node whose location must be remapped.
 * @param offsets Offset map of the cleaned selector text.
 */
function remapNodeLocation(node: Node, offsets: SelectorOffsetMap): void {
    if (node.start !== undefined) {
        node.start = mapStartOffset(offsets, node.start);
    }

    if (node.end !== undefined) {
        node.end = mapEndOffset(offsets, node.end);
    }
}

/**
 * Remap the locations of all child nodes of a sub-parsed selector list.
 * The `SelectorList` node itself keeps its absolute range, which already
 * covers the full rule body.
 *
 * @param selectorList Sub-parsed selector list AST node.
 * @param offsets Offset map of the cleaned selector text.
 */
function remapSelectorLocations(selectorList: SelectorList, offsets: SelectorOffsetMap): void {
    for (let i = 0; i < selectorList.children.length; i += 1) {
        const complex = selectorList.children[i];
        remapNodeLocation(complex, offsets);

        for (let j = 0; j < complex.children.length; j += 1) {
            const child = complex.children[j];
            remapNodeLocation(child, offsets);

            switch (child.type) {
                case NodeType.AttributeSelector: {
                    remapNodeLocation(child.name, offsets);
                    if ('operator' in child) {
                        remapNodeLocation(child.operator, offsets);
                        remapNodeLocation(child.value, offsets);
                        if (child.flag !== undefined) {
                            remapNodeLocation(child.flag, offsets);
                        }
                    }
                    break;
                }
                case NodeType.PseudoClassSelector: {
                    remapNodeLocation(child.name, offsets);
                    if (child.argument !== undefined) {
                        remapNodeLocation(child.argument, offsets);
                    }
                    break;
                }
                default:
                    break;
            }
        }
    }
}

/**
 * Shift the location of a node by a constant source offset. Nodes without
 * a location stay unchanged.
 *
 * @param node AST node whose location must be shifted.
 * @param delta Offset to add to the node location.
 */
function shiftNodeLocation(node: Node, delta: number): void {
    if (node.start !== undefined) {
        node.start += delta;
    }

    if (node.end !== undefined) {
        node.end += delta;
    }
}

/**
 * CSS injection cosmetic rule AST builder for uBO `:style()` / `:remove()` rules.
 *
 * Handles element-hiding-separator rules (`##`, `#@#`, `#?#`, `#@?#`)
 * whose body contains `:style()` or `:remove()` action operators.
 */
export class UboCssInjectionAstBuilder {
    /**
     * Parse a uBO CSS injection rule from parsed data.
     *
     * @param source Source string.
     * @param data Int32Array with parsed data.
     * @param dataOffset Offset within `data` where the cosmetic rule header starts.
     * @param maxMods Maximum modifier capacity (for computing domain offset).
     * @param maxDomains Maximum domain capacity (currently unused; reserved for symmetry).
     * @param options Parse options.
     *
     * @returns CssInjectionRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number,
        maxMods: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        maxDomains: number,
        options: ParseOptions = {},
    ): CssInjectionRule {
        const {
            isLocIncluded = false,
            parseCssSelectorList = false,
            parseCssDeclarationList = false,
        } = options;

        const flags = data[dataOffset + CR_FLAGS_OFFSET];
        const exception = (flags & CR_FLAG_EXCEPTION) !== 0;
        const sepSourceStart = data[dataOffset + CR_SEP_SOURCE_START];
        const sepLen = (flags >>> CR_SEP_LEN_SHIFT) & CR_SEP_LEN_MASK;
        const sepSourceEnd = sepSourceStart + sepLen;
        const bodyStart = data[dataOffset + CR_BODY_START];
        const bodyEnd = data[dataOffset + CR_BODY_END];
        const uboModCount = data[dataOffset + CR_MODIFIER_COUNT_OFFSET];

        const domainCount = data[dataOffset + CR_DOMAIN_COUNT];
        const domainRecordsOffset = dataOffset + 5 + maxMods * MAX_MODIFIER_RECORD_STRIDE;
        const domains: DomainList = DomainListAstBuilder.parse(
            source,
            data,
            domainCount,
            domainRecordsOffset,
            COMMA,
            isLocIncluded,
        ) || {
            type: ListNodeType.DomainList,
            separator: COMMA,
            children: [],
        };

        // --- separator ---
        const separator: Value = {
            type: NodeType.Value,
            value: source.slice(sepSourceStart, sepSourceEnd),
        };
        if (isLocIncluded) {
            separator.start = sepSourceStart;
            separator.end = sepSourceEnd;
        }

        // --- walk uBO modifier records, segregate by name ---
        const matchesPathModifiers: Modifier[] = [];
        const srcRanges: Array<[number, number]> = [];
        let mediaQueryListNode: Value | undefined;
        let mediaQueryNegated = false;
        let styleValueStart = NO_VALUE;
        let styleValueEnd = NO_VALUE;
        let remove = false;

        for (let i = 0; i < uboModCount; i += 1) {
            const base = dataOffset + CR_UBO_MODS_OFFSET + i * UBO_MODIFIER_RECORD_STRIDE;
            const nameStart = data[base + UBO_MOD_FIELD_NAME_START];
            const nameEnd = data[base + UBO_MOD_FIELD_NAME_END];
            const modFlags = data[base + UBO_MOD_FIELD_FLAGS];
            const valueStart = data[base + UBO_MOD_FIELD_VALUE_START];
            const valueEnd = data[base + UBO_MOD_FIELD_VALUE_END];
            const srcStart = data[base + UBO_MOD_FIELD_SRC_START];
            const srcEnd = data[base + UBO_MOD_FIELD_SRC_END];

            const modName = source.slice(nameStart, nameEnd);

            // Always exclude this modifier's source from the cleaned selector
            srcRanges.push([srcStart, srcEnd]);

            switch (modName) {
                case UboPseudoName.MatchesPath: {
                    const isException = (modFlags & MODIFIER_FLAG_NEGATED) !== 0;
                    const nameNode: Value = { type: NodeType.Value, value: modName };
                    if (isLocIncluded) {
                        nameNode.start = nameStart;
                        nameNode.end = nameEnd;
                    }
                    const modifier: Modifier = {
                        type: NodeType.Modifier,
                        name: nameNode,
                        exception: isException || undefined,
                    };
                    if (valueStart !== NO_VALUE && valueEnd !== NO_VALUE) {
                        const valueNode: Value = {
                            type: NodeType.Value,
                            value: source.slice(valueStart, valueEnd),
                        };
                        if (isLocIncluded) {
                            valueNode.start = valueStart;
                            valueNode.end = valueEnd;
                        }
                        modifier.value = valueNode;
                    }
                    if (isLocIncluded) {
                        modifier.start = srcStart;
                        modifier.end = srcEnd;
                    }
                    matchesPathModifiers.push(modifier);
                    break;
                }

                case UboPseudoName.MatchesMedia: {
                    const mqValue = valueStart !== NO_VALUE && valueEnd !== NO_VALUE
                        ? source.slice(valueStart, valueEnd)
                        : '';
                    mediaQueryListNode = { type: NodeType.Value, value: mqValue };
                    if (isLocIncluded && valueStart !== NO_VALUE) {
                        mediaQueryListNode.start = valueStart;
                        mediaQueryListNode.end = valueEnd;
                    }
                    mediaQueryNegated = (modFlags & MODIFIER_FLAG_NEGATED) !== 0;
                    break;
                }

                case UboPseudoName.Style: {
                    styleValueStart = valueStart;
                    styleValueEnd = valueEnd;
                    break;
                }

                case UboPseudoName.Remove: {
                    remove = true;
                    break;
                }

                default:
                    // Unknown modifier — should not happen because the structural
                    // parser only records known uBO modifiers.
                    break;
            }
        }

        // build cleaned selector text (modifier ranges excised, trimmed)
        // srcRanges are sorted left-to-right because the scanner records them
        // sequentially.
        // When locations and selector sub-parsing are requested, also record
        // the source offset of every cleaned-selector character so the
        // sub-parser locations can be remapped to the original rule source.
        const collectOffsets = isLocIncluded && parseCssSelectorList;
        const selectorOffsets: number[] = [];
        let cleanedSelector = '';
        let cursor = bodyStart;
        for (let i = 0; i < srcRanges.length; i += 1) {
            const [rStart, rEnd] = srcRanges[i];
            if (cursor < rStart) {
                const chunk = source.slice(cursor, rStart);
                if (collectOffsets) {
                    for (let k = 0; k < chunk.length; k += 1) {
                        selectorOffsets.push(cursor + k);
                    }
                }
                cleanedSelector += chunk;
            }
            cursor = rEnd;
        }
        if (cursor < bodyEnd) {
            const chunk = source.slice(cursor, bodyEnd);
            if (collectOffsets) {
                for (let k = 0; k < chunk.length; k += 1) {
                    selectorOffsets.push(cursor + k);
                }
            }
            cleanedSelector += chunk;
        }

        if (collectOffsets) {
            const trimmedLeadingLength = cleanedSelector.length - cleanedSelector.trimStart().length;
            cleanedSelector = cleanedSelector.trim();
            selectorOffsets.splice(0, trimmedLeadingLength);
            selectorOffsets.length = cleanedSelector.length;
        } else {
            cleanedSelector = cleanedSelector.trim();
        }

        const selectorList: SelectorList | Raw = UboCssInjectionAstBuilder.buildSelector(
            cleanedSelector,
            bodyStart,
            bodyEnd,
            isLocIncluded,
            collectOffsets ? selectorOffsets : undefined,
            parseCssSelectorList,
        );

        let declarationList: CssDeclarationList | Raw | undefined;
        if (!remove) {
            declarationList = UboCssInjectionAstBuilder.buildDeclarations(
                source,
                styleValueStart,
                styleValueEnd,
                isLocIncluded,
                parseCssDeclarationList,
            );
        }

        const body: CssInjectionRuleBody = {
            type: NodeType.CssInjectionRuleBody,
            selectorList,
        };
        if (mediaQueryListNode) {
            body.mediaQueryList = mediaQueryListNode;
            if (mediaQueryNegated) {
                body.mediaQueryNegated = true;
            }
        }
        if (declarationList) {
            body.declarationList = declarationList;
        }
        if (remove) {
            body.remove = true;
        }
        if (isLocIncluded) {
            body.start = bodyStart;
            body.end = bodyEnd;
        }

        let modifiers: ModifierList | undefined;
        if (matchesPathModifiers.length > 0) {
            modifiers = {
                type: NodeType.ModifierList,
                children: matchesPathModifiers,
            };
            if (isLocIncluded) {
                // Span across the whole body (matches the legacy parser shape).
                modifiers.start = bodyStart;
                modifiers.end = bodyEnd;
            }
        }

        const rule: CssInjectionRule = {
            category: RuleCategory.Cosmetic,
            type: CosmeticRuleType.CssInjectionRule,
            syntax: SYNTAX_UBO,
            exception,
            modifiers,
            domains,
            separator,
            body,
        };
        if (isLocIncluded) {
            rule.start = 0;
            rule.end = source.length;
        }
        return rule;
    }

    /**
     * Build the selector node for the body. When `parseCss` is enabled,
     * sub-parses the cleaned selector text via `SelectorListParser` and
     * produces a `SelectorList` AST node. Otherwise produces a `Raw` node.
     *
     * The location span covers the FULL body range (matching legacy semantics),
     * not just the cleaned text.
     *
     * @param cleanedSelector Cleaned selector text (modifier ranges excised).
     * @param bodyStart Start offset of the body in the source.
     * @param bodyEnd End offset of the body in the source.
     * @param isLocIncluded Whether to include location info.
     * @param offsets Map from cleaned-selector offsets to original source offsets.
     * Undefined when locations are disabled or selector sub-parsing is off.
     * @param parseCss Whether to sub-parse into a `SelectorList` node.
     *
     * @returns Raw or SelectorList node for the selector list.
     */
    private static buildSelector(
        cleanedSelector: string,
        bodyStart: number,
        bodyEnd: number,
        isLocIncluded: boolean,
        offsets: SelectorOffsetMap | undefined,
        parseCss: boolean,
    ): SelectorList | Raw {
        if (!parseCss || cleanedSelector.length === 0) {
            return UboCssInjectionAstBuilder.buildRaw(cleanedSelector, bodyStart, bodyEnd, isLocIncluded);
        }

        // Sub-parse the cleaned selector text via the CSS pipeline.
        // We re-tokenize because the cleaned selector is a synthesized
        // string (modifier ranges have been excised from the original).
        const { tokenizer, ctx } = ensureSubParserContext();

        return tryCssSubParse(ctx, () => {
            tokenizer.source = cleanedSelector;
            tokenizer.offset = 0;
            tokenizer.tokenize();
            initParserContext(ctx, cleanedSelector, tokenizer);

            SelectorListParser.parse(ctx, 0, ctx.tokenCount, 0, DEFAULT_MAX_COMPLEX);

            const selectorList = SelectorListAstBuilder.parse(
                cleanedSelector,
                ctx.data,
                0,
                DEFAULT_MAX_COMPLEX,
                bodyStart,
                bodyEnd,
                { isLocIncluded },
            );

            if (offsets) {
                remapSelectorLocations(selectorList, offsets);
            }

            return selectorList;
        }) ?? UboCssInjectionAstBuilder.buildRaw(cleanedSelector, bodyStart, bodyEnd, isLocIncluded);
    }

    /**
     * Build the declaration-list node from the `:style()` value range.
     * When `parseCss` is enabled, sub-parses the declarations via
     * `DeclarationListParser`. Otherwise produces a `Raw` node.
     *
     * The value range is pre-trimmed by the structural parser.
     * `NO_VALUE` indicates an empty `:style()` value.
     *
     * @param source Source string.
     * @param valueStart Start offset of the declaration list value, or NO_VALUE.
     * @param valueEnd End offset of the declaration list value, or NO_VALUE.
     * @param isLocIncluded Whether to include location info.
     * @param parseCss Whether to sub-parse into a `CssDeclarationList` node.
     *
     * @returns Raw or CssDeclarationList node for the declaration list.
     */
    private static buildDeclarations(
        source: string,
        valueStart: number,
        valueEnd: number,
        isLocIncluded: boolean,
        parseCss: boolean,
    ): CssDeclarationList | Raw {
        if (valueStart === NO_VALUE || valueEnd === NO_VALUE) {
            // Empty declarations: always a Raw node, even if sub-parsing requested.
            return { type: NodeType.Raw, value: '' };
        }

        const declText = source.slice(valueStart, valueEnd);

        if (!parseCss) {
            return UboCssInjectionAstBuilder.buildRaw(declText, valueStart, valueEnd, isLocIncluded);
        }

        // Sub-parse via the CSS pipeline. The declaration text is a
        // contiguous sub-range of the original source, so we re-tokenize
        // a substring to keep the sub-parser stand-alone.
        const { tokenizer, ctx } = ensureSubParserContext();

        return tryCssSubParse(ctx, () => {
            tokenizer.source = declText;
            tokenizer.offset = 0;
            tokenizer.tokenize();
            initParserContext(ctx, declText, tokenizer);

            DeclarationListParser.parse(ctx, 0, ctx.tokenCount, 0, DEFAULT_MAX_DECLARATIONS);

            const declarationList = DeclarationListAstBuilder.parse(
                declText,
                ctx.data,
                0,
                DEFAULT_MAX_DECLARATIONS,
                valueStart,
                valueEnd,
                { isLocIncluded },
            );

            if (isLocIncluded) {
                // The declaration text is a contiguous slice of the source
                // starting at valueStart, so child locations are relative to
                // that slice and must be shifted back.
                for (let i = 0; i < declarationList.children.length; i += 1) {
                    const declaration = declarationList.children[i];
                    shiftNodeLocation(declaration, valueStart);
                    shiftNodeLocation(declaration.property, valueStart);
                    shiftNodeLocation(declaration.value, valueStart);
                }
            }

            return declarationList;
        }) ?? UboCssInjectionAstBuilder.buildRaw(declText, valueStart, valueEnd, isLocIncluded);
    }

    /**
     * Build a `Raw` node carrying the given text and, optionally, its source
     * range. Used by the sub-parse fallback path when the strict CSS parsers
     * reject a selector or declaration list.
     *
     * @param value Raw text.
     * @param start Source start offset.
     * @param end Source end offset.
     * @param isLocIncluded Whether to include location info.
     *
     * @returns Raw AST node.
     */
    private static buildRaw(value: string, start: number, end: number, isLocIncluded: boolean): Raw {
        const node: Raw = {
            type: NodeType.Raw,
            value,
        };
        if (isLocIncluded) {
            node.start = start;
            node.end = end;
        }
        return node;
    }
}
