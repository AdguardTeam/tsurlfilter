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
export declare const createDiffDirective: (oldDiffPathTag: string | null, newFilterContent: string, patchContent: string) => string;
/**
 * Parses a string to extract a Diff Directive object.
 *
 * @param s The string to parse.
 * @returns A Diff Directive object if the string is a valid diff directive,
 * otherwise null.
 */
export declare const parseDiffDirective: (s: string) => DiffDirective | null;
export {};
