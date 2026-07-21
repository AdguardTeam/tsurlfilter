import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { SelectorListOrRawGenerator } from '../../generator-new/cosmetic/selector/selector-list-or-raw-generator';
import { NodeType, type Raw, type SelectorList } from '../../nodes-new';
import { QuoteUtils } from '../../utils';
import {
    CLOSE_PARENTHESIS,
    COLON,
    COMMA,
    EMPTY,
    EQUALS,
    OPEN_PARENTHESIS,
} from '../../utils/constants';
import { QuoteType } from '../../utils/quotes';
import { BaseConverter } from '../base-interfaces/base-converter';
import { type ConversionResult, createConversionResult } from '../base-interfaces/conversion-result';
import { ABP_EXT_CSS_PREFIX, EXT_CSS_PSEUDO_CLASSES_STRICT, LEGACY_EXT_CSS_ATTRIBUTE_PREFIX } from '../data/css';

import { CssCursor } from './css-cursor';
import { CssTokenKind } from './css-token-kind';

/**
 * Character codes used in convertToUbo source scanning.
 */
const CHAR_COLON = 0x3A;
const CHAR_OPEN_PAREN = 0x28;
const CHAR_CLOSE_PAREN = 0x29;
const CHAR_SINGLE_QUOTE = 0x27;
const CHAR_DOUBLE_QUOTE = 0x22;
const CHAR_BACKSLASH = 0x5C;
const CHAR_OPEN_SQUARE = 0x5B;
const CHAR_CLOSE_SQUARE = 0x5D;

/**
 * Finds the index of the matching closing quote for a string that opens at
 * `start`. Respects backslash escapes. Returns -1 if the quote is unmatched.
 *
 * @param s Source string.
 * @param start Index of the opening quote character.
 *
 * @returns Index of the closing quote, or -1 if not found.
 */
function findClosingQuote(s: string, start: number): number {
    const quote = s.charCodeAt(start);
    let j = start + 1;
    while (j < s.length) {
        const c = s.charCodeAt(j);
        if (c === CHAR_BACKSLASH) {
            j += 2;
            continue;
        }
        if (c === quote) {
            return j;
        }
        j += 1;
    }
    return -1;
}

