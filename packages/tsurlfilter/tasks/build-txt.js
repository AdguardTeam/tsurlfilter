/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/explicit-function-return-type */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = '../dist';
const FILENAME = 'build.txt';

const main = () => {
    const content = `version=${version}`;
    const dir = resolve(__dirname, PATH);

    if (!existsSync(dir)) {
        mkdirSync(dir);
    }

    writeFileSync(resolve(__dirname, PATH, FILENAME), content);
};

main();