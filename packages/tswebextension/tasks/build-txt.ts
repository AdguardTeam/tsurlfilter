import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import packageJson from '../package.json';

const { version } = packageJson;

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const PATH = '../dist';
const FILENAME = 'build.txt';

const main = (): void => {
    const content = `version=${version}`;
    const dir = path.resolve(__dirname, PATH);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    fs.writeFileSync(path.resolve(__dirname, PATH, FILENAME), content);
};

main();
