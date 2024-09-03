/**
 * @file
 * This file describes how to work with the patch file name.
 *
 * The Diff-Path also encodes additional information in the file name:
 *
 * <patchName>[-<resolution>]-<epochTimestamp>-<expirationPeriod>.patch[#<resourceName>]
 *
 * `patchName` - The name of the patch file, an arbitrary string to identify
 * the patch.
 * `epochTimestamp` - The epoch timestamp when the patch was generated (the unit
 * of that timestamp depends on the resolution, see below).
 * `expirationPeriod` - The expiration time for the diff update (the unit depends
 * on the resolution, see below).
 * `resolution` - An optional field that specifies the resolution for both
 * `expirationPeriod` and `epochTimestamp`. It can be either 'h' (hours),
 * 'm' (minutes), or 's' (seconds). If `resolution` is not specified,
 * it is assumed to be 'h'.
 * `resourceName` - The name of the resource that is being patched. This is used
 * to support batch updates, see the [Batch Updates](https://github.com/ameshkov/diffupdates?tab=readme-ov-file#batch-updates)
 * section for more details.
 *
 * @see {@link https://github.com/ameshkov/diffupdates?tab=readme-ov-file#-diff-path}
 */
/**
 * Enumeration representing different resolutions for timestamp generation.
 */
export declare const Resolution: {
    readonly Hours: "h";
    readonly Minutes: "m";
    readonly Seconds: "s";
};
export type Resolution = typeof Resolution[keyof typeof Resolution];
/**
 * Generates a creation time timestamp based on the specified resolution.
 *
 * @param resolution - The desired resolution for the timestamp (Minutes, Seconds,
 * or Hours).
 *
 * @returns A timestamp representing the creation time based on the specified
 * resolution.
 *
 * @throws {Error} If an unexpected resolution is provided.
 */
export declare const generateCreationTime: (resolution: Resolution) => number;
/**
 * Converts a timestamp to milliseconds based on the specified resolution.
 *
 * @param timestamp The timestamp to convert.
 * @param resolution The desired resolution for the timestamp (Minutes, Seconds, or Hours).
 *
 * @returns The timestamp in milliseconds.
 *
 * @throws {Error} If an unexpected resolution is provided.
 */
export declare const timestampWithResolutionToMs: (timestamp: number, resolution: Resolution) => number;
/**
 * An interface representing the components of a patch name.
 */
export interface PatchName {
    name: string;
    resolution: Resolution;
    time: number;
}
/**
 * An interface representing the parsed components of a patch name.
 */
interface ParsedPatchName extends PatchName {
    epochTimestamp: number;
}
/**
 * Validates a patch name to ensure it contain only letters, digits, '_' and '.'.
 *
 * @param patchName The patch name to validate.
 *
 * @returns True if the patch name is valid, false otherwise.
 */
export declare const isPatchNameValid: (patchName: string) => boolean;
export declare const PATCH_FILE_ERROR_TEXT = "Name of the patch file should contain only letters, digits, '_' and '.'";
/**
 * Generates a patch name based on the provided options.
 *
 * @param options The options for creating the patch name.
 *
 * @returns A string representing the generated patch name.
 *
 * @throws {Error} If the provided name is invalid according to the criteria.
 */
export declare const createPatchName: (options: PatchName) => string;
/**
 * Parses a patch name into its components.
 *
 * @param patchName - The patch name to parse.
 *
 * @returns An object containing the parsed components of the patch name.
 *
 * @throws Error if the patch name cannot be parsed.
 */
export declare const parsePatchName: (patchName: string) => ParsedPatchName;
export {};
