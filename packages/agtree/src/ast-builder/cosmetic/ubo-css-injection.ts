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
import {
    COMMA,
    CR,
    FF,
    LF,
    SPACE,
    TAB,
} from '../../utils/constants';
import { SYNTAX_UBO } from '../../utils/syntax-flags';
import { walk } from '../../walker';
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
 * One contiguous kept range of the cleaned selector text.
 *
 * `cleanedStart` is the offset of the range start in the cleaned selector
 * text, `sourceStart` is the offset of the same character in the original
 * rule source, and `length` is the number of characters in the range.
 */
interface SelectorOffsetSegment {
    cleanedStart: number;
    sourceStart: number;
    length: number;
}

/**
 * Segment map from offsets in the cleaned selector text to offsets in the
 * original rule source.
 *
 * The segments are sorted and contiguous in the cleaned selector text. A
 * single kept range therefore reduces to a constant shift, and no
 * per-character allocation is needed. The map is built only when locations
 * and selector sub-parsing are both requested. It always holds at least one
 * segment when it is used, because `buildSelector()` returns a `Raw` node
 * for an empty cleaned selector before the map is applied.
 */
type SelectorOffsetMap = readonly SelectorOffsetSegment[];

/**
 * Find the segment that contains a cleaned selector offset.
 *
 * An offset before the first segment selects the first segment. An offset
 * at or past the end of the cleaned selector selects the last segment.
 *
 * @param segments Segment map of the cleaned selector text.
 * @param offset Offset in the cleaned selector text.
 *
 * @returns Index of the matching segment.
 */
function findSegmentIndex(segments: SelectorOffsetMap, offset: number): number {
    let low = 0;
    let high = segments.length - 1;

    while (low < high) {
        const middle = Math.floor((low + high + 1) / 2);
        if (segments[middle].cleanedStart <= offset) {
            low = middle;
        } else {
            high = middle - 1;
        }
    }

    return low;
}

/**
 * Translate a start offset from the cleaned selector text to the original
 * rule source.
 *
 * The binary search finds the segment that contains the offset. An offset
 * that is at or past the end of the cleaned selector is clamped to the last
 * cleaned character of that segment, so the result is the source offset of
 * that character and not one past the end.
 *
 * @param segments Segment map of the cleaned selector text.
 * @param offset Start offset in the cleaned selector text.
 *
 * @returns Start offset in the original rule source.
 */
function mapStartOffset(segments: SelectorOffsetMap, offset: number): number {
    const segment = segments[findSegmentIndex(segments, offset)];
    const relativeOffset = offset - segment.cleanedStart;
    const clampedOffset = Math.min(Math.max(relativeOffset, 0), segment.length - 1);

    return segment.sourceStart + clampedOffset;
}

/**
 * Translate an exclusive end offset from the cleaned selector text to the
 * original rule source.
 *
 * An end offset at or below zero maps to the start of the first segment.
 * Any other end offset is clamped to the last cleaned character of the
 * segment that contains `offset - 1`, then the source offset of that
 * character is incremented by one. An end offset past the end of the
 * cleaned selector therefore maps to one past its last character.
 *
 * @param segments Segment map of the cleaned selector text.
 * @param offset Exclusive end offset in the cleaned selector text.
 *
 * @returns Exclusive end offset in the original rule source.
 */
function mapEndOffset(segments: SelectorOffsetMap, offset: number): number {
    if (offset <= 0) {
        return segments[0].sourceStart;
    }

    const lastOffset = offset - 1;
    const segment = segments[findSegmentIndex(segments, lastOffset)];
    const relativeOffset = lastOffset - segment.cleanedStart;
    const clampedOffset = Math.min(Math.max(relativeOffset, 0), segment.length - 1);

    return segment.sourceStart + clampedOffset + 1;
}

/**
 * Remap the location of a node from cleaned-selector offsets to original
 * source offsets. Nodes without a location stay unchanged.
 *
 * A node that is zero-width in the cleaned selector stays zero-width: the
 * start is mapped first, then the end is clamped to the mapped start. An
 * excised modifier between `start - 1` and `start` would otherwise map the
 * two offsets to opposite sides of the gap.
 *
 * @param node AST node whose location must be remapped.
 * @param segments Segment map of the cleaned selector text.
 */
function remapNodeLocation(node: Node, segments: SelectorOffsetMap): void {
    const isZeroWidth = node.start !== undefined
        && node.end !== undefined
        && node.start === node.end;
    const mappedStart = node.start !== undefined
        ? mapStartOffset(segments, node.start)
        : undefined;

    if (mappedStart !== undefined) {
        node.start = mappedStart;
    }

    if (node.end !== undefined) {
        node.end = isZeroWidth && mappedStart !== undefined
            ? mappedStart
            : mapEndOffset(segments, node.end);
    }
}

/**
 * Check whether a source character is CSS whitespace.
 *
 * Mirrors the CSS Syntax definition used by the sub-parser: a space, a tab,
 * or a newline (LF, CR, or FF). A CRLF pair is therefore part of one
 * whitespace run.
 *
 * @param char Character to check, or `undefined` past the end of the source.
 *
 * @returns `true` if the character is CSS whitespace.
 */
function isCssWhitespaceCharacter(char: string | undefined): boolean {
    return char === SPACE
        || char === TAB
        || char === LF
        || char === CR
        || char === FF;
}

/**
 * Point a whitespace combinator at one contiguous whitespace run in the
 * original source.
 *
 * The start is mapped as usual. The end is clamped to the end of the
 * whitespace run that starts at the mapped start, and never past the kept
 * source segment that contains it. Therefore
 * `source.slice(node.start, node.end)` is whitespace only and cannot
 * include an excised modifier.
 *
 * @param node Whitespace combinator node whose location is in cleaned offsets.
 * @param segments Segment map of the cleaned selector text.
 * @param source Original rule source.
 */
