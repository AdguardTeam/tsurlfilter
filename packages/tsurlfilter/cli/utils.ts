import fs from 'node:fs';
import path from 'node:path';

/**
 * Ensures that the directory exists, creating it if it does not.
 *
 * @param dirPath Path to the directory to ensure.
 */
export const ensureDirSync = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
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
) => {
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
            // Use concat but not push with spread to prevent stack overflow.
            fileList = fileList.concat(foundFiles);
        } else if (filter(filePath)) {
            fileList = fileList.concat([filePath]);
        }
    }

    return fileList;
};
