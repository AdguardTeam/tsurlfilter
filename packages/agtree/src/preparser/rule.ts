/**
 * @file Rule preparser — top-level dispatcher.
 *
 * Uses {@link RuleClassifier} to determine the rule kind and delegates to the
 * matching comment, network, or cosmetic preparser.
 */

import { RuleClassifier, RuleKind } from './classifier';
import { CommentClassifier } from './comment/classifier';
import type { PreparserContext } from './context';
import { regionEquals, tokenStart } from './context';
import {
    CR_FLAG_BODY_ADG_SCRIPTLET,
    CR_FLAG_BODY_UBO_SCRIPTLET,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ABP_SNIPPET,
    CR_SEP_KIND_ADG_JS,
    CR_SEP_KIND_SHIFT,
} from './cosmetic/constants';
import { preparseCommonCosmeticHeader } from './cosmetic/cosmetic-common';
import { ElementHidingPreparser } from './cosmetic/element-hiding';
import { ScriptletBodyPreparser } from './cosmetic/scriptlet-body';
import { NetworkRulePreparser } from './network/network-rule';

export { RuleKind } from './classifier';

// Character codes used for separator classification
const CHAR_HASH = 0x23; // #
const CHAR_QUESTION = 0x3F; // ?
const CHAR_AT = 0x40; // @
const CHAR_DOLLAR = 0x24; // $
const CHAR_PERCENT = 0x25; // %

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
 * Checks whether the cosmetic separator starting at `sepStart` in `source`
 * is an element hiding separator (##, #@#, #?#, #@?#).
 *
 * Element hiding separators start with `#` and the character after `#`
 * (or `#@`) is `#` or `?` — never `$` or `%`.
 *
 * @param source Source string.
 * @param sepStart Source index where the separator starts.
 *
 * @returns True if the separator is element-hiding.
 */
function isElementHidingSep(source: string, sepStart: number): boolean {
    if (source.charCodeAt(sepStart) !== CHAR_HASH) {
        return false; // must start with #
    }
    const c1 = source.charCodeAt(sepStart + 1);
    // ## or #?#
    if (c1 === CHAR_HASH || c1 === CHAR_QUESTION) {
        return true;
    }
    // #@# or #@?#
    if (c1 === CHAR_AT) {
        const c2 = source.charCodeAt(sepStart + 2);
        return c2 === CHAR_HASH || c2 === CHAR_QUESTION;
    }
    return false;
}

/**
 * Checks whether the cosmetic separator starting at `sepStart` is
 * an ABP snippet separator (#$# or #@$#).
 *
 * @param source Source string.
 * @param sepStart Source index where the separator starts.
 *
 * @returns True if the separator is ABP snippet.
 */
function isAbpSnippetSep(source: string, sepStart: number): boolean {
    if (source.charCodeAt(sepStart) !== CHAR_HASH) {
        return false;
    }
    const c1 = source.charCodeAt(sepStart + 1);
    // #$#
    if (c1 === CHAR_DOLLAR) {
        return source.charCodeAt(sepStart + 2) === CHAR_HASH;
    }
    // #@$#
    if (c1 === CHAR_AT) {
        return source.charCodeAt(sepStart + 2) === CHAR_DOLLAR
            && source.charCodeAt(sepStart + 3) === CHAR_HASH;
    }
    return false;
}

/**
 * Checks whether the cosmetic separator starting at `sepStart` is
 * an ADG JS injection separator (#%# or #@%#).
 *
 * @param source Source string.
 * @param sepStart Source index where the separator starts.
 *
 * @returns True if the separator is ADG JS injection.
 */
function isAdgJsInjectionSep(source: string, sepStart: number): boolean {
    if (source.charCodeAt(sepStart) !== CHAR_HASH) {
        return false;
    }
    const c1 = source.charCodeAt(sepStart + 1);
    // #%#
    if (c1 === CHAR_PERCENT) {
        return source.charCodeAt(sepStart + 2) === CHAR_HASH;
    }
    // #@%#
    if (c1 === CHAR_AT) {
        return source.charCodeAt(sepStart + 2) === CHAR_PERCENT
            && source.charCodeAt(sepStart + 3) === CHAR_HASH;
    }
    return false;
}

/**
 * Top-level rule preparser.
 *
 * Classifies the rule from the already-tokenized context, then runs the
 * matching preparser so that `ctx.data` is ready for AST construction.
 *
 * @example
 * ```typescript
 * tokenizeLine(source, 0, tokens);
 * initPreparserContext(ctx, source, tokens);
 * const kind = RulePreparser.preparse(ctx);
 * // ctx.data is now populated; use `kind` to pick the correct AST parser.
 * ```
 */
export class RulePreparser {
    /**
     * Classifies the rule and runs the appropriate preparser.
     *
     * @param ctx Preparser context with tokenizer output already loaded.
     * @param parseUboSpecificRules Whether to detect uBO modifiers (default true).
     *
     * @returns The {@link RuleKind} of the rule, so the caller can dispatch
     *   to the correct AST parser.
     *
     * @throws If the rule is a non-element-hiding cosmetic rule (not yet implemented).
     */
    public static preparse(ctx: PreparserContext, parseUboSpecificRules = true): RuleKind {
        const classified = RuleClassifier.classify(ctx);
        const kind = RuleClassifier.ruleKind(classified);

        switch (kind) {
            case RuleKind.Comment:
                CommentClassifier.preparse(ctx);
                return RuleKind.Comment;

            case RuleKind.Network:
                NetworkRulePreparser.preparse(ctx);
                return RuleKind.Network;

            case RuleKind.Cosmetic: {
                const sepTokenIndex = RuleClassifier.cosmeticSepIndex(classified);
                const sepStart = tokenStart(ctx, sepTokenIndex);

                if (isElementHidingSep(ctx.source, sepStart)) {
                    const result = ElementHidingPreparser.preparse(ctx, classified, parseUboSpecificRules);
                    // Sub-kind 0 (element-hiding) is default, no need to OR it.
                    // Detect +js( or script:inject( prefix using charCode comparison
                    if (detectUboScriptletPrefix(ctx.source, result.bodyStart)) {
                        ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_UBO_SCRIPTLET;
                        // Pre-compute UBO scriptlet parameter boundaries
                        const bodyEndTi = ctx.tokenCount;
                        ScriptletBodyPreparser.preparseUbo(
                            ctx,
                            result.bodyStartTi,
                            bodyEndTi,
                            result.bodyStart,
                            result.bodyEnd,
                        );
                    }
                    return RuleKind.Cosmetic;
                }

                if (isAbpSnippetSep(ctx.source, sepStart)) {
                    const result = preparseCommonCosmeticHeader(ctx, classified, 'ABP snippet rule');
                    ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ABP_SNIPPET << CR_SEP_KIND_SHIFT;
                    // Pre-compute ABP snippet parameter boundaries
                    const bodyEndTi = ctx.tokenCount;
                    ScriptletBodyPreparser.preparseAbp(
                        ctx,
                        result.bodyStartTi,
                        bodyEndTi,
                        result.bodyStart,
                        result.bodyEnd,
                    );
                    return RuleKind.Cosmetic;
                }

                if (isAdgJsInjectionSep(ctx.source, sepStart)) {
                    const result = preparseCommonCosmeticHeader(ctx, classified, 'ADG JS injection rule');
                    ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_ADG_JS << CR_SEP_KIND_SHIFT;
                    // Detect //scriptlet prefix using charCode comparison
                    if (detectAdgScriptletPrefix(ctx.source, result.bodyStart)) {
                        ctx.data[CR_FLAGS_OFFSET] |= CR_FLAG_BODY_ADG_SCRIPTLET;
                        // Pre-compute ADG scriptlet parameter boundaries
                        const bodyEndTi = ctx.tokenCount;
                        ScriptletBodyPreparser.preparseAdg(
                            ctx,
                            result.bodyStartTi,
                            bodyEndTi,
                            result.bodyStart,
                            result.bodyEnd,
                        );
                    }
                    return RuleKind.Cosmetic;
                }

                // Other cosmetic types not yet implemented
                const sepTokCount = RuleClassifier.cosmeticSepTokenCount(classified);
                const sepEnd = ctx.ends[sepTokenIndex + sepTokCount - 1];
                const sep = ctx.source.slice(sepStart, sepEnd);
                throw new Error(`Cosmetic separator '${sep}' is not yet implemented in the new pipeline`);
            }

            default:
                throw new Error(`Unknown rule kind: ${kind}`);
        }
    }
}
