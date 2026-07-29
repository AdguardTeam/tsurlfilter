/**
 * @file Rule parser — top-level dispatcher.
 *
 * Uses {@link RuleClassifier} to determine the rule kind and delegates to the
 * matching comment, network, or cosmetic parser.
 */

import { UboPseudoName } from '../common/ubo-selector-common';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { TokenType } from '../tokenizer/token-types';

import { RuleClassifier, RuleKind } from './classifier';
import { CommentParser } from './comment/classifier';
import type { ParserContext } from './context';
import {
    regionEquals,
    scriptletBodyDataOffset,
    skipWs,
    tokenStart,
} from './context';
import {
    CR_BODY_END,
    CR_BODY_START,
    CR_BODY_START_TI,
    CR_FLAG_BODY_ABP_CSS_INJECTION,
    CR_FLAG_BODY_ADG_SCRIPTLET,
    CR_FLAG_BODY_UBO_CSS_INJECTION,
    CR_FLAG_BODY_UBO_SCRIPTLET,
    CR_FLAG_HAS_UBO_MODS,
    CR_FLAGS_OFFSET,
    CR_MODIFIER_COUNT_OFFSET,
    CR_SEP_KIND_ABP_SNIPPET,
    CR_SEP_KIND_ADG_CSS_INJECTION,
    CR_SEP_KIND_ADG_HTML_FILTERING,
    CR_SEP_KIND_ADG_JS,
    CR_SEP_KIND_ELEMENT_HIDING,
    CR_SEP_KIND_SHIFT,
    CR_UBO_MODS_OFFSET,
    UBO_MOD_FIELD_NAME_END,
    UBO_MOD_FIELD_NAME_START,
    UBO_MODIFIER_RECORD_STRIDE,
} from './cosmetic/constants';
import { parseCommonCosmeticHeader } from './cosmetic/cosmetic-common';
import { AdgCssInjectionParser } from './cosmetic/css-injection';
import { ElementHidingParser } from './cosmetic/element-hiding';
import { AdgHtmlFilteringParser, UboHtmlFilteringParser } from './cosmetic/html-filtering';
import { ScriptletBodyParser } from './cosmetic/scriptlet-body';
import { NetworkRuleParser } from './network/network-rule';
import { resolveRuleParserOptions, type RuleParserOptions } from './options';
import type { RootParser } from './types';

export { RuleKind } from './classifier';

// Body prefix strings for zero-allocation charCode comparison via regionEquals
const ADG_SCRIPTLET_PREFIX = '//scriptlet';
const UBO_SCRIPTLET_PREFIX = '+js(';
const UBO_SCRIPTLET_LEGACY_PREFIX = 'script:inject(';

/**
 * Detect whether the body starting at `bodyStart` has the ADG scriptlet
 * prefix `//scriptlet` using charCode comparison (no string allocation).
 *
 * @param source Source string.
 * @param bodyStart Source index where body starts.
 *
 * @returns True if body starts with `//scriptlet`.
 */
function detectAdgScriptletPrefix(source: string, bodyStart: number): boolean {
    return regionEquals(
        source,
        bodyStart,
        bodyStart + ADG_SCRIPTLET_PREFIX.length,
        ADG_SCRIPTLET_PREFIX,
    );
}

/**
 * Detect whether the body starting at `bodyStart` has a uBO scriptlet
 * prefix (`+js(` or `script:inject(`) using charCode comparison (no
 * string allocation).
 *
 * @param source Source string.
 * @param bodyStart Source index where body starts.
 *
 * @returns True if body starts with `+js(` or `script:inject(`.
 */
function detectUboScriptletPrefix(source: string, bodyStart: number): boolean {
    return regionEquals(
        source,
        bodyStart,
        bodyStart + UBO_SCRIPTLET_PREFIX.length,
        UBO_SCRIPTLET_PREFIX,
    ) || regionEquals(
        source,
        bodyStart,
        bodyStart + UBO_SCRIPTLET_LEGACY_PREFIX.length,
        UBO_SCRIPTLET_LEGACY_PREFIX,
    );
}

/**
 * Classify a cosmetic separator into a `CR_SEP_KIND_*` constant using
 * token types from the adblock tokenizer.
 *
 * Token patterns: `##`/`#@#`/`#?#`/`#@?#` → EH(0); `#$#`/`#@$#` → ABP(1) (ambiguous);
 * `#$?#`/`#@$?#` → ADG-CSS(5); `#%#`/`#@%#` → ADG-JS(2); `$$`/`$@$` → ADG-HTML(3).
 *
 * For `#$#` and `#@$#`, returns `CR_SEP_KIND_ABP_SNIPPET` as the initial
 * classification; the body parser then promotes to `CR_SEP_KIND_ADG_CSS_INJECTION`
 * if a top-level brace is found.
 *
 * @param types Token types buffer.
 * @param sepTi Token index where the separator starts.
 *
 * @returns A `CR_SEP_KIND_*` constant, or -1 if unrecognised.
 */
