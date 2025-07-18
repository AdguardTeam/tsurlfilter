/**
 * @file Parser for special uBO selectors.
 */

import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import {
    CLOSE_PARENTHESIS,
    COLON,
    CSS_NOT_PSEUDO,
    EMPTY,
    OPEN_PARENTHESIS,
} from '../../utils/constants';
import {
    type ModifierList,
    type Value,
    type Modifier,
    type UboSelector,
} from '../../nodes';
import { tokenizeFnBalanced } from './balancing';
import { type TokenData } from './css-token-stream';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../base-parser';
import { UboPseudoName } from '../../common/ubo-selector-common';

/**
 * Possible error messages for uBO selectors. Formatted with {@link sprintf}.
 */
export const ERROR_MESSAGES = {
    DUPLICATED_UBO_MODIFIER: "uBO modifier '%s' cannot be used more than once",
    EXPECTED_BUT_GOT_BEFORE: "Expected '%s' but got '%s' before '%s'",
    // eslint-disable-next-line max-len
    NEGATED_UBO_MODIFIER_CANNOT_BE_FOLLOWED_BY: "Negated uBO modifier '%s' cannot be followed by anything else than a closing parenthesis or a whitespace",
    NEGATED_UBO_MODIFIER_CANNOT_BE_PRECEDED_BY: "Negated uBO modifier '%s' cannot be preceded by '%s'",
    PSEUDO_CANNOT_BE_NESTED: "uBO modifier '%s' cannot be nested inside '%s', only '%s' is allowed as a wrapper",
    UBO_MODIFIER_CANNOT_BE_NESTED: "uBO modifier '%s' cannot be nested",
    UBO_STYLE_CANNOT_BE_FOLLOWED: 'uBO style injection cannot be followed by anything else than a whitespace',
};

/**
 * Dummy parameter for uBO modifiers in error messages.
 */
const DUMMY_PARAM = '...';

/**
 * Set of known uBO modifiers.
 *
 * @note We use `string` instead of `UboPseudoName` because we use this set for checking if a modifier is a known uBO,
 * and an unknown sequence is just a string.
 */
const KNOWN_UBO_MODIFIERS = new Set<string>([
    UboPseudoName.MatchesMedia,
    UboPseudoName.MatchesPath,
    UboPseudoName.Remove,
    UboPseudoName.Style,
]);

/**
 * Interface for stacked uBO modifier.
 */
