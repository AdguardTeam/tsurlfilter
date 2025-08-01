import { convertFilters } from '@adguard/tsurlfilter/cli';
import fs from 'fs';
import path from 'path';

import {
    BASE_DIR,
    BrowserFilters,
    DEST_RULESETS_DIR,
    FILTERS_BROWSER_STUB,
    FILTERS_DIR,
    LOCAL_METADATA_FILE_NAME,
    RESOURCES_DIR,
} from '../common/constants';
import { startDownload } from '../common/filters-downloader';
import { version } from '../package.json';
import { getVersion, getVersionTimestampMs } from '../src/utils/version-utils';

/**
 * Creates build.txt file with package version.
 *
 * @returns Promise that resolves when build.txt is created.
 */
const createVersionTxt = async (): Promise<void> => {
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
 * Removes filters metadata file from the specified directory.
 * This file is generated during the conversion process and is not needed
 * after that.
 *
 * @param dir Directory where the filters metadata file is located.
 */
const removeFiltersMetadata = async (dir: string): Promise<void> => {
    const filtersMetadataPath = path.join(dir, LOCAL_METADATA_FILE_NAME);

    if (fs.existsSync(filtersMetadataPath)) {
        await fs.promises.unlink(filtersMetadataPath);
    }
};

/**
 * Compiles rules to declarative json
 * Actually for each rule set entry in manifest's declarative_net_request.
 *
 * ```json
 * "declarative_net_request": {
 *   "rule_resources": [{
 *     "id": "ruleset_1",
 *     "enabled": true,
 *     "path": "filters/declarative/rules.json"
 *   }]
 * }
 * ```
 *
 * We should find corresponding text file in resources,
 * and then convert and save json to path specified in the manifest.
 *
 * @param browser Browser to build filters for.
 */
const build = async (browser: BrowserFilters): Promise<void> => {
    const filtersDir = FILTERS_DIR.replace(FILTERS_BROWSER_STUB, browser);
    const destRulesetsDir = DEST_RULESETS_DIR.replace(FILTERS_BROWSER_STUB, browser);

    await startDownload(filtersDir, browser);

    await convertFilters(
        filtersDir,
        RESOURCES_DIR,
        destRulesetsDir,
        {
            debug: true,
            prettifyJson: false,
            additionalProperties: {
                version: getVersion(),
                versionTimestampMs: getVersionTimestampMs(),
            },
        },
    );

    await removeTxtFiles(filtersDir);

    // After single conversion, do not forget to remove filters.json file,
    // since it is packed inside metadata ruleset.
    await removeFiltersMetadata(filtersDir);
};

/**
 * Builds all filters for all browsers.
 */
const buildAll = async (): Promise<void> => {
    await build(BrowserFilters.ChromiumMV3);
    await build(BrowserFilters.Opera);
    await createVersionTxt();
};

buildAll();
