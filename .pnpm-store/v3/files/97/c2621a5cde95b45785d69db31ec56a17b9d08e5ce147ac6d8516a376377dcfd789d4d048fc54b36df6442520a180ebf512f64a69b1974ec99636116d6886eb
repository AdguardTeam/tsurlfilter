/// <reference path="../../types/diff.d.ts" />

import path from 'path';
import fs from 'fs';

// eslint-disable-next-line import/extensions
import { structuredPatch } from 'diff/src/index.js';

import { CHECKSUM_TAG, DIFF_PATH_TAG } from '../common/constants';
import { TypesOfChanges } from '../common/types-of-change';
import { createDiffDirective, parseDiffDirective } from '../common/diff-directive';
import { calculateChecksumMD5 } from '../common/calculate-checksum';
import {
    Resolution,
    createPatchName,
    parsePatchName,
    timestampWithResolutionToMs,
} from '../common/patch-name';
import { splitByLines } from '../common/split-by-lines';
import { createLogger } from '../common/create-logger';
import {
    createTag,
    parseTag,
    removeTag,
} from './tags';
import { applyRcsPatch } from '../diff-updater/update';

const DEFAULT_PATCH_TTL_SECONDS = 60 * 60 * 24 * 7;

const NEW_LINE_INFO = '\\ No newline at end of file';

let log: (message: string) => void;

export const PATCH_EXTENSION = '.patch';

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
export const detectTypeOfChanges = (line: string): TypesOfChanges | null => {
    if (line.startsWith('+')) {
        return TypesOfChanges.Add;
    }

    if (line.startsWith('-')) {
        return TypesOfChanges.Delete;
    }

    return null;
};

/**
 * Creates patch in [RCS format](https://www.gnu.org/software/diffutils/manual/diffutils.html#RCS).
 *
 * @param oldFile Old file.
 * @param newFile New file.
 *
 * @returns Difference between old and new files in RCS format.
 */
export const createPatch = (oldFile: string, newFile: string): string => {
    const { hunks } = structuredPatch(
        'oldFile',
        'newFile',
        oldFile,
        newFile,
        '',
        '',
        {
            context: 0,
            ignoreCase: false,
        },
    );

    const outDiff: string[] = [];

    let stringsToAdd: string[] = [];
    let nStringsToDelete = 0;

    const collectParsedDiffBlock = (
        curIndex: number,
        deleted: number,
        added: string[],
    ): string[] => {
        if (deleted > 0) {
            const deleteFromPosition = curIndex;
            const rcsLines = [`d${deleteFromPosition} ${deleted}`];

            return rcsLines;
        }

        if (added.length > 0) {
            const addFromPosition = curIndex - 1;
            const rcsLines = [
                `a${addFromPosition} ${added.length}`,
                ...added,
            ];

            return rcsLines;
        }

        return [];
    };

    hunks.forEach((hunk, hunkIdx) => {
        const { oldStart, lines } = hunk;

        let fileIndexScanned = oldStart;

        // Library will print some debug info so we need to skip this line.
        const filteredLines = lines.filter((l) => l !== NEW_LINE_INFO);

        for (let index = 0; index < filteredLines.length; index += 1) {
            const line = filteredLines[index];

            // Detect type of diff operation
            const typeOfChange = detectTypeOfChanges(line);

            // Library will print some debug info so we need to skip this line.
            if (typeOfChange === null) {
                throw new Error(`Cannot parse line: ${line}`);
            }

            if (typeOfChange === TypesOfChanges.Delete) {
                // In RCS format we don't need content of deleted string.
                nStringsToDelete += 1;
            }
            if (typeOfChange === TypesOfChanges.Add) {
                // Slice "+" from the start of string.
                stringsToAdd.push(line.slice(1));
            }

            // Check type of next line for possible change diff type from 'add'
            // to 'delete' or from 'delete' to 'add'.
            const nextLineTypeOfChange = index + 1 < filteredLines.length
                ? detectTypeOfChanges(filteredLines[index + 1])
                : null;
            // If type will change - save current block
            const typeWillChangeOnNextLine = nextLineTypeOfChange && typeOfChange !== nextLineTypeOfChange;
            // Or if current line is the last - we need to save collected info.
            const isLastLine = index === filteredLines.length - 1;
            if (typeWillChangeOnNextLine || isLastLine) {
                const diffRCSLines = collectParsedDiffBlock(
                    fileIndexScanned,
                    nStringsToDelete,
                    stringsToAdd,
                );
                outDiff.push(...diffRCSLines);

                // Drop counters
                nStringsToDelete = 0;
                stringsToAdd = [];

                // Move scanned index
                fileIndexScanned += index + 1;
            }
        }

        // Check if we need to insert new line to the patch or not
        if ((lines.filter((l) => l === NEW_LINE_INFO).length > 0 && lines[lines.length - 1] !== NEW_LINE_INFO)
            || (lines.filter((l) => l === NEW_LINE_INFO).length === 0 && hunkIdx === hunks.length - 1)) {
            outDiff[outDiff.length - 1] = outDiff[outDiff.length - 1].concat('\n');
        }
    });

    return outDiff.join('\n');
};

