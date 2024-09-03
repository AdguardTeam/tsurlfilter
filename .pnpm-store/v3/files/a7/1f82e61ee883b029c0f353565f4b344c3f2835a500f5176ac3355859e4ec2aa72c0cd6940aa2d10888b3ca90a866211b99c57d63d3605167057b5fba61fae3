/// <reference path="../../../types/diff.d.ts" />
import { TypesOfChanges } from '../common/types-of-change';
import { Resolution } from '../common/patch-name';
export declare const PATCH_EXTENSION = ".patch";
/**
 * Parameters for building a diff patch between old and new filters.
 */
export interface BuildDiffParams {
    /**
     * The relative path to the old filter.
     */
    oldFilterPath: string;
    /**
     * The relative path to the new filter.
     */
    newFilterPath: string;
    /**
     * The relative path to the directory with patches.
     */
    patchesPath: string;
    /**
     * Name of the patch file, an arbitrary string to identify the patch.
     * Must be a string of length 1-64 with no spaces or other special characters.
     */
    name: string;
    /**
     * Expiration time for the diff update (the unit depends on `resolution`).
     */
    time: number;
    /**
     * An optional flag, indicating whether it should calculate
     * the SHA sum for the filter and add it to the `diff` directive with the filter
     * name and the number of changed lines.
     */
    checksum?: boolean;
    /**
     * An optional flag, specifying the resolution for
     * both `expirationPeriod` and `epochTimestamp` (timestamp when the patch was
     * generated). It can be either `h` (hours), `m` (minutes), or `s` (seconds).
     * If not specified, it is assumed to be `h`.
     */
    resolution?: Resolution;
    /**
     * An optional parameter, the time to live for the patch
     * in *seconds*. By default, it will be `604800` (7 days). The utility will
     * scan `<path_to_patches>` and delete patches whose created epoch timestamp
     * has expired.
     */
    deleteOlderThanSec?: number;
    /**
     * Verbose mode.
     */
    verbose?: boolean;
}
/**
 * Detects type of diff changes: add or delete.
 *
 * @param line Line of string to parse.
 *
 * @returns String type: 'Add' or 'Delete' or null if type cannot be parsed.
 */
export declare const detectTypeOfChanges: (line: string) => TypesOfChanges | null;
/**
 * Creates patch in [RCS format](https://www.gnu.org/software/diffutils/manual/diffutils.html#RCS).
 *
 * @param oldFile Old file.
 * @param newFile New file.
 *
 * @returns Difference between old and new files in RCS format.
 */
export declare const createPatch: (oldFile: string, newFile: string) => string;
/**
 * Checks if the provided file content contains a checksum tag within its first 200 characters.
 * This approach is selected to exclude parsing checksums from included filters.
 *
 * @param file The file content as a string.
 *
 * @returns `true` if the checksum tag is found, otherwise `false`.
 */
export declare const hasChecksum: (file: string) => boolean;
/**
 * Updates the 'Diff-Path' tag and optionally recalculates and adds a new
 * checksum tag in a provided array of filter lines.
 *
 * @param filterContent Filter content that needs to be updated.
 * @param diffPathTagValue The new value to be set for the 'Diff-Path' tag.
 *
 * @returns Updated filter content.
 */
export declare const updateTags: (filterContent: string, diffPathTagValue: string) => string;
/**
 * Validates a patch by comparing the old file with the new file after applying the patch.
 *
 * @param oldFile The original file content as a string.
 * @param newFile The expected file content after the patch is applied.
 * @param patch The patch content as a string.
 *
 * @returns Returns true if the patched old file matches the new file, false otherwise.
 */
export declare const isPatchValid: (oldFile: string, newFile: string, patch: string) => boolean;
/**
 * Determines if there are significant changes between two files, excluding
 * changes in 'Checksum' and 'Diff-Path' tags.
 * The function splits the file contents into lines, removes the mentioned tags,
 * and then compares the contents to determine if there are meaningful changes.
 *
 * @param oldFile The content of the old file as a string.
 * @param newFile The content of the new file as a string.
 *
 * @returns `true` if there are significant changes, otherwise `false`.
 */
export declare const hasChanges: (oldFile: string, newFile: string) => boolean;
/**
 * Asynchronously updates the 'Diff-Path' tag in a new filter file and creates
 * a diff patch compared to an old file.
 * This function ensures that changes to 'Diff-Path' and 'Checksum' are correctly
 * included in the diff patch.
 * It throws an error if the old and new patch names are the same.
 *
 * @param oldFile The content of the old file as a string.
 * @param newFile The content of the new file as a string.
 * @param checksumFlag Flag to determine if a checksum should be added to the patch.
 * @param pathToPatchesRelativeToNewFilter The relative path to the patches directory from the new filter's location.
 * @param newFilePatchName The proposed diff name for the new file.
 * @param oldFilePatchName The diff name in the old file, or null if not present.
 *
 * @throws Error if the old and new patch names are the same.
 *
 * @returns A promise that resolves to an object containing the updated content
 * of the new file and the generated diff patch.
 */
export declare const updateFileAndCreatePatch: (oldFile: string, newFile: string, checksumFlag: boolean, pathToPatchesRelativeToNewFilter: string, newFilePatchName: string, oldFilePatchName: string | null) => Promise<{
    newFileWithUpdatedTags: string;
    patch: string;
}>;
/**
 * Asynchronously builds a diff between two filter files and handles related
 * file operations. Resolves paths, creates necessary folders, deletes outdated
 * patches, and checks for changes in filter content.
 * If there are changes other than those with 'Diff-Path' and 'Checksum' tags,
 * it updates the content of the new filter file with new 'Diff-Path'
 * and 'Checksum' tags and creates patch files accordingly.
 *
 * @param params The parameters including paths, resolution, and other settings
 * for diff generation.
 *
 * @returns A promise that resolves when the diff operation is complete.
 */
export declare const buildDiff: (params: BuildDiffParams) => Promise<void>;
