/**
 * @file Output the version number to a build.txt file
 */

import fs from 'fs-extra';
import path from 'path';
import * as url from 'url';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const PROJECT_ROOT_RELATIVE_PATH = '../';
const DIST_FOLDER_NAME = 'dist';
const OUTPUT_FILE_NAME = 'build.txt';
const PKG_FILE_NAME = 'package.json';

// Computed constants
const distFolderPath = path.join(__dirname, PROJECT_ROOT_RELATIVE_PATH, DIST_FOLDER_NAME);
const pkgFilePath = path.join(__dirname, PROJECT_ROOT_RELATIVE_PATH, PKG_FILE_NAME);
const outputFilePath = path.join(distFolderPath, OUTPUT_FILE_NAME);

const rawPkg = fs.readFileSync(pkgFilePath, 'utf-8');
const pkg = JSON.parse(rawPkg);

if (!pkg.version) {
    throw new Error('Missing required field "version" in package.json');
}

/**
 * Main function
 */
const main = (): void => {
    // Create the dist folder if it doesn't exist
    fs.ensureDirSync(distFolderPath);

    // Write the output file
    const content = `version=${pkg.version}`;
    fs.writeFileSync(outputFilePath, content);

    console.log(`Wrote '${content}' to '${outputFilePath}' was successful`);
};

main();
