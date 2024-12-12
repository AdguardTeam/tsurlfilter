/* eslint-disable no-console */
import path from 'path';
import { createRequire } from 'module';

import { copy } from 'fs-extra';

const require = createRequire(import.meta.url);

const REDIRECTS_CONFIG_PATH = 'redirects.yml';
const REDIRECTS_RESOURCES_SRC_PATH = 'redirect-files';
const REDIRECTS_RESOURCES_DEST_PATH = 'redirects';

const src = path.resolve(require.resolve('@adguard/scriptlets'), '../..');

// TODO: use logger from lib after import fix
export const copyWar = async (dest: string): Promise<void> => {
    dest = path.resolve(process.cwd(), dest);

    try {
        await copy(path.resolve(src, REDIRECTS_CONFIG_PATH), path.resolve(dest, REDIRECTS_CONFIG_PATH));
        await copy(path.resolve(src, REDIRECTS_RESOURCES_SRC_PATH), path.resolve(dest, REDIRECTS_RESOURCES_DEST_PATH));

        console.info(`Web accessible resources was copied to ${dest}`);
    } catch (e) {
        console.error((e as Error).message);
    }
};