type StackedUboModifier = {
    /**
     * Name of the modifier.
     *
     * @example
     * - `:matches-path(/path)`'s name is `matches-path`
     */
    name: string;

    /**
     * Start index of the modifier in the selector. Typically, this is the index of the colon.
     *
     * @example
     * ```text
     * - `div:style(padding: 0;)`
     *       ↑
     *       └ modifier start
     * ```
     *
     * But we have a special case: `:matches-path()` can be nested inside `:not()`s:
     *
     * ```text
     * - `div:not(:matches-path(/path))`
     *       ↑
     *       └ in this case, the modifier start is the index of the colon before the first :not, because in this case
     *         all of the nested modifiers are handled as a single modifier
     * ```
     */
    modifierStart: number;

    /**
     * Balance level of the modifier.
     *
     * @example
     * ```text
     * - `div:style(padding: 0;)`
     *    0000111111111111111110
     *        ↑                ↑
     *        |                └ modifier ends when the balance is -1 compared to the modifier balance
     *        |
     *        └ modifier balance is 1
     * ```
     */
    modifierBalance: number;

    /**
     * Start index of the modifier name in the selector.
     *
     * @example
     * ```text
     * - `div:style(padding: 0;)`
     *        ↑    ↑
     *        |    └ modifier name end
     *        |
     *        └ modifier name start
     * ```
     */
    nameStart: number;

    /**
     * End index of the modifier name in the selector.
     *
     * @example
     * ```text
     * - `div:style(padding: 0;)`
     *        ↑    ↑
     *        |    └ modifier name end
     *        |
     *        └ modifier name start
     * ```
     */
    nameEnd: number;

    /**
     * Start index of the modifier value in the selector.
     *
     * @example
     * ```text
     * - `div:style(padding: 0;)`
     *              ↑
     *              └ value start
     * ```
     *
     * If the modifier is a negated `:matches-path()`, then the value start also follows the same logic:
     *
     * ```text
     * - `div:not(:matches-path(/path))`
     *                          ↑
     *                          └ value start
     * ```
     */
    valueStart: number;

    /**
     * End index of the modifier value in the selector. This is `undefined` until the modifier is closed, because we
     * don't know the end index until then.
     *
     * @example
     * ```text
     * - `div:style(padding: 0;)`
     *                         ↑
     *                         └ value end
     * ```
     */
    valueEnd?: number;

    /**
     * Balance level of the modifier value.
     *
     * @example
     * ```text
     * - `div:style(padding: 0;)`
     *    0000111111111111111110
     *              ↑
     *              └ value balance is 1
     *
     * - `div:style(padding: calc(1 + 2);)`
     *    00001111111111111112222222222110
     *              ↑        ↑
     *              |        └ it can be more meantime, but it doesn't affect the end
     *              |
     *              └ value balance is 1
     * ```
     */
    valueBalance: number;

    /**
     * Whether the modifier is an exception (negated with `:not()`). This is checked when we determine the modifier
     * start and check `:not()`s before it.
     *
     * @example
     * - `div:not(:matches-path(/path))` is an exception because it's negated with `:not()`
     */
    isException: boolean;
};

/**
 * Helper function to check if the given selector has any uBO modifier. This function should be fast, because it's used
 * in the hot path of the parser.
 *
 * @param raw Raw selector string.
 * @returns `true` if the selector has any uBO modifier, `false` otherwise.
 */
const hasAnyUboModifier = (raw: string): boolean => {
    // Find the first colon
    let colonIndex = raw.indexOf(COLON);

    while (colonIndex !== -1) {
        // Find next opening parenthesis
        const openingParenthesisIndex = raw.indexOf(OPEN_PARENTHESIS, colonIndex + 1);

        // If there is no opening parenthesis, then the selector doesn't contain any uBO modifier
        if (openingParenthesisIndex === -1) {
            return false;
        }

        // Check if the modifier is a known uBO modifier
        if (KNOWN_UBO_MODIFIERS.has(raw.slice(colonIndex + 1, openingParenthesisIndex))) {
            return true;
        }

        // Find next colon
        colonIndex = raw.indexOf(COLON, colonIndex + 1);
    }

    return false;
};

/**
 * A simple helper function to format a pseudo name for error messages.
 *
 * @param name Pseudo name.
 * @param wrapper Wrapper pseudo name (eg. `not`) (optional, defaults to `undefined`).
 * @returns Formatted pseudo name.
 * @example
 * ```ts
 * formatPseudoName('matches-path', 'not'); // => ':not(:matches-path(...))'
 * formatPseudoName('matches-media'); // => ':matches-media(...)'
 * ```
 */
export const formatPseudoName = (name: string, wrapper?: string): string => {
    const result: string[] = [];

    if (wrapper) {
        result.push(COLON, wrapper, OPEN_PARENTHESIS);
    }

    result.push(COLON, name, OPEN_PARENTHESIS, DUMMY_PARAM, CLOSE_PARENTHESIS);

    if (wrapper) {
        result.push(CLOSE_PARENTHESIS);
    }

    return result.join(EMPTY);
};

/**
 * Parser for uBO selectors.
 */
