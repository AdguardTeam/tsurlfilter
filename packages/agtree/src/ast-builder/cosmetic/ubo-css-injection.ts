/* eslint-disable no-bitwise */

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
        let cleanedSelector = '';
        let cursor = bodyStart;
        for (let i = 0; i < srcRanges.length; i += 1) {
            const [rStart, rEnd] = srcRanges[i];
            if (cursor < rStart) {
                cleanedSelector += source.slice(cursor, rStart);
            }
            cursor = rEnd;
        }
        if (cursor < bodyEnd) {
            cleanedSelector += source.slice(cursor, bodyEnd);
        }
        cleanedSelector = cleanedSelector.trim();

        const selectorList: SelectorList | Raw = UboCssInjectionAstBuilder.buildSelector(
            cleanedSelector,
            bodyStart,
            bodyEnd,
            isLocIncluded,
            source,
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
     * @param source Source string.
     * @param parseCss Whether to sub-parse into a `SelectorList` node.
     *
     * @returns Raw or SelectorList node for the selector list.
     */
    private static buildSelector(
        cleanedSelector: string,
        bodyStart: number,
        bodyEnd: number,
        isLocIncluded: boolean,
        source: string,
        parseCss: boolean,
    ): SelectorList | Raw {
        if (!parseCss || cleanedSelector.length === 0) {
            const node: Raw = {
                type: NodeType.Raw,
                value: cleanedSelector,
            };
            if (isLocIncluded) {
                node.start = bodyStart;
                node.end = bodyEnd;
            }
            return node;
        }

        // Sub-parse the cleaned selector text via the CSS pipeline.
        // We re-tokenize because the cleaned selector is a synthesized
        // string (modifier ranges have been excised from the original).
        const { tokenizer, ctx } = ensureSubParserContext();
        tokenizer.source = cleanedSelector;
        tokenizer.offset = 0;
        tokenizer.tokenize();
        initParserContext(ctx, cleanedSelector, tokenizer);

        SelectorListParser.parse(ctx, 0, ctx.tokenCount, 0, DEFAULT_MAX_COMPLEX);

        return SelectorListAstBuilder.parse(
            cleanedSelector,
            ctx.data,
            0,
            DEFAULT_MAX_COMPLEX,
            bodyStart,
            bodyEnd,
            { isLocIncluded },
        );
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

        if (!parseCss) {
            const node: Raw = {
                type: NodeType.Raw,
                value: source.slice(valueStart, valueEnd),
            };
            if (isLocIncluded) {
                node.start = valueStart;
                node.end = valueEnd;
            }
            return node;
        }

        // Sub-parse via the CSS pipeline. The declaration text is a
        // contiguous sub-range of the original source, so we re-tokenize
        // a substring to keep the sub-parser stand-alone.
        const declText = source.slice(valueStart, valueEnd);
        const { tokenizer, ctx } = ensureSubParserContext();
        tokenizer.source = declText;
        tokenizer.offset = 0;
        tokenizer.tokenize();
        initParserContext(ctx, declText, tokenizer);

        DeclarationListParser.parse(ctx, 0, ctx.tokenCount, 0, DEFAULT_MAX_DECLARATIONS);
        if (ctx.status === 1) {
            throw new Error('Parser data buffer overflow: declaration list too large for current capacity');
        }

        return DeclarationListAstBuilder.parse(
            declText,
            ctx.data,
            0,
            DEFAULT_MAX_DECLARATIONS,
            valueStart,
            valueEnd,
            { isLocIncluded },
        );
    }
}
