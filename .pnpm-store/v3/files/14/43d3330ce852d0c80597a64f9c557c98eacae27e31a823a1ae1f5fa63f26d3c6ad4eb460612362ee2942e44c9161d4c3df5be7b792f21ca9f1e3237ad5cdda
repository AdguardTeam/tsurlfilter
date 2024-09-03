/**
 * Interface describing the parameters of the applyPatch function.
 */
export interface ApplyPatchParams {
    /**
     * The URL from which the RCS patch can be obtained.
     * @type {string}
     */
    filterUrl: string;
    /**
     * The original filter content as a string.
     * @type {string}
     */
    filterContent: string;
    /**
     * Whether to enable verbose mode.
     * @type {boolean}
     */
    verbose?: boolean;
}
/**
 * Applies an RCS (Revision Control System) patch to a filter content.
 *
 * @param filterContent An array of strings representing the original filter content.
 * @param patch An array of strings representing the RCS patch to apply.
 * @param checksum An optional checksum to validate the updated filter content.
 * @returns The updated filter content after applying the patch.
 * @throws If the provided checksum doesn't match the calculated checksum.
 */
export declare const applyRcsPatch: (filterContent: string[], patch: string[], checksum?: string) => string;
/**
 * Extracts the base URL or directory path from a given URL or file path.
 * It identifies the appropriate delimiter (forward slash '/' for URLs and
 * POSIX file paths, or backslash '\' for Windows file paths), splits the string
 * using this delimiter, and then rejoins the parts excluding the last segment.
 * This effectively removes the file name or the last part of the path,
 * returning only the base path.
 *
 * @param filterUrl The URL or file path from which to extract the base.
 *
 * @returns The base URL or directory path without the last segment.
 */
export declare const extractBaseUrl: (filterUrl: string) => string;
/**
 * Applies an RCS (Revision Control System) patch to update a filter's content.
 *
 * @param params The parameters for applying the patch {@link ApplyPatchParams}.
 *
 * @returns A promise that resolves to the updated filter content after applying the patch,
 * or null if there is no Diff-Path tag in the filter.
 *
 * @throws
 * 1. An {@link Error} if there is an error during
 *     - the patch application process
 *     - during network request.
 * 2. The {@link UnacceptableResponseError} if the network request returns an unacceptable status code.
 */
export declare const applyPatch: (params: ApplyPatchParams) => Promise<string | null>;
