import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export {
    getRulesetId,
    getRulesetPath,
    extractRulesetId,
    RULESET_FILE_EXT,
} from '../src/utils/ruleset-utils';

const FILTER_PREFIX = 'filter_';

/**
 * Generates an MD5 hash from a given input string.
 *
 * @param input The input string to be hashed.
 *
 * @returns The MD5 hash of the input string in hexadecimal format.
 */
export function generateMD5Hash(input: string): string {
    return createHash('md5').update(input).digest('hex');
}

/**
 * Extracts the filter ID from a given filter name.
 *
 * @param filterName The filter name in the format `filter_{filterId}.txt`.
 *
 * @returns The extracted filter ID, or null if the filter name does not match
 * the expected format.
 */
export const getIdFromFilterName = (filterName: string): number | null => {
    const match = filterName.match(new RegExp(`${FILTER_PREFIX}(\\d+)\\.txt`));
    if (!match) {
        return null;
    }

    return parseInt(match[1], 10);
};

/**
 * Ensures that the directory exists, creating it if it does not.
 *
 * @param dirPath Path to the directory to ensure.
 */
export const ensureDir = async (dirPath: string): Promise<void> => {
    await fs.promises.mkdir(dirPath, { recursive: true });
};

/**
 * Recursively finds files in a directory that match the provided filter.
 *
 * @param dir The directory to search in.
 * @param filter A filter function to determine if a file should be included.
 *
 * @returns An array of file paths that match the filter.
 */
export const findFiles = async (
    dir: string,
    filter: (s: string) => boolean,
): Promise<string[]> => {
    const files = await fs.promises.readdir(dir);
    let fileList: string[] = [];

    for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const filePath = path.join(dir, file);
        // eslint-disable-next-line no-await-in-loop
        const stat = await fs.promises.stat(filePath);

        if (stat.isDirectory()) {
            // eslint-disable-next-line no-await-in-loop
            const foundFiles = await findFiles(filePath, filter);
            fileList = fileList.concat(foundFiles);
        } else if (filter(filePath)) {
            fileList = fileList.concat([filePath]);
        }
    }

    return fileList;
};
