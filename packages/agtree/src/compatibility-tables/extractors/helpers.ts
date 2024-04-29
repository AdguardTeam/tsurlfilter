/* eslint-disable no-bitwise */
import { readdir } from 'fs/promises';

export const getYmlFilesFromDir = async (dir: string): Promise<string[]> => {
    const dirEntries = await readdir(dir, { withFileTypes: true });

    return dirEntries
        .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.yml'))
        .map((dirent) => dirent.name);
};

export const getActiveBitSlots = (n: number): number[] => {
    const result = [];

    for (let i = 0; i < 32; i += 1) {
        const p = n & (1 << i);
        if (p) {
            result.push(p);
        }
    }

    return result;
};