function classifyCosmeticSepKind(types: Uint8Array, sepTi: number): number {
    const t0 = types[sepTi];

    // $$ or $@$
    if (t0 === TokenType.DollarSign) {
        return CR_SEP_KIND_ADG_HTML_FILTERING;
    }

    // All #-based separators: t0 must be HashMark
    const t1 = types[sepTi + 1];

    // ## or #?# → element hiding
    if (t1 === TokenType.HashMark || t1 === TokenType.QuestionMark) {
        return CR_SEP_KIND_ELEMENT_HIDING;
    }

    // #$?# → always CSS injection (extended CSS); #$# → ambiguous (ABP or CSS injection)
    if (t1 === TokenType.DollarSign) {
        if (types[sepTi + 2] === TokenType.QuestionMark) {
            return CR_SEP_KIND_ADG_CSS_INJECTION; // #$?#
        }
        return CR_SEP_KIND_ABP_SNIPPET; // #$# (resolved by body parser)
    }
    if (t1 === TokenType.Percent) {
        return CR_SEP_KIND_ADG_JS;
    }

    // #@... variants: look at t2
    if (t1 === TokenType.AtSign) {
        const t2 = types[sepTi + 2];
        if (t2 === TokenType.HashMark || t2 === TokenType.QuestionMark) {
            return CR_SEP_KIND_ELEMENT_HIDING;
        }
        if (t2 === TokenType.DollarSign) {
            const t3 = types[sepTi + 3];
            if (t3 === TokenType.HashMark) {
                return CR_SEP_KIND_ABP_SNIPPET; // #@$# (resolved by body parser)
            }
            if (t3 === TokenType.QuestionMark) {
                return CR_SEP_KIND_ADG_CSS_INJECTION; // #@$?#
            }
        }
        if (t2 === TokenType.Percent) {
            return CR_SEP_KIND_ADG_JS;
        }
    }

    return -1;
}

// Re-export for backward compatibility; canonical home is `./options`.
export { type RuleParserOptions } from './options';

/**
 * Top-level rule parser.
 *
 * Classifies the rule from the already-tokenized context, then runs the
 * matching parser so that `ctx.data` is ready for AST construction.
 *
 * @example
 * ```typescript
 * tokenizeLine(source, 0, tokens);
 * initParserContext(ctx, source, tokens);
 * const kind = RuleParser.parse(ctx);
 * // ctx.data is now populated; use `kind` to pick the correct AST parser.
 * ```
 */
export class RuleParser implements RootParser<RuleParserOptions> {
    /**
     * Minimum `ctx.data` slots required by this parser with the default
     * capacity.  Equals the largest of all sub-parsers:
     *   - {@link NetworkRuleParser.MIN_DATA_SLOTS} = 325
     *   - {@link CommentParser.MIN_DATA_SLOTS}    = 167
     *   - {@link ElementHidingParser.MIN_DATA_SLOTS} = 35
     *   - {@link AdgHtmlFilteringParser.MIN_DATA_SLOTS} = 737.
     */
    public static readonly MIN_DATA_SLOTS = Math.max(
        NetworkRuleParser.MIN_DATA_SLOTS,
        CommentParser.MIN_DATA_SLOTS,
        ElementHidingParser.MIN_DATA_SLOTS,
        AdgHtmlFilteringParser.MIN_DATA_SLOTS,
    ) as number;

