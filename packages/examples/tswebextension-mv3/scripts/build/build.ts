/* eslint-disable no-console */
import { buildRunner } from './build-runner';
import { config } from './webpack.config';
import { copyWar, DEFAULT_WAR_PATH } from '@adguard/tswebextension/cli';

const build = async () => {
    try {
        await buildRunner(config);
        await copyWar(DEFAULT_WAR_PATH);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
};

export { build };
