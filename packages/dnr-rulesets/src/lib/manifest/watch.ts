#!/usr/bin/env node
/**
 * @file Watch task for track changes in the filters directory and rebuild DNR rulesets.
 */

import { convertFilters } from '@adguard/tsurlfilter/cli';
import { ChokidarOptions, type FSWatcher, watch } from 'chokidar';

import { startDownload } from '../../../common/filters-downloader';
import { ManifestPatcher, PatchManifestOptions } from './patcher';

export type WatchPaths = {
    /**
     * Path to manifest file.
     */
    manifestPath: string;

    /**
     * Path to filters directory.
     */
    filtersPath: string;

    /**
     * Path to resources directory.
     */
    resourcesPath: string;

    /**
     * Path to destination rulesets directory.
     */
    destinationRulesetsPath: string;
};

export type WatchOptions = PatchManifestOptions & {
    /**
     * Whether to download latest filters from the server before start watching
     * or not. It is useful for cases when you want to debug fresh filters.
     */
    latestFilters?: boolean;

    /**
     * Whether to enable extended logging during conversion or not.
     */
    debug?: boolean;

    /**
     * Defines whether to prettify the rulesets JSON or not.
     * Not prettifying can save on JSON size.
     */
    prettifyJson?: boolean;
};

/**
 * Watcher class for tracking changes in the filters directory and rebuilding
 * DNR rulesets.
 *
 * It listens for changes in the filters directory, rebuilds DNR rulesets,
 * and updates the manifest file accordingly.
 */
export class Watcher {
    /**
     * Mutex to prevent multiple rebuilds at the same time.
     */
    private mutex: boolean = false;

    /**
     * Rebuilds DNR rulesets from the filtersPath and writes metadata
     * to the destinationRulesetsPath.
     *
     * @param paths Object containing paths to filters, resources and destination rulesets.
     * @param paths.filtersPath Path to filters directory.
     * @param paths.resourcesPath Path to resources directory.
     * @param paths.destinationRulesetsPath Path to destination rulesets directory.
     * @param debug Whether to enable debug logging or not.
     * @param prettifyJson Whether to prettify JSON output or not.
     */
    private rebuildDnrRulesets = async (
        { filtersPath, resourcesPath, destinationRulesetsPath }: WatchPaths,
        debug: boolean = false,
        prettifyJson: boolean = false,
    ): Promise<void> => {
        console.log('Rebuilding DNR rulesets...');

        await convertFilters(
            filtersPath,
            resourcesPath,
            destinationRulesetsPath,
            {
                debug,
                prettifyJson,
            },
        );
    };

    /**
     * Watch for changes in the filtersPath, rebuild DNR rulesets and update manifest.
     *
     * @param paths Object containing paths to manifest, filters, resources and destination rulesets.
     * @param paths.manifestPath Path to manifest file.
     * @param paths.filtersPath Path to filters directory.
     * @param paths.resourcesPath Path to resources directory.
     * @param paths.destinationRulesetsPath Path to destination rulesets directory.
     * @param options Patch options {@link PatchManifestOptions}.
     */
    private filtersChangesListener = async (
        paths: WatchPaths,
        options?: Partial<WatchOptions>,
    ): Promise<void> => {
        const { manifestPath, filtersPath } = paths;

        await this.rebuildDnrRulesets(paths, options?.debug, options?.prettifyJson);

        const patcher = new ManifestPatcher();
        patcher.patch(manifestPath, filtersPath, options);
    };

    /**
     * Watch for changes in the filtersPath, rebuild DNR rulesets and update manifest.
     *
     * @param paths Object containing paths to manifest, filters, resources and destination rulesets.
     * @param paths.manifestPath Path to manifest file.
     * @param paths.filtersPath Path to filters directory and metadata file.
     * @param paths.resourcesPath Path to resources directory.
     * @param paths.destinationRulesetsPath Path to destination rulesets directory.
     * @param options Patch options {@link PatchManifestOptions}.
     */
    public watch = async (
        paths: WatchPaths,
        options?: Partial<WatchOptions>,
    ): Promise<void> => {
        const { filtersPath } = paths;

        if (options?.latestFilters) {
            console.log(`Downloading filters from the server to ${filtersPath}...`);
            await startDownload(filtersPath);
            console.log(`Downloading filters from the server to ${filtersPath} is done.`);
        }

        // eslint-disable-next-line prefer-const
        let watcher: FSWatcher | undefined;

        // Stop watching when the process is terminated
        process.on('SIGINT', async () => {
            console.log('Stopping watch...');
            if (watcher) {
                await watcher.close();
            }
            process.exit(0);
        });

        // Stop watching when the process is terminated
        process.on('SIGTERM', async () => {
            console.log('Stopping watch...');
            if (watcher) {
                await watcher.close();
            }
            process.exit(0);
        });

        console.log(`Watching for changes in ${filtersPath}...`);
        console.log('Press Ctrl+C (or Cmd+C) to stop watching.');

        const listener = async (path: string) => {
            console.log('Change detected in path:', path);

            if (this.mutex) {
                console.warn('Change ignored due to ongoing processing.');
                // If mutex is true, it means that we are already processing a change.
                // So we skip this change to prevent infinite loop.
                return;
            }

            this.mutex = true;

            try {
                await this.filtersChangesListener(
                    paths,
                    options,
                );
            } catch (error) {
                console.error('Error processing filter changes:', error);
            } finally {
                // Reset mutex after processing the change, even if there was an error
                this.mutex = false;
            }
        };

        const watcherOptions: ChokidarOptions = {
            // Watch only .txt files
            ignored: (path, stats) => !!stats?.isFile() && !path.endsWith('.txt'),
            ignoreInitial: true,
        };

        // Watch for changes in the filters directory and rebuild DNR rulesets
        watcher = watch(filtersPath, watcherOptions)
            .on('add', listener)
            .on('change', listener);
    };
}
