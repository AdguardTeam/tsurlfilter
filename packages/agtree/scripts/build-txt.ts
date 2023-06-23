/**
 * @file Output the version number to a build.txt file
 */
import fs from 'fs';
import path from 'path';
import * as url from 'url';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const UPPER_LEVEL = '../';

const DIST_FOLDER_NAME = 'dist';
const OUTPUT_FILE_NAME = 'build.txt';
const PKG_FILE_NAME = 'package.json';

// Computed constants
const distFolderLocation = path.join(__dirname, UPPER_LEVEL, DIST_FOLDER_NAME);
const pkgFileLocation = path.join(__dirname, UPPER_LEVEL, PKG_FILE_NAME);

// Read package.json
const pkg = JSON.parse(fs.readFileSync(pkgFileLocation, 'utf-8'));

if (!pkg.version) {
    throw new Error('Missing required field "version" in package.json');
}

const main = (): void => {
    const content = `version=${pkg.version}`;

    // Create the dist folder if it doesn't exist
    if (!fs.existsSync(distFolderLocation)) {
        fs.mkdirSync(distFolderLocation);
    }

    // Write the output file
    const file = path.resolve(distFolderLocation, OUTPUT_FILE_NAME);
    fs.writeFileSync(file, content);

    // eslint-disable-next-line no-console
    console.log(`Wrote ${content} to ${file} was successful`);
};

main();
