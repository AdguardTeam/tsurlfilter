/**
 * @file
 * This file describes how to work with the `diff` directive.
 *
 * Format:
 * ```
 * diff name:[name] checksum:[checksum] lines:[lines].
 * ```
 *
 * - `name`: Name of the corresponding filter list. Mandatory when a resource
 * name is specified in the list.
 * - `checksum`: The expected SHA1 checksum of the file after the patch
 * is applied. Used to validate the patch.
 * - `lines`: The number of lines that follow, making up the RCS diff block.
 * Line count is determined using the same algorithm as `wc -l`, counting
 * newline characters '\n'.
 *
 * The `diff` directive is optional. If not specified, the patch is applied without validation.
 *
 * @see @link [Diff Files Format](https://github.com/ameshkov/diffupdates?tab=readme-ov-file#diff-files-format)
 */

import { calculateChecksumSHA1 } from './calculate-checksum';

const DIFF_DIRECTIVE = 'diff';
const DIFF_DIRECTIVE_NAME = 'name';
const DIFF_DIRECTIVE_CHECKSUM = 'checksum';
const DIFF_DIRECTIVE_LINE = 'lines';

/**
 * Represents a Diff Directive, containing information about the patch.
 */
interface DiffDirective {
    /**
     * The name associated with the directive.
     */
    name?: string;

    /**
     * The checksum value of the file after applying the patch.
     */
    checksum: string;

    /**
     * The number of lines affected by the diff operation.
     */
    lines: number;
}

/**
 * Creates `diff` directive with `Diff-Name` from filter (if found) and with
 * checksum of the new filter and number of lines of the patch.
 *
 * @param oldDiffPathTag Diff-Path tag from old filter.
 * @param newFilterContent New filter content.
 * @param patchContent Patch content.
 *
 * @returns Created `diff` directive.
 */
export const createDiffDirective = (
    oldDiffPathTag: string | null,
    newFilterContent: string,
    patchContent: string,
): string => {
    const [, resourceName] = (oldDiffPathTag || '').split('#');
    const checksum = calculateChecksumSHA1(newFilterContent);
    const lines = patchContent.split('\n').length - 1;

    const directive = [DIFF_DIRECTIVE];

    if (resourceName) {
        directive.push(`${DIFF_DIRECTIVE_NAME}:${resourceName}`);
    }

    directive.push(`${DIFF_DIRECTIVE_CHECKSUM}:${checksum}`);
    directive.push(`${DIFF_DIRECTIVE_LINE}:${lines}`);

    return directive.join(' ');
};

/**
 * Parses a string to extract a Diff Directive object.
 *
 * @param s The string to parse.
 * @returns A Diff Directive object if the string is a valid diff directive,
 * otherwise null.
 */
export const parseDiffDirective = (s: string): DiffDirective | null => {
    if (!s.startsWith(DIFF_DIRECTIVE)) {
        return null;
    }

    const parts = s
        .split(' ')
        // skip 'diff'
        .slice(1);

    const nameExists = parts[0].startsWith(DIFF_DIRECTIVE_NAME);

    if (nameExists) {
        return {
            name: parts[0].slice(`${DIFF_DIRECTIVE_NAME}:`.length),
            checksum: parts[1].slice(`${DIFF_DIRECTIVE_CHECKSUM}:`.length),
            lines: Number(parts[2].slice(`${DIFF_DIRECTIVE_LINE}:`.length)),
        };
    }

    return {
        checksum: parts[0].slice(`${DIFF_DIRECTIVE_CHECKSUM}:`.length),
        lines: Number(parts[1].slice(`${DIFF_DIRECTIVE_LINE}:`.length)),
    };
};
