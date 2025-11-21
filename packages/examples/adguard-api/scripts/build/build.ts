/* eslint-disable no-console */
import { copyWar } from '@adguard/tswebextension/cli';
import path from 'path';
import { buildRunner } from './build-runner';
import { config } from './webpack.config';
import { BUILD_PATH, BUILD_ZIP_FILE_NAME, WEB_ACCESSIBLE_RESOURCES_PATH } from '../constants';
import { zipDirectory } from './zip-directory';

const build = async () => {
    try {
        await buildRunner(config);
        await copyWar(WEB_ACCESSIBLE_RESOURCES_PATH);
        await zipDirectory(BUILD_PATH, path.join(BUILD_PATH, '..', BUILD_ZIP_FILE_NAME));
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

export { build };
