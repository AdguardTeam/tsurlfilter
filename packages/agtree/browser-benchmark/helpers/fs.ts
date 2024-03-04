import { access } from 'fs/promises';

export const pathExists = async (path: string): Promise<boolean> => {
    return Promise.resolve(access(path)
        .then(() => true)
        .catch(() => false));
};
