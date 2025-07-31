import {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const PATH = '../dist';
const FILENAME = 'build.txt';

const main = () => {
    const { version } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
    const content = `version=${version}`;
    const dir = resolve(__dirname, PATH);

    if (!existsSync(dir)) {
        mkdirSync(dir);
    }

    writeFileSync(resolve(__dirname, PATH, FILENAME), content);
};

main();
