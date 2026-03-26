/**
 * @file File system helper functions.
 */

import { access } from 'fs/promises';

/**
 * Check if a path exists.
 *
 * @param path The path to check.
 *
 * @returns True if the path exists, false otherwise.
 */
export const pathExists = async (path: string): Promise<boolean> => {
    return Promise.resolve(access(path)
        .then(() => true)
        .catch(() => false));
};
