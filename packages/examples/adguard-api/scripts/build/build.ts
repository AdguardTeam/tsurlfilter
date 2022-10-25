/* eslint-disable no-console */
import { copyWar, DEFAULT_WAR_PATH } from "@adguard/tswebextension/cli";
import { buildRunner } from "./build-runner";
import { config } from "./webpack.config";

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