export class UboSelectorParser extends BaseParser {
    /**
     * Parses a uBO selector list, eg. `div:matches-path(/path)`.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Parsed uBO selector {@link UboSelectorParser}.
     * @throws An {@link AdblockSyntaxError} if the selector list is syntactically invalid.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): UboSelector {
        // Prepare helper variables
        const modifiers: ModifierList = {
            type: 'ModifierList',
            children: [],
        };

        if (options.isLocIncluded) {
            modifiers.start = baseOffset;
            modifiers.end = baseOffset + raw.length;
        }

        // Do not perform any parsing if the selector doesn't contain any uBO modifier
        // Parsing is a relatively expensive operation, but this check is cheap, so we can avoid unnecessary work
        // TODO: Move this check to the cosmetic parser (adjustable syntaxes - if uBO syntax is disabled, then we don't
        // need to check for uBO modifiers)
        if (!hasAnyUboModifier(raw)) {
            const selector: Value = {
                type: 'Value',
                value: raw,
            };

            if (options.isLocIncluded) {
                selector.start = baseOffset;
                selector.end = baseOffset + raw.length;
            }

            const result: UboSelector = {
                type: 'UboSelector',
                selector,
                modifiers,
            };

            if (options.isLocIncluded) {
                result.start = baseOffset;
                result.end = baseOffset + raw.length;
            }

            return result;
        }

        // Simple way to check if a modifier is already processed to avoid duplicate modifiers
        const processedModifiers = new Set<string>();

        // We need to keep track of the tokens for handling negations properly
        const tokens: TokenData[] = [];

        // This array is used to mark the character slots in the selector string that are occupied by uBO modifiers
        const uboIndexes = new Array(raw.length);

        const uboModifierStack: StackedUboModifier[] = [];
        let i = 0;

        // Helper function to stack a uBO modifier
        const stackModifier = (modifier: StackedUboModifier) => {
            if (processedModifiers.has(modifier.name)) {
                throw new AdblockSyntaxError(
                    sprintf(ERROR_MESSAGES.DUPLICATED_UBO_MODIFIER, formatPseudoName(modifier.name)),
                    baseOffset + modifier.modifierStart,
                    baseOffset + raw.length,
                );
            }
            uboModifierStack.push(modifier);
        };

        // Tokenize the selector, calculate the balance
        tokenizeFnBalanced(raw, (type, start, end, _, balance) => {
            // Special case: style injection (`:style(...)` and `:remove()`) can only be used at the end of the
            // selector, like
            //  - `div:style(...)`,
            //  - `div:matches-media(...):style(...)`,
            //  - `div:remove()`,
            // etc.
            //
            // But not like
            //  - `:style(...) div`,
            //  - `:matches-media(...):style(...) div`,
            //  - `:remove() div`,
            // etc.
            //
            // The one exception is whitespace, which is allowed after style injection, like
            //  - `div:style(...) `,
            //  - `div:matches-media(...):style(...) `,
            //  - `div:remove() `,
            // etc.
            if (
                (
                    processedModifiers.has(UboPseudoName.Style)
                    || processedModifiers.has(UboPseudoName.Remove)
                )
                && type !== TokenType.Whitespace
            ) {
                throw new AdblockSyntaxError(
                    ERROR_MESSAGES.UBO_STYLE_CANNOT_BE_FOLLOWED,
                    baseOffset + start,
                    baseOffset + raw.length,
                );
            }

            // Check for pseudo classes (colon followed by a function)
            if (tokens[i - 1]?.type === TokenType.Colon && type === TokenType.Function) {
                // Since closing parenthesis is always included in the function token, but we only need the function
                // name, we need to cut off the last character, this is why we use `end - 1` here
                const fn = raw.slice(start, end - 1);

                // Check if the pseudo class is a known uBO modifier
                if (KNOWN_UBO_MODIFIERS.has(fn)) {
                    // Generally, uBO modifiers cannot be nested, like
                    //  - `:any(:matches-media(...))`,
                    //  - `:matches-media(:matches-media(...))`,
                    //  - `:not(style(...))`,
                    //  etc.
                    if (balance > 1) {
                        // However, we have one exception: `:matches-path()` can be nested inside `:not()`s, like:
                        //  - `:not(:matches-path(...))`,
                        //  - `:not(:not(:matches-path(...)))`,
                        //  etc.
                        //
                        // But it can't be nested inside any other pseudo class, like:
                        //  - `:anything(:matches-path(...))`,
                        //  etc.
                        //
                        // Moreover, :not() can't contain any other data, like
                        //  - `:not(div:matches-path(...))`,
                        //  - `:not(:matches-path(...):matches-path(...))`,
                        //  - `:not(:matches-path(...) div)`,
                        // etc.
                        if (fn === UboPseudoName.MatchesPath) {
                            if (uboModifierStack.length > 0) {
                                throw new AdblockSyntaxError(
                                    sprintf(
                                        ERROR_MESSAGES.PSEUDO_CANNOT_BE_NESTED,
                                        formatPseudoName(UboPseudoName.MatchesPath),
                                        formatPseudoName(uboModifierStack[uboModifierStack.length - 1].name),
                                        formatPseudoName(CSS_NOT_PSEUDO),
                                    ),
                                    baseOffset + start - 1,
                                    baseOffset + raw.length,
                                );
                            }

                            let isException = false;
                            let modifierBalance = balance;
                            let modifierStart = start;
                            for (let j = i - 1; j >= 0; j -= 1) {
                                // If we have reached the root level, then we should check if the `not` function is
                                // preceded by a colon (which means that it's a pseudo class)
                                if (tokens[j].balance === 0) {
                                    modifierStart = tokens[j].start;
                                    modifierBalance = tokens[j].balance;
                                    break;
                                } else if (
                                    tokens[j].type === TokenType.Colon
                                    || tokens[j].type === TokenType.Whitespace
                                ) {
                                    continue;
                                } else if (tokens[j].type === TokenType.Function) {
                                    const wrapperFnName = raw.slice(tokens[j].start, tokens[j].end - 1);
                                    if (wrapperFnName !== CSS_NOT_PSEUDO) {
                                        throw new AdblockSyntaxError(
                                            sprintf(
                                                ERROR_MESSAGES.PSEUDO_CANNOT_BE_NESTED,
                                                formatPseudoName(UboPseudoName.MatchesPath),
                                                formatPseudoName(wrapperFnName),
                                                formatPseudoName(CSS_NOT_PSEUDO),
                                            ),
                                            baseOffset + tokens[j].start - 1,
                                            baseOffset + raw.length,
                                        );
                                    }

                                    if (tokens[j - 1]?.type !== TokenType.Colon) {
                                        const got = tokens[j - 1]?.type
                                            ? getFormattedTokenName(tokens[j - 1]?.type)
                                            : 'nothing';

                                        throw new AdblockSyntaxError(
                                            sprintf(
                                                ERROR_MESSAGES.EXPECTED_BUT_GOT_BEFORE,
                                                getFormattedTokenName(TokenType.Colon),
                                                got,
                                                formatPseudoName(UboPseudoName.MatchesPath, CSS_NOT_PSEUDO),
                                            ),
                                            // eslint-disable-next-line no-unsafe-optional-chaining
                                            baseOffset + tokens[j - 1]?.start || 0,
                                            baseOffset + raw.length,
                                        );
                                    }

                                    isException = !isException;
                                    continue;
                                } else {
                                    throw new AdblockSyntaxError(
                                        sprintf(
                                            ERROR_MESSAGES.NEGATED_UBO_MODIFIER_CANNOT_BE_PRECEDED_BY,
                                            formatPseudoName(UboPseudoName.MatchesPath),
                                            getFormattedTokenName(tokens[j].type),
                                        ),
                                        baseOffset + tokens[j].start,
                                        baseOffset + raw.length,
                                    );
                                }
                            }

                            stackModifier({
                                name: fn,
                                modifierStart,
                                modifierBalance,
                                nameStart: start,
                                nameEnd: end - 1, // ignore opening parenthesis
                                valueStart: end,
                                valueBalance: balance,
                                isException,
                            });
                        } else {
                            throw new AdblockSyntaxError(
                                sprintf(ERROR_MESSAGES.UBO_MODIFIER_CANNOT_BE_NESTED, formatPseudoName(fn)),
                                baseOffset + start - 1,
                                baseOffset + raw.length,
                            );
                        }
                    } else {
                        stackModifier({
                            name: fn,
                            modifierStart: start - 1, // Include the colon
                            modifierBalance: balance,
                            nameStart: start,
                            nameEnd: end - 1, // ignore opening parenthesis
                            valueStart: end,
                            valueBalance: balance,
                            isException: false,
                        });
                    }
                }
            } else {
                // Get the last stacked modifier
                const lastStackedModifier = uboModifierStack[uboModifierStack.length - 1];

                // Do not allow any other token after `:matches-path(...)` inside `:not(...)`
                if (lastStackedModifier?.name === UboPseudoName.MatchesPath && lastStackedModifier?.isException) {
                    if (
                        !(type === TokenType.CloseParenthesis || type === TokenType.Whitespace)
                        && balance < lastStackedModifier.valueBalance
                    ) {
                        throw new AdblockSyntaxError(
                            sprintf(
                                ERROR_MESSAGES.NEGATED_UBO_MODIFIER_CANNOT_BE_FOLLOWED_BY,
                                formatPseudoName(UboPseudoName.MatchesPath),
                                getFormattedTokenName(type),
                            ),
                            baseOffset + start,
                            baseOffset + raw.length,
                        );
                    }
                }

                // If we have reached a closing parenthesis, then we should check if it closes the last stacked modifier
                // and if so, pop it from the stack
                if (type === TokenType.CloseParenthesis && lastStackedModifier) {
                    if (balance === Math.max(0, lastStackedModifier.valueBalance - 1)) {
                        lastStackedModifier.valueEnd = start;
                    }

                    if (balance === Math.max(0, lastStackedModifier.modifierBalance - 1)) {
                        const modifierName: Value = {
                            type: 'Value',
                            value: lastStackedModifier.name,
                        };

                        if (options.isLocIncluded) {
                            // TODO: Refactor
                            modifierName.start = baseOffset + lastStackedModifier.nameStart;
                            modifierName.end = baseOffset + lastStackedModifier.nameEnd;
                        }

                        const value: Value = {
                            type: 'Value',
                            value: raw.slice(lastStackedModifier.valueStart, lastStackedModifier.valueEnd),
                        };

                        if (options.isLocIncluded) {
                            value.start = baseOffset + lastStackedModifier.valueStart;
                            // It's safe to use `!` here, because we determined the value end index in the
                            // previous `if` statement
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            value.end = baseOffset + lastStackedModifier.valueEnd!;
                        }

                        const modifier: Modifier = {
                            type: 'Modifier',
                            name: modifierName,
                            value,
                            exception: lastStackedModifier.isException,
                        };

                        if (options.isLocIncluded) {
                            modifier.start = baseOffset + lastStackedModifier.modifierStart;
                            modifier.end = baseOffset + end;
                        }

                        modifiers.children.push(modifier);
                        processedModifiers.add(lastStackedModifier.name);
                        uboModifierStack.pop();

                        // Mark the character slots in the selector string that are occupied by uBO modifiers
                        uboIndexes.fill(true, lastStackedModifier.modifierStart, end);
                    }
                }
            }

            // Save the token to the history and increase the index
            tokens.push({
                type,
                start,
                end,
                balance,
            });

            i += 1;
        });

        const selector: Value = {
            type: 'Value',
            value: raw
                .split(EMPTY)
                .map((char, p) => (uboIndexes[p] ? EMPTY : char))
                .join(EMPTY)
                .trim(),
        };

        if (options.isLocIncluded) {
            selector.start = baseOffset;
            selector.end = baseOffset + raw.length;
        }

        const result: UboSelector = {
            type: 'UboSelector',
            selector,
            modifiers,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }
}
