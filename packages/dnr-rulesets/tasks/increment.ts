import fs from 'fs';
import path from 'path';

import { version } from '../package.json';

const VERSION_DELIMITER = '.';
const PRERELEASE_DELIMITER = '-';

/**
 * Increments the version based on its format
 * - For regular versions (x.y.z): increments the patch version
 * - For prerelease versions (x.y.z-alpha.n or x.y.z-beta.n): increments only the last number
 *
 * @param version The current version string.
 *
 * @returns The incremented version string.
 *
 * @example
 * `3.0.0-alpha.4` → `3.0.0-alpha.5`
 * `3.0.0` → `3.0.1`
 */
function incrementVersion(version: string): string {
    // Check if it's a prerelease version (alpha/beta)
    const hasPrerelease = version.includes(PRERELEASE_DELIMITER);

    if (hasPrerelease) {
        // It's a prerelease version like 3.0.0-alpha.4
        const [baseVersion, preReleasePart] = version.split(PRERELEASE_DELIMITER);
        const lastDotIndex = preReleasePart.lastIndexOf(VERSION_DELIMITER);

        // Extract the prerelease type (alpha/beta) and number
        const preReleaseType = preReleasePart.substring(0, lastDotIndex);
        const preReleaseNumber = preReleasePart.substring(lastDotIndex + 1);

        const newPreReleaseNumber = parseInt(preReleaseNumber, 10) + 1;
        return `${baseVersion}${PRERELEASE_DELIMITER}${preReleaseType}${VERSION_DELIMITER}${newPreReleaseNumber}`;
    } else {
        // It's a regular version like 3.0.0
        const versionParts = version.split(VERSION_DELIMITER);
        if (versionParts.length !== 3) {
            throw new Error(`Invalid version format: ${version}`);
        }

        const [major, minor, patch] = versionParts;
        const newPatch = parseInt(patch, 10) + 1;
        return `${major}${VERSION_DELIMITER}${minor}${VERSION_DELIMITER}${newPatch}`;
    }
}

/**
 * Updates package.json with the new version.
 */
const updatePackageJson = () => {
    const newVersion = incrementVersion(version);

    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    const packageJsonContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    packageJsonContent.version = newVersion;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 4) + '\n');

    console.log(`Version updated: ${version} → ${newVersion}`);
};

updatePackageJson();