    /**
     * Classifies the rule and runs the appropriate parser.
     *
     * @param ctx Parser context with tokenizer output already loaded.
     * @param startTi Inclusive start token index. Defaults to 0.
     * @param endTi Exclusive end token index. Defaults to ctx.tokenCount.
     * @param dataOffset Offset within ctx.data to write output. Defaults to 0.
     * @param options Parsing options object. See {@link RuleParserOptions}.
     *
     * @returns The {@link RuleKind} of the rule, so the caller can dispatch
     *   to the correct AST parser.
     *
     * @throws If the rule is a non-supported cosmetic rule type.
     */
    public static parse(
        ctx: ParserContext,
        startTi = 0,
        endTi = ctx.tokenCount,
        dataOffset = 0,
        options?: RuleParserOptions,
    ): RuleKind {
        const {
            parseUboSpecificRules,
            parseAbpSpecificRules,
            parseHtmlFilteringRuleBodies,
            ignoreCosmetic,
            ignoreNetwork,
        } = resolveRuleParserOptions(options);

        const classified = RuleClassifier.classify(ctx, startTi, endTi);
        const kind = RuleClassifier.ruleKind(classified);

        switch (kind) {
            case RuleKind.Comment:
                CommentParser.parse(ctx, startTi, endTi, dataOffset);
                return RuleKind.Comment;

            case RuleKind.Network:
                if (ignoreNetwork) {
                    ctx.data[dataOffset] = 0;
                    return RuleKind.Network;
                }
                NetworkRuleParser.parse(ctx, startTi, endTi, dataOffset);
                return RuleKind.Network;

            case RuleKind.Cosmetic: {
                if (ignoreCosmetic) {
                    ctx.data[dataOffset] = 0;
                    return RuleKind.Cosmetic;
                }
                const sepTokenIndex = RuleClassifier.cosmeticSepIndex(classified);
                const sepKind = classifyCosmeticSepKind(ctx.types, sepTokenIndex);

                switch (sepKind) {
                    case CR_SEP_KIND_ELEMENT_HIDING: {
                        // Peek at first body token BEFORE invoking ElementHidingParser.
                        // If it is ^ this is a uBO HTML filtering rule — ElementHidingParser
                        // must NOT be called because it would attempt to CSS-parse "^…".
                        // skipWs advances past the single optional whitespace token that
                        // follows the separator (same logic as parseCommonCosmeticHeader).
                        const sepTokCount = RuleClassifier.cosmeticSepTokenCount(classified);
                        const peekTi = skipWs(ctx, sepTokenIndex + sepTokCount);

                        if (peekTi < ctx.tokenCount
                            && ctx.types[peekTi] === TokenType.Caret) {
                            // uBO HTML filtering rule. The dedicated parser
                            // handles header writing, the `^` skip, the
                            // `responseheader(...)` detection, and the
                            // disabled-uBO error symmetrically. When
                            // `parseHtmlFilteringRuleBodies` is false we
                            // pass `onlyHeader: true` so the body's CSS
                            // selector list is left unparsed.
                            UboHtmlFilteringParser.parse(ctx, classified, {
                                parseUboSpecificRules,
                                onlyHeader: !parseHtmlFilteringRuleBodies,
                            }, startTi, endTi);
                            return RuleKind.Cosmetic;
                        }

                        // No ^: normal element hiding / scriptlet flow
                        // Always run modifier detection so we can throw
                        // symmetrically when parseUboSpecificRules is disabled.
                        ElementHidingParser.parse(ctx, classified, { parseUboSpecificRules: true }, startTi, endTi);

                        // After ElementHidingParser.parse() the uBO modifier records
                        // (if any) live at CR_UBO_MODS_OFFSET with stride
                        // UBO_MODIFIER_RECORD_STRIDE. If any record is :style or
                        // :remove, mark this rule as uBO CSS injection so the AST
                        // builder dispatcher routes to UboCssInjectionAstBuilder.
                        // eslint-disable-next-line no-bitwise
                        const hasUboMods = (ctx.data[CR_FLAGS_OFFSET] & CR_FLAG_HAS_UBO_MODS) !== 0;
                        if (hasUboMods && !parseUboSpecificRules) {
                            throw new AdblockSyntaxError(
                                'Parsing uBO-specific rules is disabled, but the rule uses uBO modifier syntax',
                                ctx.data[CR_BODY_START],
                                ctx.data[CR_BODY_END],
                            );
                        }
                        if (hasUboMods) {
                            const uboModCount = ctx.data[CR_MODIFIER_COUNT_OFFSET];
                            for (let i = 0; i < uboModCount; i += 1) {
                                const base = CR_UBO_MODS_OFFSET + i * UBO_MODIFIER_RECORD_STRIDE;
                                const nameStart = ctx.data[base + UBO_MOD_FIELD_NAME_START];
                                const nameEnd = ctx.data[base + UBO_MOD_FIELD_NAME_END];
                                if (
                                    regionEquals(ctx.source, nameStart, nameEnd, UboPseudoName.Style)
                                    || regionEquals(ctx.source, nameStart, nameEnd, UboPseudoName.Remove)
                                ) {
                                    // eslint-disable-next-line no-bitwise
                                    ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_UBO_CSS_INJECTION;
                                    return RuleKind.Cosmetic;
                                }
                            }
                        }

                        // Legacy ADG/ABP CSS injection: `##selector { declarations }`.
                        // ElementHidingParser sets CR_FLAG_BODY_ABP_CSS_INJECTION when the
                        // body contains a top-level declaration block (e.g.
                        // `##.banner { display: none; }`). This is ABP-specific syntax
                        // (SYNTAX_ABP), so it is only promoted to a CssInjectionRule when
                        // `parseAbpSpecificRules` is enabled; otherwise the rule is left as
                        // an element-hiding rule (its raw body keeps the braces so consumers
                        // can reject it).
                        // eslint-disable-next-line no-bitwise
                        const hasAbpCssInjection = (ctx.data[CR_FLAGS_OFFSET] & CR_FLAG_BODY_ABP_CSS_INJECTION) !== 0;
                        if (parseAbpSpecificRules && hasAbpCssInjection) {
                            const cssParsed = AdgCssInjectionParser.parse(
                                ctx,
                                ctx.data[CR_BODY_START_TI],
                                endTi,
                                scriptletBodyDataOffset(ctx),
                                false, // not required — fall back to element hiding if no brace
                            );

                            if (cssParsed) {
                                // eslint-disable-next-line no-bitwise
                                ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_CSS_INJECTION << CR_SEP_KIND_SHIFT;
                                return RuleKind.Cosmetic;
                            }
                        }

                        // Detect +js( or script:inject( prefix
                        if (detectUboScriptletPrefix(ctx.source, ctx.data[CR_BODY_START])) {
                            // eslint-disable-next-line no-bitwise
                            ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_UBO_SCRIPTLET;
                            ScriptletBodyParser.parse(ctx, classified, endTi);
                        }
                        return RuleKind.Cosmetic;
                    }

                    case CR_SEP_KIND_ABP_SNIPPET: {
                        // #$# / #@$# — ambiguous: CSS injection if body has braces, else ABP snippet.
                        parseCommonCosmeticHeader(ctx, classified, 'CSS injection rule', startTi, endTi);

                        const bodyStartTi = ctx.data[CR_BODY_START_TI];

                        const parsed = AdgCssInjectionParser.parse(
                            ctx,
                            bodyStartTi,
                            endTi,
                            scriptletBodyDataOffset(ctx),
                            false, // not required — fall back to ABP if no brace found
                        );

                        if (parsed) {
                            // CSS injection block found
                            // eslint-disable-next-line no-bitwise
                            ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_CSS_INJECTION << CR_SEP_KIND_SHIFT;
                            return RuleKind.Cosmetic;
                        }

                        // No brace found: treat as ABP snippet.
                        // Throw an ABP-specific disablement error rather than a CSS-injection
                        // syntax error — the rule is a genuine ABP snippet, not malformed CSS.
                        if (!parseAbpSpecificRules) {
                            throw new AdblockSyntaxError(
                                'ABP-specific rules are disabled by the parseAbpSpecificRules option',
                                ctx.data[CR_BODY_START],
                                ctx.data[CR_BODY_END],
                            );
                        }
                        // eslint-disable-next-line no-bitwise
                        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ABP_SNIPPET << CR_SEP_KIND_SHIFT;
                        ScriptletBodyParser.parse(ctx, classified, endTi);
                        return RuleKind.Cosmetic;
                    }

                    case CR_SEP_KIND_ADG_CSS_INJECTION: {
                        // #$?# / #@$?# — always CSS injection (extended CSS, required braces).
                        parseCommonCosmeticHeader(ctx, classified, 'CSS injection rule', startTi, endTi);
                        AdgCssInjectionParser.parse(
                            ctx,
                            ctx.data[CR_BODY_START_TI],
                            endTi,
                            scriptletBodyDataOffset(ctx),
                            true, // required — must have braces
                        );
                        // eslint-disable-next-line no-bitwise
                        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_CSS_INJECTION << CR_SEP_KIND_SHIFT;
                        return RuleKind.Cosmetic;
                    }

                    case CR_SEP_KIND_ADG_JS: {
                        parseCommonCosmeticHeader(ctx, classified, 'ADG JS injection rule', startTi, endTi);
                        // eslint-disable-next-line no-bitwise
                        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_JS << CR_SEP_KIND_SHIFT;
                        if (detectAdgScriptletPrefix(ctx.source, ctx.data[CR_BODY_START])) {
                            // eslint-disable-next-line no-bitwise
                            ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_ADG_SCRIPTLET;
                            ScriptletBodyParser.parse(ctx, classified, endTi);
                        }
                        return RuleKind.Cosmetic;
                    }

                    case CR_SEP_KIND_ADG_HTML_FILTERING: {
                        if (parseHtmlFilteringRuleBodies) {
                            AdgHtmlFilteringParser.parse(ctx, classified, startTi, endTi);
                        } else {
                            parseCommonCosmeticHeader(ctx, classified, 'ADG HTML filtering rule', startTi, endTi);
                            // eslint-disable-next-line no-bitwise
                            ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_HTML_FILTERING << CR_SEP_KIND_SHIFT;
                        }
                        return RuleKind.Cosmetic;
                    }

                    default: {
                        const sepTokCount = RuleClassifier.cosmeticSepTokenCount(classified);
                        const sepStart = tokenStart(ctx, sepTokenIndex);
                        const sepEnd = ctx.ends[sepTokenIndex + sepTokCount - 1];
                        const sep = ctx.source.slice(sepStart, sepEnd);
                        throw new Error(`Cosmetic separator '${sep}' is not yet implemented in the new pipeline`);
                    }
                }
            }

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }
}
