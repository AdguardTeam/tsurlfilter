import fs from 'fs';

import packageJson from '../package.json';

const { version } = packageJson;

/**
 * Delimiter for build version that respects semver spec.
 *
 * @see https://semver.org/
 */
const SEMVER_BUILD_DELIMITER = '+';

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
 * Returns deployment date string in format `yyyy-mm-dd-hh-MM-ss`.
 *
 * @returns Date string
 */
function getDeploymentDateString(): string {
    const now = new Date();

    const day = formatNumber(now.getDate());
    const month = formatNumber(now.getMonth() + 1); // Months are zero-based
    const year = String(now.getFullYear());
    const hours = formatNumber(now.getHours());
    const minutes = formatNumber(now.getMinutes());
    const seconds = formatNumber(now.getSeconds());

    return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

/**
 * Updates package version with deployment date respecting the semver format.
 *
 * @see https://semver.org/
 *
 * @param version current package version
 * @returns updated package version with deployment date
 */
function updateDeployDate(version: string): string {
    const deploymentDateString = getDeploymentDateString();

    const delimiterIndex = version.indexOf(SEMVER_BUILD_DELIMITER);

    if (delimiterIndex > -1) {
        version = version.slice(0, delimiterIndex);
    }

    return `${version}${SEMVER_BUILD_DELIMITER}${deploymentDateString}`;
}

packageJson.version = updateDeployDate(version);
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