function remapWhitespaceCombinator(
    node: Node,
    segments: SelectorOffsetMap,
    source: string,
): void {
    if (node.start === undefined) {
        return;
    }

    const segment = segments[findSegmentIndex(segments, node.start)];
    const relativeOffset = node.start - segment.cleanedStart;
    const clampedOffset = Math.min(Math.max(relativeOffset, 0), segment.length - 1);
    const start = segment.sourceStart + clampedOffset;
    const segmentEnd = segment.sourceStart + segment.length;

    let end = start;
    while (end < segmentEnd && isCssWhitespaceCharacter(source[end])) {
        end += 1;
    }

    node.start = start;
    node.end = Math.max(end, start + 1);
}

/**
 * Remap the locations of all child nodes of a sub-parsed selector list.
 * The root `SelectorList` node keeps its absolute range, which already
 * covers the full rule body.
 *
 * @param selectorList Sub-parsed selector list AST node.
 * @param segments Segment map of the cleaned selector text.
 * @param source Original rule source.
 */
function remapSelectorLocations(
    selectorList: SelectorList,
    segments: SelectorOffsetMap,
    source: string,
): void {
    walk(selectorList, {
        enter: (node, parent) => {
            if (parent === null) {
                // The root selector list keeps its absolute body range.
                return;
            }

            if (node.type === NodeType.SelectorCombinator && node.value === SPACE) {
                remapWhitespaceCombinator(node, segments, source);
                return;
            }

            remapNodeLocation(node, segments);
        },
    });
}

/**
 * Clip a segment map to a window of the cleaned selector text and rebase
 * the remaining segments to the window start.
 *
 * Segments fully outside the window are dropped. Segments that cross a
 * window edge are shortened and keep the matching source range.
 *
 * @param segments Segment map of the cleaned selector text.
 * @param windowStart Start of the kept window in cleaned-selector offsets.
 * @param windowEnd Exclusive end of the kept window in cleaned-selector offsets.
 */
function clipSelectorSegments(
    segments: SelectorOffsetSegment[],
    windowStart: number,
    windowEnd: number,
): void {
    let writeIndex = 0;

    for (let readIndex = 0; readIndex < segments.length; readIndex += 1) {
        const segment = segments[readIndex];
        const segmentEnd = segment.cleanedStart + segment.length;
        const clippedStart = Math.max(segment.cleanedStart, windowStart);
        const clippedEnd = Math.min(segmentEnd, windowEnd);

        if (clippedStart >= clippedEnd) {
            continue;
        }

        segments[writeIndex] = {
            cleanedStart: clippedStart - windowStart,
            sourceStart: segment.sourceStart + (clippedStart - segment.cleanedStart),
            length: clippedEnd - clippedStart,
        };
        writeIndex += 1;
    }

    segments.length = writeIndex;
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
        // one segment per kept source range so the sub-parser locations can
        // be remapped to the original rule source without per-character work.
        const collectOffsets = isLocIncluded && parseCssSelectorList;
        const selectorSegments: SelectorOffsetSegment[] = [];
        let cleanedSelector = '';
        let cursor = bodyStart;

        const appendKeptRange = (start: number, end: number): void => {
            if (start >= end) {
                return;
            }

            if (collectOffsets) {
                selectorSegments.push({
                    cleanedStart: cleanedSelector.length,
                    sourceStart: start,
                    length: end - start,
                });
            }

            cleanedSelector += source.slice(start, end);
        };

        for (let i = 0; i < srcRanges.length; i += 1) {
            const [rStart, rEnd] = srcRanges[i];
            appendKeptRange(cursor, rStart);
            cursor = rEnd;
        }
        appendKeptRange(cursor, bodyEnd);

        if (collectOffsets) {
            const trimmedSelector = cleanedSelector.trim();
            const trimmedStart = cleanedSelector.length - cleanedSelector.trimStart().length;
            clipSelectorSegments(selectorSegments, trimmedStart, trimmedStart + trimmedSelector.length);
            cleanedSelector = trimmedSelector;
        } else {
            cleanedSelector = cleanedSelector.trim();
        }

        const selectorList: SelectorList | Raw = UboCssInjectionAstBuilder.buildSelector(
            source,
            cleanedSelector,
            bodyStart,
            bodyEnd,
            isLocIncluded,
            collectOffsets ? selectorSegments : undefined,
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
     * @param source Original rule source.
     * @param cleanedSelector Cleaned selector text (modifier ranges excised).
     * @param bodyStart Start offset of the body in the source.
     * @param bodyEnd End offset of the body in the source.
     * @param isLocIncluded Whether to include location info.
     * @param offsets Segment map from cleaned-selector offsets to original
     * source offsets. Undefined when locations are disabled or selector
     * sub-parsing is off.
     * @param parseCss Whether to sub-parse into a `SelectorList` node.
     *
     * @returns Raw or SelectorList node for the selector list.
     */
    private static buildSelector(
        source: string,
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
                remapSelectorLocations(selectorList, offsets, source);
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
                // starting at `valueStart`, so locations reported by the
                // declaration sub-parser are relative to that slice and must
                // be shifted back. Walking instead of shifting the known
                // `declaration`, `property`, and `value` nodes keeps any
                // located field added to `CssDeclaration` later absolute.
                walk(declarationList, {
                    enter: (node, parent) => {
                        if (parent === null) {
                            // The declaration list keeps its absolute value range.
                            return;
                        }

                        shiftNodeLocation(node, valueStart);
                    },
                });
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
