import { type ComplexSelector, type SelectorList } from '../../../nodes';
import { type CssTokenStream, type TokenData } from '../../css/css-token-stream';
import { type ParserOptions } from '../../options';

/**
 * Interface that represents current selector list parser context.
 */
export interface SelectorListParserContext {
    /**
     * Raw input string being parsed.
     *
     * Note: This is the full raw string, not just the part being currently parsed.
     */
    raw: string;

    /**
     * Global parser options.
     */
    options: ParserOptions;

    /**
     * Starting offset of the input. Node locations are calculated relative to this offset.
     */
    baseOffset: number;

    /**
     * CSS token stream used for parsing.
     */
    stream: CssTokenStream;

    /**
     * Current token being processed.
     */
    token: TokenData;

    /**
     * Resulting selector list node.
     */
    result: SelectorList;

    /**
     * Currently processed complex selector node.
     */
    complexSelector: ComplexSelector;

    /**
     * Indicates whether the type selector is already set for `complexSelector`.
     */
    isTypeSelectorSet: boolean;
}