/**
 * Scans `absolutePatchesPath` for files with the "*.patch" pattern and deletes
 * those whose created epoch timestamp has expired and whose are not empty.
 *
 * @param absolutePatchesPath Directory for scan.
 * @param deleteOlderThanSeconds The time to live for the patch in *seconds*.
 *
 * @returns Returns number of deleted patches.
 */
const deleteOutdatedPatches = async (
    absolutePatchesPath: string,
    deleteOlderThanSeconds: number,
): Promise<number> => {
    const files = await fs.promises.readdir(absolutePatchesPath);
    const tasksToDeleteFiles: Promise<void>[] = [];
    for (const file of files) {
        if (!file.endsWith(PATCH_EXTENSION)) {
            log(`Skipped deleting file "${file}" because its extension is not "${PATCH_EXTENSION}"`);
            continue;
        }

        const filePath = path.join(absolutePatchesPath, file);

        // eslint-disable-next-line no-await-in-loop
        const { size } = await fs.promises.stat(filePath);
        // If size is 0 - it means, that this patch is last active and we cannot
        // delete it even if it is outdated, because there is active link to
        // this patch in the filter's Diff-Path tag.
        if (size === 0) {
            log(`Skipped deleting file "${file}" because it is empty.`);
            continue;
        }

        const {
            resolution,
            epochTimestamp,
        } = parsePatchName(file);

        const createdMs = timestampWithResolutionToMs(epochTimestamp, resolution);

        const deleteOlderThanMs = deleteOlderThanSeconds * 1000;
        const deleteOlderThanDateMs = new Date().getTime() - deleteOlderThanMs;

        if (createdMs < deleteOlderThanDateMs) {
            log(`Deleting "${file}".`);
            // eslint-disable-next-line no-await-in-loop
            tasksToDeleteFiles.push(fs.promises.rm(filePath));
        } else {
            log(`Timestamp of "${file}" has not expired, deleting is skipped.`);
        }
    }

    const deleted = await Promise.all(tasksToDeleteFiles);

    return deleted.length;
};

/**
 * Checks if the provided file content contains a checksum tag within its first 200 characters.
 * This approach is selected to exclude parsing checksums from included filters.
 *
 * @param file The file content as a string.
 *
 * @returns `true` if the checksum tag is found, otherwise `false`.
 */
export const hasChecksum = (file: string): boolean => {
    const partOfFile = file.substring(0, 200);
    const lines = splitByLines(partOfFile);

    return lines.some((line) => line.startsWith(`! ${CHECKSUM_TAG}`));
};

/**
 * Updates the 'Diff-Path' tag and optionally recalculates and adds a new
 * checksum tag in a provided array of filter lines.
 *
 * @param filterContent Filter content that needs to be updated.
 * @param diffPathTagValue The new value to be set for the 'Diff-Path' tag.
 *
 * @returns Updated filter content.
 */
export const updateTags = (
    filterContent: string,
    diffPathTagValue: string,
): string => {
    // Split the content of the filters into lines.
    let newFileSplitted = splitByLines(filterContent);

    let userAgent: string | undefined;
    // User agent tag.
    if (newFileSplitted[0].startsWith('![') || newFileSplitted[0].startsWith('[')) {
        userAgent = newFileSplitted.shift();
    }

    // Remove tags 'Diff-Path' and 'Checksum' from new filterContent.
    newFileSplitted = removeTag(DIFF_PATH_TAG, removeTag(CHECKSUM_TAG, newFileSplitted));

    const lineEnding = newFileSplitted[0].endsWith('\r\n') ? '\r\n' : '\n';

    const diffPath = createTag(DIFF_PATH_TAG, diffPathTagValue, lineEnding);
    newFileSplitted.unshift(diffPath);

    if (userAgent !== undefined) {
        newFileSplitted.unshift(userAgent);
    }

    // If filter had checksum, calculate and insert a new checksum tag at the start of the filter
    if (hasChecksum(filterContent)) {
        const updatedChecksum = calculateChecksumMD5(newFileSplitted.join(''));
        const checksumTag = createTag(CHECKSUM_TAG, updatedChecksum, lineEnding);

        if (userAgent !== undefined) {
            // Insert Checksum after the userAgent header.
            newFileSplitted.splice(1, 0, checksumTag);
        } else {
            newFileSplitted.unshift(checksumTag);
        }
    }

    return newFileSplitted.join('');
};

