import { convertFilters } from '@adguard/tsurlfilter/cli';
import fs from 'fs';
import path from 'path';

import {
    BASE_DIR,
    DEST_RULESETS_DIR,
    FILTERS_DIR,
    RESOURCES_DIR,
} from '../common/constants';
import { startDownload } from '../common/filters-downloader';
import { version } from '../package.json';

/**
 * Creates build.txt file with package version.
 *
 * @returns Promise that resolves when build.txt is created.
 */
const createTxt = async (): Promise<void> => {
    return fs.promises.writeFile(
        path.join(BASE_DIR, 'build.txt'),
        `version=${version}`,
    );
};

/**
 * Removes all txt files from the specified directory.
 * Used as a cleanup step after filters conversion to remove unnecessary txt files.
 *
 * @param dir Directory with txt files.
 *
 * @returns Promise that resolves when all txt files are removed.
 */
const removeTxtFiles = async (dir: string): Promise<void> => {
    const files = await fs.promises.readdir(dir);
    const txtFiles = files.filter((file) => file.endsWith('.txt'));

    await Promise.all(
        txtFiles.map((file) => fs.promises.unlink(path.join(dir, file))),
    );
};

/**
 * Compiles rules to declarative json
 * Actually for each rule set entry in manifest's declarative_net_request:
 *
 * "declarative_net_request": {
 *   "rule_resources": [{
 *     "id": "ruleset_1",
 *     "enabled": true,
 *     "path": "filters/declarative/rules.json"
 *   }]
 * }.
 *
 * We should find corresponding text file in resources,
 * and then convert and save json to path specified in the manifest.
 */
const build = async (): Promise<void> => {
    await startDownload();

    await convertFilters(
        FILTERS_DIR,
        RESOURCES_DIR,
        DEST_RULESETS_DIR,
        {
            debug: true,
            prettifyJson: false,
        },
    );

    await removeTxtFiles(FILTERS_DIR);

    await createTxt();
};

build();
