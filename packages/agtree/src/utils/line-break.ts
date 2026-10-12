/**
 * @file Line-break scanning shared by the converter and the filter-list
 * scanner, so the line-break policy has a single owner. Two policies live
 * here: the converter's ({@link findNextLineBreak}, LF/CRLF/CR only) and the
 * tokenizer-aligned one ({@link findNextTokenizerLineBreak}, which also
 * treats form feed as a line break).
 */

import { FF } from './constants';

/**
 * Finds the next line break at or after `offset`.
 *
 * Recognizes LF (`\n`), CRLF (`\r\n`), and a lone CR (`\r`). Form feed is
 * intentionally NOT treated as a line break in v5 (the legacy scanner did).
 *
 * @param source Source text.
 * @param offset Start offset.
 *
 * @returns Tuple of the line-break index and its length (0 length at EOF).
 */
export function findNextLineBreak(source: string, offset: number): [index: number, length: number] {
    const { length } = source;
    for (let i = offset; i < length; i += 1) {
        const c = source.charCodeAt(i);
        // Line feed (`\n`).
        if (c === 0x0a) {
            return [i, 1];
        }
        // Carriage return (`\r`), either CRLF (length 2) or a lone CR (length 1).
        if (c === 0x0d) {
            return [i, i + 1 < length && source.charCodeAt(i + 1) === 0x0a ? 2 : 1];
        }
    }
    return [length, 0];
}

/**
 * Finds the next line break at or after `offset` as the tokenizer sees it.
 *
 * Same as {@link findNextLineBreak}, but form feed (`\f`) also counts as a
 * line break, because the tokenizer emits a line-break token for it. Used by
 * the filter-list scanner's capacity-overflow fallback, which must split
 * exactly where the normal token-based scan does.
 *
 * @param source Source text.
 * @param offset Start offset.
 *
 * @returns Tuple of the line-break index and its length (0 length at EOF).
 */
export function findNextTokenizerLineBreak(source: string, offset: number): [index: number, length: number] {
    const [lineBreakIndex, lineBreakLength] = findNextLineBreak(source, offset);
    const formFeedIndex = source.indexOf(FF, offset);
    if (formFeedIndex !== -1 && formFeedIndex < lineBreakIndex) {
        return [formFeedIndex, 1];
    }
    return [lineBreakIndex, lineBreakLength];
}
