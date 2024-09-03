import fs from 'fs';

import packageJson from '../package.json';

const { version } = packageJson;

/**
 * Version delimiter.
 */
const VERSION_DELIMITER = '.';

/**
 * Utility for number formatting.
 *
 * @param value numeric value
 * @returns formatted string
 */
function formatNumber(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * Returns current date and time (UTC) in format `yyyymmddhhMMss`.
 *
 * @returns Date and time string.
 */
function getDeploymentDateString(): string {
    const now = new Date();

    const day = formatNumber(now.getUTCDate());
    const month = formatNumber(now.getUTCMonth() + 1); // Months are zero-based
    const year = String(now.getUTCFullYear());
    const hours = formatNumber(now.getUTCHours());
    const minutes = formatNumber(now.getUTCMinutes());
    const seconds = formatNumber(now.getUTCSeconds());

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Updates package version where patch version is replaced with deployment date and time.
 *
 * @see https://semver.org/
 *
 * @param version Current package version.
 * @returns Updated package version.
 */
function updateVersion(version: string): string {
    const deploymentDateString = getDeploymentDateString();

    const minorPatchDelimiterIndex = version.lastIndexOf(VERSION_DELIMITER);

    const versionWithoutPatch = version.slice(0, minorPatchDelimiterIndex);

    return `${versionWithoutPatch}${VERSION_DELIMITER}${deploymentDateString}`;
}

packageJson.version = updateVersion(version);
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
