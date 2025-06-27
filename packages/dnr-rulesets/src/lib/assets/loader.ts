import { copy } from 'fs-extra';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import { startDownload } from '../../../common/filters-downloader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type AssetsLoaderOptions = {
    /**
     * Whether to download latest text filters instead of DNR rulesets.
     */
    latestFilters?: boolean;
};

/**
 * Api for loading assets.
 *
 */
export class AssetsLoader {
    /**
     * Download rulesets or filters to {@link dest} path. If {@link options.rawFilters}
     * is set to `true`, it will only download raw filters from the server,
     * otherwise it will copy rulesets from the local directory.
     *
     * @param dest Path to download assets.
     * @param options Options for loading assets.
     *
     * @returns Promise that resolves when assets are downloaded.
     */
    public async load(dest: string, options?: AssetsLoaderOptions): Promise<void> {
        const to = path.resolve(process.cwd(), dest);

        if (options?.latestFilters) {
            await startDownload(to);
            return;
        }

        const src = path.resolve(__dirname, '../filters');

        console.log(`Copying rulesets from ${src} to ${to}`);

        await copy(src, to);

        console.log(`Copying rulesets from ${src} to ${to} done.`);
    }
}
