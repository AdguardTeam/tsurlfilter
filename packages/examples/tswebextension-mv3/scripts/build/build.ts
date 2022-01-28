/* eslint-disable no-console */
import { buildRunner } from './build-runner';
import { config } from './webpack.config';

const build = async () => {
    try {
        await buildRunner(config);
    } catch (e) {
        console.log((e as Error).message);
        process.exit(1);
    }
};

export { build };
