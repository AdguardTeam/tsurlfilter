/* eslint-disable no-console */
import path from 'path';

import { copyWar, downloadCompaniesDb } from '@adguard/tswebextension/cli';
import { AssetsLoader, ManifestPatcher } from '@adguard/dnr-rulesets';

import {
    BUILD_PATH,
    BUILD_ZIP_FILE_NAME,
    WEB_ACCESSIBLE_RESOURCES_PATH,
    COMPANIES_DB_PATH,
} from '../constants';

import { buildRunner } from './build-runner';
import { config } from './webpack.config';
import { zipDirectory } from './zip-directory';

const build = async () => {
    try {
        const loader = new AssetsLoader();
        await loader.load('./extension/filters');
        const patcher = new ManifestPatcher();
        patcher.patch(
            './extension/manifest.json',
            './extension/filters',
            {
                forceUpdate: true,
                ids: ['2', '3'],
            },
        );
        await buildRunner(config);
        await copyWar(WEB_ACCESSIBLE_RESOURCES_PATH);
        await downloadCompaniesDb(COMPANIES_DB_PATH);
        await zipDirectory(BUILD_PATH, path.join(BUILD_PATH, '..', BUILD_ZIP_FILE_NAME));
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
};

export { build };
