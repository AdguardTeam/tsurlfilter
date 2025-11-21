/* eslint-disable no-console */
import fs from 'fs/promises';
import path from 'path';

import { LocalScriptRulesJson } from '@adguard/api';
import { copyWar } from '@adguard/tswebextension/cli';

import { extraScripts } from '../../extension/src/extra-scripts';
import { buildRunner } from './build-runner';
import { config } from './webpack.config';
import { BUILD_PATH, BUILD_ZIP_FILE_NAME, WEB_ACCESSIBLE_RESOURCES_PATH } from '../constants';
import { zipDirectory } from './zip-directory';

const build = async () => {
    try {
        // Generate local_script_rules.json for MV2 (for Firefox AMO compliance)
        const filtersDir = './extension/filters';
        const localScriptRulesPath = path.join(filtersDir, LocalScriptRulesJson.fileName);

        // Generate local_script_rules.json from extra scripts
        const localScriptRulesJson = new LocalScriptRulesJson();
        const scriptRules = localScriptRulesJson.parse(extraScripts);
        const jsonContent = localScriptRulesJson.serialize(scriptRules);

        // Write to file
        await fs.writeFile(localScriptRulesPath, jsonContent);
        console.log(`Generated ${localScriptRulesPath} with ${scriptRules.size} rules`);

        await buildRunner(config);
        await copyWar(WEB_ACCESSIBLE_RESOURCES_PATH);
        await zipDirectory(BUILD_PATH, path.join(BUILD_PATH, '..', BUILD_ZIP_FILE_NAME));
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

export { build };