export const PseudoClasses = {
    AbpContains: '-abp-contains',
    AbpHas: '-abp-has',
    Contains: 'contains',
    Has: 'has',
    HasText: 'has-text',
    MatchesCss: 'matches-css',
    MatchesCssAfter: 'matches-css-after',
    MatchesCssBefore: 'matches-css-before',
    Not: 'not',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type PseudoClasses = typeof PseudoClasses[keyof typeof PseudoClasses];

export const PseudoElements = {
    After: 'after',
    Before: 'before',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type PseudoElements = typeof PseudoElements[keyof typeof PseudoElements];

const PSEUDO_ELEMENT_NAMES = new Set<string>([
    PseudoElements.After,
    PseudoElements.Before,
]);

/**
 * Result of `convertToAdg` including Extended CSS detection.
 */
export interface AdgConversionResult extends ConversionResult<string> {
    /**
     * Whether the selector contains **strict** Extended CSS pseudo-classes
     * (those not natively supported by browsers, as defined by
     * {@link EXT_CSS_PSEUDO_CLASSES_STRICT}).
     *
     * Note: natively-supported pseudo-classes like `:has()`, `:is()`, `:not()`
     * are intentionally excluded — they do not require the Extended CSS engine.
     * This matches the previous behavior of
     * `CssTokenStream.hasAnySelectorExtendedCssNodeStrict()`.
     */
    hasExtendedCss: boolean;
}

/**
 * CSS selector converter.
 *
 * @todo Implement `convertToAbp`.
 */
export class CssSelectorConverter extends BaseConverter {
    /**
     * Extracts the raw CSS selector string from an AST node.
     *
     * If the node is a {@link Raw} value, returns its `.value` directly.
     * If it is already a parsed {@link SelectorList}, serializes it back to a
     * string using {@link SelectorListGenerator.generate}.
     *
     * @param node CSS selector list AST node.
     *
     * @returns The raw CSS selector text.
     */
    private static selectorListNodeToString(node: SelectorList | Raw): string {
        return SelectorListOrRawGenerator.generate(node);
    }

    /**
     * Converts Extended CSS elements to AdGuard-compatible ones.
     *
     * @param node CSS selector list AST node (parsed or raw) to convert.
     *
     * @returns An object which follows the {@link AdgConversionResult} interface. Its `result` property contains
     * the converted selector, `isConverted` indicates whether the original was modified, and `hasExtendedCss`
     * indicates whether strict Extended CSS pseudo-classes were found.
     *
     * @throws If the rule is invalid or incompatible.
     */
    public static convertToAdg(node: SelectorList | Raw): AdgConversionResult {
        const selectorList = CssSelectorConverter.selectorListNodeToString(node);
        const cursor = new CssCursor();
        cursor.reset(selectorList);

        const converted: string[] = [];
        let hasExtCss = false;

        const convertAndPushPseudo = (pseudo: string): void => {
            switch (pseudo) {
                case PseudoClasses.AbpContains:
                case PseudoClasses.HasText:
                    converted.push(PseudoClasses.Contains);
                    converted.push(OPEN_PARENTHESIS);
                    break;

                case PseudoClasses.AbpHas:
                    converted.push(PseudoClasses.Has);
                    converted.push(OPEN_PARENTHESIS);
                    break;

                // a bit special case:
                // - `:matches-css-before(...)` → `:matches-css(before, ...)`
                // - `:matches-css-after(...)`  → `:matches-css(after, ...)`
                case PseudoClasses.MatchesCssBefore:
                case PseudoClasses.MatchesCssAfter:
                    converted.push(PseudoClasses.MatchesCss);
                    converted.push(OPEN_PARENTHESIS);
                    converted.push(pseudo.substring(PseudoClasses.MatchesCss.length + 1));
                    converted.push(COMMA);
                    break;

                default:
                    converted.push(pseudo);
                    converted.push(OPEN_PARENTHESIS);
                    break;
            }
        };

        while (!cursor.isEof()) {
            if (cursor.kind === CssTokenKind.Colon) {
                converted.push(COLON);
                cursor.advance();

                if (cursor.isEof()) {
                    break;
                }

                // Double colon — pseudo-element
                if (cursor.kind === CssTokenKind.Colon) {
                    converted.push(COLON);
                    cursor.advance();
                    continue;
                }

                if (cursor.kind === CssTokenKind.Ident) {
                    const name = cursor.value;

                    if (PSEUDO_ELEMENT_NAMES.has(name)) {
                        // Add an extra colon to the name
                        converted.push(COLON);
                        converted.push(name);
                    } else {
                        // Add the name as is
                        converted.push(name);
                    }

                    cursor.advance();
                } else if (cursor.kind === CssTokenKind.Function) {
                    // Function value includes trailing '(' — strip it for name comparison
                    const name = cursor.source.slice(cursor.start, cursor.end - 1);

                    // Track Extended CSS
                    if (EXT_CSS_PSEUDO_CLASSES_STRICT.has(name)) {
                        hasExtCss = true;
                    }

                    convertAndPushPseudo(name);
                    cursor.advance();
                }
            } else if (cursor.kind === CssTokenKind.OpenSquareBracket) {
                const bracketStart = cursor.start;
                cursor.advance();
                cursor.skipWhitespace();

                if (cursor.isEof() || (cursor.kind as CssTokenKind) !== CssTokenKind.Ident) {
                    // Not a valid extended attr selector; emit what we have
                    converted.push(selectorList.slice(bracketStart, cursor.isEof() ? selectorList.length : cursor.end));
                    if (!cursor.isEof()) {
                        cursor.advance();
                    }
                    continue;
                }

                let attr = cursor.value;

                // Skip if the attribute name is not a legacy Extended CSS one
                if (!(attr.startsWith(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX) || attr.startsWith(ABP_EXT_CSS_PREFIX))) {
                    // Not a legacy Extended CSS attr — emit bracket + attr as-is
                    converted.push(selectorList.slice(bracketStart, cursor.end));
                    cursor.advance();
                    continue;
                }

                // Extended CSS attribute: [-ext-has=...] or [-abp-has=...]
                hasExtCss = true;

                if (attr.startsWith(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX)) {
                    attr = attr.slice(LEGACY_EXT_CSS_ATTRIBUTE_PREFIX.length);
                }

                cursor.advance();
                cursor.skipWhitespace();

                // Next token should be an equality operator (=)
                if (cursor.isEof() || (cursor.kind as CssTokenKind) !== CssTokenKind.Delim || cursor.value !== EQUALS) {
                    throw new AdblockSyntaxError(
                        'Expected "=" in extended CSS attribute selector',
                        cursor.start,
                        cursor.end,
                    );
                }
                cursor.advance();
                cursor.skipWhitespace();

                // Parse attribute value — should be ident or string
                const attrKind = cursor.kind as CssTokenKind;
                if (cursor.isEof() || (attrKind !== CssTokenKind.Ident && attrKind !== CssTokenKind.String)) {
                    throw new AdblockSyntaxError(
                        'Expected ident or string as attribute value',
                        cursor.start,
                        cursor.end,
                    );
                }

                const { value } = cursor;
                cursor.advance();
                cursor.skipWhitespace();

                // Next character should be a closing square bracket
                if (cursor.isEof() || (cursor.kind as CssTokenKind) !== CssTokenKind.CloseSquareBracket) {
                    throw new AdblockSyntaxError(
                        'Expected "]" to close attribute selector',
                        cursor.start,
                        cursor.end,
                    );
                }
                cursor.advance();

                converted.push(COLON);
                convertAndPushPseudo(attr);
                let processedValue = QuoteUtils.removeQuotes(value);

                if (attr === PseudoClasses.Has) {
                    processedValue = CssSelectorConverter.convertToAdg({
                        type: NodeType.Raw,
                        value: processedValue,
                    }).result;
                }

                converted.push(processedValue);
                converted.push(CLOSE_PARENTHESIS);
            } else {
                // Emit token as-is
                converted.push(cursor.value);
                cursor.advance();
            }
        }

        const convertedSelectorList = converted.join(EMPTY);
        return {
            result: convertedSelectorList,
            isConverted: selectorList !== convertedSelectorList,
            hasExtendedCss: hasExtCss,
        };
    }

    /**
     * Converts Extended CSS elements to uBlock Origin-compatible ones.
     *
     * Specifically, this renames `:contains()` to `:has-text()` and wraps the
     * argument in single quotes, escaping any inner single quotes. This is
     * necessary because uBO uses CSSTree which follows the CSS spec and rejects
     * unpaired quotes inside pseudo-class arguments.
     *
     * @param node CSS selector list AST node (parsed or raw) to convert.
     *
     * @returns An object which follows the {@link ConversionResult} interface.
     */
    public static convertToUbo(node: SelectorList | Raw): ConversionResult<string> {
        const selectorList = CssSelectorConverter.selectorListNodeToString(node);

        // Use a simple source-offset approach: scan for :contains( or :-abp-contains(
        // and replace with :has-text('...') using raw paren-balanced argument extraction.
        // This mirrors how the old tokenizeExtended callback worked.
        //
        // While scanning we track quote, escape, and bracket state so that text
        // inside quoted strings or attribute selectors (e.g.
        // `div[data-note=":contains(foo)"]`) is never mistaken for a real
        // pseudo-class and rewritten, which would change selector semantics.
        const parts: string[] = [];
        let isConverted = false;
        let i = 0;
        // Index up to which the untouched source has been flushed to `parts`.
        let flushed = 0;
        // Attribute-selector (`[...]`) nesting depth.
        let bracketDepth = 0;

        const containsPrefix = `:${PseudoClasses.Contains}(`;
        const abpContainsPrefix = `:${PseudoClasses.AbpContains}(`;

        while (i < selectorList.length) {
            const ch = selectorList.charCodeAt(i);

            // Skip escaped characters entirely.
            if (ch === CHAR_BACKSLASH) {
                i += 2;
                continue;
            }

            // Skip over quoted strings so their contents are never treated as
            // pseudo-classes. Unmatched quotes are treated as literal chars.
            if (ch === CHAR_SINGLE_QUOTE || ch === CHAR_DOUBLE_QUOTE) {
                const closeIdx = findClosingQuote(selectorList, i);
                i = closeIdx !== -1 ? closeIdx + 1 : i + 1;
                continue;
            }

            // Track attribute-selector nesting.
            if (ch === CHAR_OPEN_SQUARE) {
                bracketDepth += 1;
                i += 1;
                continue;
            }
            if (ch === CHAR_CLOSE_SQUARE) {
                if (bracketDepth > 0) {
                    bracketDepth -= 1;
                }
                i += 1;
                continue;
            }

            // Only a ':' outside quotes and attribute selectors can start a
            // pseudo-class we care about.
            if (ch !== CHAR_COLON || bracketDepth > 0) {
                i += 1;
                continue;
            }

            // Check for :contains( or :-abp-contains( at position i
            let matchedPrefix: string | null = null;
            if (selectorList.startsWith(containsPrefix, i)) {
                matchedPrefix = containsPrefix;
            } else if (selectorList.startsWith(abpContainsPrefix, i)) {
                matchedPrefix = abpContainsPrefix;
            }

            if (matchedPrefix === null) {
                // Not a :contains( — keep scanning.
                i += 1;
                continue;
            }

            // Flush the untouched source preceding this pseudo-class.
            parts.push(selectorList.slice(flushed, i));

            // Found :contains( or :-abp-contains( — replace with :has-text(
            parts.push(COLON);
            parts.push(PseudoClasses.HasText);
            parts.push(OPEN_PARENTHESIS);
            isConverted = true;

            // Extract argument using paren balance, skipping parens inside
            // quoted strings and after escape characters.
            const argStart = i + matchedPrefix.length;
            let parenBalance = 1;
            let pos = argStart;
            while (pos < selectorList.length && parenBalance > 0) {
                const argCh = selectorList.charCodeAt(pos);

                if (argCh === CHAR_BACKSLASH) {
                    // Skip escaped character
                    pos += 2;
                    continue;
                }

                if (argCh === CHAR_SINGLE_QUOTE || argCh === CHAR_DOUBLE_QUOTE) {
                    // Look ahead for the matching closing quote. Only skip the
                    // quoted range if the quote is properly closed; otherwise
                    // treat it as a literal character (unmatched quotes are
                    // common in :contains() arguments).
                    const closeIdx = findClosingQuote(selectorList, pos);
                    if (closeIdx !== -1) {
                        pos = closeIdx + 1;
                        continue;
                    }
                }

                if (argCh === CHAR_OPEN_PAREN) {
                    parenBalance += 1;
                } else if (argCh === CHAR_CLOSE_PAREN) {
                    parenBalance -= 1;
                }
                pos += 1;
            }

            // pos points past the matching ')'; argument is [argStart, pos - 1)
            const rawArg = selectorList.slice(argStart, pos - 1);
            const quotedArg = QuoteUtils.setStringQuoteType(rawArg, QuoteType.Single);
            parts.push(quotedArg);
            parts.push(CLOSE_PARENTHESIS);

            i = pos; // continue after the closing paren
            flushed = pos;
        }

        // Flush any remaining untouched source.
        parts.push(selectorList.slice(flushed));

        const result = parts.join(EMPTY);
        return createConversionResult(result, isConverted);
    }
}
