/* eslint-disable no-console */
import path from 'path';
import { fileURLToPath } from 'node:url';

import { copy } from 'fs-extra';

const REDIRECTS_CONFIG_PATH = 'redirects.yml';
const REDIRECTS_RESOURCES_SRC_PATH = 'redirect-files';
const REDIRECTS_RESOURCES_DEST_PATH = 'redirects';

/**
 * Resolves path to scriptlets package.
 *
 * @returns The directory path of the scriptlets package.
 */
const resolveScriptletsPath = async (): Promise<string> => {
    const scriptletsPath = import.meta.resolve('@adguard/scriptlets');
    return path.dirname(fileURLToPath(scriptletsPath));
};

// TODO: use logger from lib after import fix
/**
 * Copies web accessible resources to the specified destination.
 *
 * @param dest - The destination directory path.
 */
export const copyWar = async (dest: string): Promise<void> => {
    const src = await resolveScriptletsPath();

    dest = path.resolve(process.cwd(), dest);

    try {
        await copy(path.resolve(src, REDIRECTS_CONFIG_PATH), path.resolve(dest, REDIRECTS_CONFIG_PATH));
        await copy(path.resolve(src, REDIRECTS_RESOURCES_SRC_PATH), path.resolve(dest, REDIRECTS_RESOURCES_DEST_PATH));

        console.info(`Web accessible resources was copied to ${dest}`);
    } catch (e) {
        console.error(`Failed to copy web accessible resources: ${(e as Error).message}`);
        throw e;
    }
};