/**
 * Validates a patch by comparing the old file with the new file after applying the patch.
 *
 * @param oldFile The original file content as a string.
 * @param newFile The expected file content after the patch is applied.
 * @param patch The patch content as a string.
 *
 * @returns Returns true if the patched old file matches the new file, false otherwise.
 */
export const isPatchValid = (
    oldFile: string,
    newFile: string,
    patch: string,
): boolean => {
    const patchLines = splitByLines(patch);

    const diffDirective = parseDiffDirective(patchLines[0]);

    const updatedFile = applyRcsPatch(
        splitByLines(oldFile),
        diffDirective ? patchLines.slice(1) : patchLines,
        diffDirective ? diffDirective.checksum : undefined,
    );

    return updatedFile === newFile;
};

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
export const hasChanges = (
    oldFile: string,
    newFile: string,
): boolean => {
    // Split the content of the filters into lines.
    let oldFileSplitted = splitByLines(oldFile);
    let newFileSplitted = splitByLines(newFile);

    // Remove 'Checksum' and 'Diff-Path' tags from both old and new filters.
    oldFileSplitted = removeTag(DIFF_PATH_TAG, removeTag(CHECKSUM_TAG, oldFileSplitted));
    newFileSplitted = removeTag(DIFF_PATH_TAG, removeTag(CHECKSUM_TAG, newFileSplitted));

    const oldFileHasChecksum = hasChecksum(oldFile);
    const newFileHasChecksum = hasChecksum(newFile);

    // Determine if there are meaningful changes in the files, excluding the 'Diff-Path' and 'Checksum' tags.
    // This comparison considers both the content and the presence of checksum tags in the old and new files.
    if (oldFileSplitted.join('') === newFileSplitted.join('') && oldFileHasChecksum === newFileHasChecksum) {
        return false;
    }

    return true;
};

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
export const updateFileAndCreatePatch = async (
    oldFile: string,
    newFile: string,
    checksumFlag: boolean,
    pathToPatchesRelativeToNewFilter: string,
    newFilePatchName: string,
    oldFilePatchName: string | null,
): Promise<{
    newFileWithUpdatedTags: string,
    patch: string,
}> => {
    // Verify that the patch names are not the same.
    if (oldFilePatchName === newFilePatchName) {
        // eslint-disable-next-line max-len
        throw new Error(`The old patch name "${oldFilePatchName}" and the new patch name "${newFilePatchName}" are the same. Consider changing the unit of measure or waiting.`);
    }

    // Note: Update 'Diff-Path' and 'Checksum' before calculating the diff
    // to ensure their changes are included in the resulting diff patch.
    const newFilterDiffPathTagValue = path.join(pathToPatchesRelativeToNewFilter, newFilePatchName);

    const newFileWithUpdatedTags = updateTags(
        newFile,
        newFilterDiffPathTagValue,
    );

    // Generate the diff patch.
    let patch = createPatch(oldFile, newFileWithUpdatedTags);

    // Optionally add a checksum to the patch.
    if (checksumFlag) {
        const diffDirective = createDiffDirective(oldFilePatchName, newFileWithUpdatedTags, patch);
        patch = diffDirective.concat('\n', patch);
    }

    return {
        newFileWithUpdatedTags,
        patch,
    };
};

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
export const buildDiff = async (params: BuildDiffParams): Promise<void> => {
    const {
        oldFilterPath,
        newFilterPath,
        patchesPath,
        name,
        time,
        resolution = Resolution.Hours,
        checksum: checksumFlag = false,
        deleteOlderThanSec = DEFAULT_PATCH_TTL_SECONDS,
        verbose = false,
    } = params;

    log = createLogger(verbose);

    // Resolve all necessary paths.
    const absoluteOldListPath = path.resolve(process.cwd(), oldFilterPath);
    const absoluteNewListPath = path.resolve(process.cwd(), newFilterPath);
    const absolutePatchesPath = path.resolve(process.cwd(), patchesPath);
    const pathToPatchesRelativeToNewFilter = path.relative(
        path.dirname(newFilterPath),
        absolutePatchesPath,
    );

    log(`Checking diff between "${absoluteOldListPath}" and "${absoluteNewListPath}".`);
    log(`Path to patches: "${absolutePatchesPath}".`);

    // Create the patches folder if it doesn't exist.
    if (!fs.existsSync(absolutePatchesPath)) {
        await fs.promises.mkdir(absolutePatchesPath, { recursive: true });
        log(`Created missing patches folder at "${absolutePatchesPath}".`);
    }

    log(`Checking patches to delete in the patches folder: "${absolutePatchesPath}"`);

    // Scan the patches folder and delete outdated patches.
    const deleted = await deleteOutdatedPatches(
        absolutePatchesPath,
        deleteOlderThanSec,
    );

    if (deleted > 0) {
        log(`Deleted ${deleted} outdated patches from "${absolutePatchesPath}".`);
    }

    // Read the content of the filters.
    const oldFile = await fs.promises.readFile(absoluteOldListPath, { encoding: 'utf-8' });
    const newFile = await fs.promises.readFile(absoluteNewListPath, { encoding: 'utf-8' });

    // Check for any changes except changes with Diff-Path and Checksum
    // in the filters.
    if (!hasChanges(oldFile, newFile)) {
        // If no significant changes, undo removal of 'Diff-Path' (it happens
        // by run `compiler` which currently not supported `Diff-Path` tag and
        // always remove it, even if filter has not changes)
        // and save the old file content to the new file.
        await fs.promises.writeFile(absoluteNewListPath, oldFile);

        log('No significant changes found.');
        log(`Reverted any removal of 'Diff-Path' in the new filter "${absoluteNewListPath}".`);

        return;
    }

    // Retrieve and save the 'Diff-Path' tag from the old filter before removal.
    let oldFilePatchName = parseTag(DIFF_PATH_TAG, splitByLines(oldFile));
    // Remove resourceName part after "#" sign if it exists.
    oldFilePatchName = oldFilePatchName ? oldFilePatchName.split('#')[0] : null;

    // Generate a name for the new patch.
    const newFilePatchName = createPatchName({ name, resolution, time });

    const {
        newFileWithUpdatedTags,
        patch,
    } = await updateFileAndCreatePatch(
        oldFile,
        newFile,
        checksumFlag,
        pathToPatchesRelativeToNewFilter,
        newFilePatchName,
        oldFilePatchName,
    );

    if (!isPatchValid(oldFile, newFileWithUpdatedTags, patch)) {
        log('Validating generated patch failed: old file with applied patch is not equal to new file.');
        return;
    }

    // Write the updated content to the new filter with an updated 'Diff-Path' and 'Checksum'.
    await fs.promises.writeFile(absoluteNewListPath, newFileWithUpdatedTags);
    log(`Updated 'Diff-Path' and 'Checksum' tags in the new filter at "${absoluteNewListPath}".`);

    // Create an empty patch for the future version if it doesn't exist.
    const emptyPatchForNewVersion = path.join(absolutePatchesPath, newFilePatchName);
    if (!fs.existsSync(emptyPatchForNewVersion)) {
        await fs.promises.writeFile(emptyPatchForNewVersion, '');
        log(`Created a patch for the new filter at ${emptyPatchForNewVersion}.`);
    }

    // If 'Diff-Path' is not found in the old filter, a patch for the old file
    // cannot be created.
    if (!oldFilePatchName) {
        log('No "Diff-Path" found in the old filter. Cannot create a patch for the old file.');
        return;
    }

    // 'Diff-Path' contains a path relative to the filter path, requiring path resolution.
    // Note: resolve this relative patch path to the new filter path to ensure
    // that folder with new filter will contain three main things: new filter itself,
    // patch to old version and new empty patch for future changes.
    const oldFilePatch = path.resolve(path.dirname(absoluteNewListPath), oldFilePatchName);
    // Save the diff to the patch file.
    await fs.promises.writeFile(oldFilePatch, patch);
    log(`Saved the patch to: ${oldFilePatch}`);
};
