/**
 * @file Script to generate compatibility tables to `dist/compatibility-tables.json`.
 * During development, we load the compatibility tables from YAML files directly,
 * but in the production build, we load them from this JSON file.
 */

import { writeFile } from 'fs/promises';
import { ensureDir } from 'fs-extra';
import path from 'path';

import * as data from '../src/compatibility-tables/compatibility-table-data';

const DIST_FOLDER_NAME = 'dist';
const OUTPUT_FILE_NAME = 'compatibility-table-data.json';

/**
 * Main function.
 */
const main = async (): Promise<void> => {
    const outDir = path.join(__dirname, `../${DIST_FOLDER_NAME}`);
    const outFile = path.join(outDir, OUTPUT_FILE_NAME);

    await ensureDir(outDir);
    await writeFile(outFile, JSON.stringify(data, null, 2));

    console.log(`Compatibility tables have been saved to ${outFile}`);
};

main();
