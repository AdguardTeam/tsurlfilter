/**
 * @file Rule parser — top-level dispatcher.
 *
 * Uses {@link RuleClassifier} to determine the rule kind and delegates to the
 * matching comment, network, or cosmetic parser.
 */

import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { TokenType } from '../tokenizer/token-types';

import { RuleClassifier, RuleKind } from './classifier';
import { CommentParser } from './comment/classifier';
import type { ParserContext } from './context';
import { regionEquals, skipWs, tokenStart } from './context';
import {
    CR_BODY_END,
    CR_BODY_START,
    CR_BODY_START_TI,
    CR_FLAG_BODY_ADG_SCRIPTLET,
    CR_FLAG_BODY_UBO_SCRIPTLET,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ABP_SNIPPET,
    CR_SEP_KIND_ADG_HTML_FILTERING,
    CR_SEP_KIND_ADG_JS,
    CR_SEP_KIND_ELEMENT_HIDING,
    CR_SEP_KIND_SHIFT,
    CR_SEP_KIND_UBO_HTML_FILTERING,
} from './cosmetic/constants';
import { parseCommonCosmeticHeader } from './cosmetic/cosmetic-common';
import { ElementHidingParser } from './cosmetic/element-hiding';
import { AdgHtmlFilteringParser, UboHtmlFilteringParser } from './cosmetic/html-filtering';
import { ScriptletBodyParser } from './cosmetic/scriptlet-body';
import { NetworkRuleParser } from './network/network-rule';

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
 * Token patterns: `##`/`#@#`/`#?#`/`#@?#` → EH(0); `#$#`/`#@$#` → ABP(1);
 * `#%#`/`#@%#` → ADG-JS(2); `$$`/`$@$` → ADG-HTML(3).
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

    // #$# → ABP snippet, #%# → ADG JS
    if (t1 === TokenType.DollarSign) {
        return CR_SEP_KIND_ABP_SNIPPET;
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
            // #@$# → ABP snippet, #@$?# → element hiding (extended CSS)
            const t3 = types[sepTi + 3];
            if (t3 === TokenType.HashMark) {
                return CR_SEP_KIND_ABP_SNIPPET;
            }
            if (t3 === TokenType.QuestionMark) {
                return CR_SEP_KIND_ELEMENT_HIDING;
            }
        }
        if (t2 === TokenType.Percent) {
            return CR_SEP_KIND_ADG_JS;
        }
    }

    return -1;
}

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
export class RuleParser {
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
     * @param parseUboSpecificRules Whether to detect uBO modifiers (default true).
     * @param parseHtmlFilteringRuleBodies Whether to parse HTML filtering bodies (default false).
     *
     * @returns The {@link RuleKind} of the rule, so the caller can dispatch
     *   to the correct AST parser.
     */
    public static parse(
        ctx: ParserContext,
        startTi = 0,
        endTi = ctx.tokenCount,
        dataOffset = 0,
        parseUboSpecificRules = true,
        parseHtmlFilteringRuleBodies = false,
    ): RuleKind {
        const classified = RuleClassifier.classify(ctx, startTi, endTi);
        const kind = RuleClassifier.ruleKind(classified);

        switch (kind) {
            case RuleKind.Comment:
                CommentParser.parse(ctx, startTi, endTi, dataOffset);
                return RuleKind.Comment;

            case RuleKind.Network:
                NetworkRuleParser.parse(ctx, startTi, endTi, dataOffset);
                return RuleKind.Network;

            case RuleKind.Cosmetic: {
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
                            // uBO HTML filtering rule
                            if (parseHtmlFilteringRuleBodies) {
                                // Dedicated parser handles header + ^ skip + responseheader detection
                                UboHtmlFilteringParser.parse(ctx, classified, parseUboSpecificRules);
                            } else {
                                // Raw mode: populate header and adjust body start past ^
                                if (!parseUboSpecificRules) {
                                    parseCommonCosmeticHeader(ctx, classified, 'uBO HTML filtering rule');
                                    const msg = 'Parsing uBO-specific rules is disabled,'
                                        + " but the rule uses uBO HTML filtering syntax ('^')";
                                    throw new AdblockSyntaxError(
                                        msg,
                                        tokenStart(ctx, peekTi),
                                        ctx.ends[peekTi],
                                    );
                                }
                                parseCommonCosmeticHeader(ctx, classified, 'uBO HTML filtering rule');
                                // eslint-disable-next-line no-bitwise
                                ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_UBO_HTML_FILTERING << CR_SEP_KIND_SHIFT;
                                const newBodyTi = skipWs(ctx, peekTi + 1); // skip ^ then optional ws
                                if (newBodyTi >= ctx.tokenCount) {
                                    throw new AdblockSyntaxError(
                                        'Empty uBO HTML filtering rule body after ^',
                                        ctx.data[CR_BODY_START],
                                        ctx.data[CR_BODY_END],
                                    );
                                }
                                ctx.data[CR_BODY_START] = tokenStart(ctx, newBodyTi);
                                ctx.data[CR_BODY_START_TI] = newBodyTi;
                            }
                            return RuleKind.Cosmetic;
                        }

                        // No ^: normal element hiding / scriptlet flow
                        ElementHidingParser.parse(ctx, classified, parseUboSpecificRules);
                        // Detect +js( or script:inject( prefix
                        if (detectUboScriptletPrefix(ctx.source, ctx.data[CR_BODY_START])) {
                            // eslint-disable-next-line no-bitwise
                            ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_UBO_SCRIPTLET;
                            ScriptletBodyParser.parseUbo(
                                ctx,
                                ctx.data[CR_BODY_START_TI],
                                ctx.tokenCount,
                                ctx.data[CR_BODY_START],
                                ctx.data[CR_BODY_END],
                            );
                        }
                        return RuleKind.Cosmetic;
                    }

                    case CR_SEP_KIND_ABP_SNIPPET: {
                        parseCommonCosmeticHeader(ctx, classified, 'ABP snippet rule');
                        // eslint-disable-next-line no-bitwise
                        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ABP_SNIPPET << CR_SEP_KIND_SHIFT;
                        ScriptletBodyParser.parseAbp(
                            ctx,
                            ctx.data[CR_BODY_START_TI],
                            ctx.tokenCount,
                            ctx.data[CR_BODY_START],
                            ctx.data[CR_BODY_END],
                        );
                        return RuleKind.Cosmetic;
                    }

                    case CR_SEP_KIND_ADG_JS: {
                        parseCommonCosmeticHeader(ctx, classified, 'ADG JS injection rule');
                        // eslint-disable-next-line no-bitwise
                        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_JS << CR_SEP_KIND_SHIFT;
                        if (detectAdgScriptletPrefix(ctx.source, ctx.data[CR_BODY_START])) {
                            // eslint-disable-next-line no-bitwise
                            ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_ADG_SCRIPTLET;
                            ScriptletBodyParser.parseAdg(
                                ctx,
                                ctx.data[CR_BODY_START_TI],
                                ctx.tokenCount,
                                ctx.data[CR_BODY_START],
                                ctx.data[CR_BODY_END],
                            );
                        }
                        return RuleKind.Cosmetic;
                    }

                    case CR_SEP_KIND_ADG_HTML_FILTERING: {
                        if (parseHtmlFilteringRuleBodies) {
                            AdgHtmlFilteringParser.parse(ctx, classified);
                        } else {
                            parseCommonCosmeticHeader(ctx, classified, 'ADG HTML filtering rule');
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
