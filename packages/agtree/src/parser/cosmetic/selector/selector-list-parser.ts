import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import { type SelectorList } from '../../../nodes';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import {
    ASTERISK,
    DOT,
    GREATER_THAN,
    PLUS,
    SPACE,
    TILDE,
} from '../../../utils/constants';
import { BaseParser } from '../../base-parser';
import { CssTokenStream } from '../../css/css-token-stream';
import { defaultParserOptions } from '../../options';
import { type SelectorListParserContext } from './context';
import { TypeSelectorHandler } from './handlers/type-selector-handler';
import { IdSelectorHandler } from './handlers/id-selector-handler';
import { AttributeSelectorHandler } from './handlers/attribute-selector-handler';
import { PseudoClassSelectorHandler } from './handlers/pseudo-class-selector-handler';
import { ClassSelectorHandler } from './handlers/class-selector-handler';
import { CompoundSelectorHandler } from './handlers/compound-selector-handler';
import { ComplexSelectorHandler } from './handlers/complex-selector-handler';

/**
 * Class responsible for parsing selector lists.
 *
 * Please note that the parser will parse any selector list if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * div[attr1="value1"] > h1[attr2="value2"], span[attr3="value3"]
 * ```
 *
 * but it didn't check if the given attribute or pseudo-class is valid or not.
 *
 * @see {@link https://www.w3.org/TR/selectors-4/#selector-list}'
 */
export class SelectorListParser extends BaseParser {
    /**
     * Common error messages used in the parser for unexpected tokens.
     */
    private static readonly UNEXPECTED_TOKEN_WITH_VALUE_ERROR = "Unexpected token '%s' with value '%s'";

    /**
     * Parses a selector list.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Node of the parsed selector list.
     *
     * @throws If the selector list is syntactically incorrect.
     *
     * @example
     * ```
     * div[attr1="value1"] > h1[attr2="value2"], span[attr3="value3"]
     * ```
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): SelectorList {
        // Construct the stream
        const stream = new CssTokenStream(raw, baseOffset);

        // Skip whitespaces before first token
        stream.skipWhitespace();

        // Construct selector list parser context
        const context: SelectorListParserContext = {
            raw,
            options,
            baseOffset,
            stream,

            // Get first token
            token: stream.getOrFail(),

            // Construct selector list node
            result: {
                type: 'SelectorList',
                children: [],
            },

            // Construct first complex selector node
            complexSelector: {
                type: 'ComplexSelector',
                children: [],
            },

            // Track if type selector set in the current compound selector
            isTypeSelectorSet: false,
        };

        // Include locations for (if needed):
        // - start and end for the selector list node
        // - start for the first complex selector node
        if (options.isLocIncluded) {
            context.result.start = baseOffset;
            context.result.end = baseOffset + raw.length;
            context.complexSelector.start = baseOffset + context.token.start;
        }

        // Traverse the stream
        while (!stream.isEof()) {
            // Get next token
            context.token = stream.getOrFail();

            switch (context.token.type) {
                // Tag selector
                case TokenType.Ident: {
                    TypeSelectorHandler.handle(context);
                    break;
                }

                // ID selector
                case TokenType.Hash: {
                    IdSelectorHandler.handle(context);
                    break;
                }

                // Attribute selector
                case TokenType.OpenSquareBracket: {
                    AttributeSelectorHandler.handle(context);
                    break;
                }

                // Pseudo-class selector
                case TokenType.Colon: {
                    PseudoClassSelectorHandler.handle(context);
                    break;
                }

                // Universal type selector ('*'), Class selector ('.'), Combinators ('>', '+', '~')
                case TokenType.Delim: {
                    // Get delimiter value
                    const delimiter = stream.fragment();

                    switch (delimiter) {
                        // Universal type selector ('*')
                        case ASTERISK: {
                            TypeSelectorHandler.handle(context);
                            break;
                        }

                        // Class selector ('.)
                        case DOT: {
                            ClassSelectorHandler.handle(context);
                            break;
                        }

                        // Combinators ('>', '+', '~')
                        case GREATER_THAN:
                        case PLUS:
                        case TILDE: {
                            CompoundSelectorHandler.handle(context, delimiter);
                            break;
                        }

                        default: {
                            throw new AdblockSyntaxError(
                                sprintf(
                                    SelectorListParser.UNEXPECTED_TOKEN_WITH_VALUE_ERROR,
                                    getFormattedTokenName(context.token.type),
                                    delimiter,
                                ),
                                baseOffset + context.token.start,
                                baseOffset + context.token.end,
                            );
                        }
                    }

                    break;
                }

                // End of current compound selector (whitespace combinator - descendant)
                case TokenType.Whitespace: {
                    CompoundSelectorHandler.handle(context, SPACE);
                    break;
                }

                // End of current complex selector
                case TokenType.Comma: {
                    ComplexSelectorHandler.handle(context, false);
                    break;
                }

                default: {
                    throw new AdblockSyntaxError(
                        sprintf(
                            SelectorListParser.UNEXPECTED_TOKEN_WITH_VALUE_ERROR,
                            getFormattedTokenName(context.token.type),
                            stream.fragment(),
                        ),
                        baseOffset + context.token.start,
                        baseOffset + context.token.end,
                    );
                }
            }
        }

        // Finish last complex selector
        ComplexSelectorHandler.handle(context);

        return context.result;
    }
}
