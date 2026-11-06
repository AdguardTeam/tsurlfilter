/**
 * @file
 * Line-level helpers of the page-exception pipeline: how a filter list is
 * split and how a raw line is normalized before parsing.
 *
 * Both the fingerprint (build) and the runtime exception lookup must read a
 * list identically, otherwise the fingerprint compares strings the engine
 * never sees. They live here, next to `hasher.ts`, so there is one copy.
 */

import { RawRuleConverter } from '@adguard/agtree';
import { MASK_ALLOWLIST, OPTIONS_DELIMITER } from '@adguard/tsurlfilter';

/**
 * Line breaks the engine's filter list reader recognizes.
 *
 * @see tsurlfilter `findNextLineBreakIndex`.
 */
const LINE_BREAK = /\r\n|\r|\n|\f/;

/**
 * Splits a filter list into lines the way the engine's reader does.
 *
 * @param content Raw filter list text.
 *
 * @returns Lines of the list.
 */
export const splitFilterLines = (content: string): string[] => {
    return content.split(LINE_BREAK);
};

/**
 * Checks whether a line can carry a page exception: an allowlist rule with
 * modifiers. Used to skip the lines the parser would drop anyway.
 *
 * @param line Raw filter line.
 *
 * @returns True when the line may carry a page exception.
 */
export const isExceptionCandidateLine = (line: string): boolean => {
    return line.includes(MASK_ALLOWLIST) && line.includes(OPTIONS_DELIMITER);
};

/**
 * Converts a raw rule line the way the engine's filter list does: on failure
 * the original line is kept.
 *
 * @param line Raw rule line.
 *
 * @returns Rule texts to parse.
 */
export const convertRuleLine = (line: string): string[] => {
    try {
        return RawRuleConverter.convertToAdg(line).result;
    } catch {
        return [line];
    }
};
