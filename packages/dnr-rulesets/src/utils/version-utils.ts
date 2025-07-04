import { version } from '../../package.json';
import {
    COLON,
    DASH,
    DOT,
    SPACE,
    UTC_PLUS_0,
} from '../common/constants';

/**
 * Length of the generated patch version.
 *
 * Length of the `yyyymmddhhMMss` format.
 */
const GENERATED_PATCH_VERSION_LENGTH = 14;

/**
 * Returns the version of the package.
 *
 * @returns The version of the package.
 */
export const getVersion = (): string => version;

/**
 * Utility for number formatting.
 *
 * @param value Numeric value.
 * @param length Length of the formatted string, default is 2.
 *
 * @returns Formatted string.
 */
const formatNumber = (value: number, length = 2): string => String(value).padStart(length, '0');

/**
 * Returns current date and time (UTC+0) in format `yyyymmddhhMMss`.
 *
 * @param timestampMs Timestamp in milliseconds.
 *
 * @returns Date and time string.
 *
 * @example
 * `1739560493923` => `20250215191524`
 */
export const generatePatchVersion = (timestampMs: number): string => {
    const date = new Date(timestampMs);

    const day = formatNumber(date.getUTCDate());
    const month = formatNumber(date.getUTCMonth() + 1); // Months are zero-based
    const year = formatNumber(date.getUTCFullYear(), 4);
    const hours = formatNumber(date.getUTCHours());
    const minutes = formatNumber(date.getUTCMinutes());
    const seconds = formatNumber(date.getUTCSeconds());

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

/**
 * Returns the timestamp of the dnr-rulesets build, parsed from the version string.
 *
 * @returns Timestamp in milliseconds for latest build
 * or current timestamp if version parsing fails.
 *
 * @example
 * ```text
 * version → timestamp:
 * 1.2.20250215191524 → 1739664924000
 * 2.0.0 → <current timestamp>
 * ```
 */
export const getVersionTimestampMs = (): number => {
    return generateTimestampFromVersion(version);
};

/**
 * Generates a timestamp from a version string.
 *
 * @param version The version string.
 *
 * @returns The timestamp in milliseconds.
 */
export const generateTimestampFromVersion = (version: string): number => {
    // dnr-rulesets generated patch version is date and time (UTC+0) in format `yyyymmddhhMMss`
    // but if the version is not generated by dnr-rulesets, e.g. `2.0.0`, we return current timestamp
    const patchVersion = version.split(DOT).pop();
    if (!patchVersion || patchVersion.length !== GENERATED_PATCH_VERSION_LENGTH) {
        return Date.now();
    }

    const dateStr = [
        patchVersion.slice(0, 4), // yyyy
        DASH,
        patchVersion.slice(4, 6), // mm
        DASH,
        patchVersion.slice(6, 8), // dd
        SPACE,
        patchVersion.slice(8, 10), // hh
        COLON,
        patchVersion.slice(10, 12), // MM
        COLON,
        patchVersion.slice(12, 14), // ss
        SPACE,
        UTC_PLUS_0,
    ].join('');

    return Date.parse(dateStr);
};
