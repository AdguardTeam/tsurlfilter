import path from 'path';

import { AssetsLoader, ManifestPatcher, LOCAL_SCRIPT_RULES_JS_FILENAME } from '@adguard/dnr-rulesets';
import { copyWar } from '@adguard/tswebextension/cli';

import { BUILD_PATH, BUILD_ZIP_FILE_NAME, WEB_ACCESSIBLE_RESOURCES_PATH } from '../constants';
import { extraScripts } from '../../extension/src/extra-scripts';
import { buildRunner } from './build-runner';
import { config } from './webpack.config';
import { zipDirectory } from './zip-directory';

const build = async () => {
    try {
        const loader = new AssetsLoader();
        await loader.load('./extension/filters');
        await loader.extendLocalScriptRulesJs(
            path.join('./extension/filters', LOCAL_SCRIPT_RULES_JS_FILENAME),
            extraScripts,
        );
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
        await zipDirectory(BUILD_PATH, path.join(BUILD_PATH, '..', BUILD_ZIP_FILE_NAME));
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e);
        process.exit(1);
    }
};

export { build };
