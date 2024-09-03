/* eslint-disable jsdoc/require-description-complete-sentence */
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
/* eslint-enable jsdoc/require-description-complete-sentence */

/**
 * The file extension used for patch files.
 */
const FILE_EXTENSION = '.patch';

const MS_IN_SECONDS = 1000;
const MS_IN_MINUTES = MS_IN_SECONDS * 60;
const MS_IN_HOURS = MS_IN_MINUTES * 60;

/**
 * Enumeration representing different resolutions for timestamp generation.
 */
export const Resolution = {
    Hours: 'h',
    Minutes: 'm',
    Seconds: 's',
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Resolution = typeof Resolution[keyof typeof Resolution];

/**
 * Throws an error for unexpected values.
 *
 * @param x The unexpected value.
 *
 * @throws Always throws an error with a message indicating an unexpected value.
 */
const assertNever = (x: never): never => {
    throw new Error(`Unexpected value in resolution: ${x}`);
};

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
export const generateCreationTime = (resolution: Resolution): number => {
    switch (resolution) {
        case Resolution.Hours:
            return Math.round(Date.now() / MS_IN_HOURS);
        case Resolution.Minutes:
            return Math.round(Date.now() / MS_IN_MINUTES);
        case Resolution.Seconds:
            return Math.round(Date.now() / MS_IN_SECONDS);
        default:
            return assertNever(resolution);
    }
};

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
export const timestampWithResolutionToMs = (timestamp: number, resolution: Resolution): number => {
    switch (resolution) {
        case Resolution.Hours:
            return timestamp * MS_IN_HOURS;
        case Resolution.Minutes:
            return timestamp * MS_IN_MINUTES;
        case Resolution.Seconds:
            return timestamp * MS_IN_SECONDS;
        default:
            return assertNever(resolution);
    }
};

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
export const isPatchNameValid = (patchName: string): boolean => {
    return /^[a-zA-Z0-9_.]{1,64}$/.test(patchName);
};

export const PATCH_FILE_ERROR_TEXT = "Name of the patch file should contain only letters, digits, '_' and '.'";

/**
 * Generates a patch name based on the provided options.
 *
 * @param options The options for creating the patch name.
 *
 * @returns A string representing the generated patch name.
 *
 * @throws {Error} If the provided name is invalid according to the criteria.
 */
export const createPatchName = (options: PatchName): string => {
    const {
        name,
        resolution,
        time,
    } = options;

    if (!isPatchNameValid(name)) {
        throw new Error(PATCH_FILE_ERROR_TEXT);
    }

    const epochTimestamp = generateCreationTime(resolution);

    const newFilePatchName = [name];

    if (resolution && resolution !== Resolution.Hours) {
        newFilePatchName.push(resolution);
    }

    newFilePatchName.push(epochTimestamp.toString());
    newFilePatchName.push(time.toString());

    return newFilePatchName.join('-').concat(FILE_EXTENSION);
};

/**
 * Parses a patch name into its components.
 *
 * @param patchName - The patch name to parse.
 *
 * @returns An object containing the parsed components of the patch name.
 *
 * @throws Error if the patch name cannot be parsed.
 */
export const parsePatchName = (patchName: string): ParsedPatchName => {
    const parts = patchName
        .slice(0, -FILE_EXTENSION.length)
        .split('-');

    // Long variant
    if (parts.length === 4) {
        const [
            name,
            parsedResolution,
            parsedEpochTimestamp,
            parsedTime,
        ] = parts;

        if (!(Object.values(Resolution)).includes(parsedResolution as Resolution)) {
            throw new Error(`Unrecognized resolution in patch name: ${patchName}`);
        }

        return {
            name,
            resolution: parsedResolution as Resolution,
            epochTimestamp: Number.parseInt(parsedEpochTimestamp, 10),
            time: Number.parseInt(parsedTime, 10),
        };
    }

    // Short variant with a default resolution value
    if (parts.length === 3) {
        const [
            name,
            parsedEpochTimestamp,
            parsedTime,
        ] = parts;
        const resolution = Resolution.Hours;

        return {
            name,
            resolution,
            epochTimestamp: Number.parseInt(parsedEpochTimestamp, 10),
            time: Number.parseInt(parsedTime, 10),
        };
    }

    throw new Error(`Cannot parse the patch name: ${patchName}`);
};
