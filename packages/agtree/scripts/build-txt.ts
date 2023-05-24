/**
 * @file Output the version number to a build.txt file
 */
import fs from 'fs';
import path from 'path';
import * as url from 'url';
import pkg from '../package.json' assert { type: 'json' };

const PATH = '../dist';
const FILENAME = 'build.txt';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

if (!pkg.version) {
    throw new Error('Missing required field "version" in package.json');
}

const main = (): void => {
    const content = `version=${pkg.version}`;
    const dir = path.resolve(__dirname, PATH);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    const file = path.resolve(dir, FILENAME);
    fs.writeFileSync(file, content);

    // eslint-disable-next-line no-console
    console.log(`Wrote ${content} to ${file} was successful`);
};

main();
