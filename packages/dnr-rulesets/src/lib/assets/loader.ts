import { copy } from 'fs-extra';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Api for loading assets.
 */
export class AssetsLoader {
    /**
     * Download filters to {@link dest} path.
     *
     * @param dest Path to download filters.
     *
     * @returns Promise that resolves when filters are downloaded.
     */
    public async load(dest: string): Promise<void> {
        const to = path.resolve(process.cwd(), dest);
        const src = path.resolve(__dirname, '../../filters');

        return copy(src, to);
    }
}
