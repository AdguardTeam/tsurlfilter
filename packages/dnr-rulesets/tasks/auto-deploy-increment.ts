import fs from 'fs';

import packageJson from '../package.json';
import { DOT } from '../src/common/constants';
import { generatePatchVersion } from '../src/utils/version-utils';

const { version } = packageJson;

/**
 * Updates package version where patch version is replaced with deployment date and time.
 *
 * @see {@link https://semver.org/}
 *
 * @param currentVersion Current package version.
 *
 * @returns Updated package version.
 */
const updateVersion = (currentVersion: string): string => {
    const [majorVersion, minorVersion] = currentVersion.split(DOT);

    const newPatchVersion = generatePatchVersion(Date.now());

    return `${majorVersion}${DOT}${minorVersion}${DOT}${newPatchVersion}`;
};

packageJson.version = updateVersion(version);
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 4));
