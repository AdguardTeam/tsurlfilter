import path from 'node:path';

import { program } from 'commander';

import { version } from '../package.json';
import { AssetsLoader, ManifestPatcher, type PatchManifestOptions } from './lib';
import { AssetsLoaderOptions } from './lib/assets/loader';
import { Watcher, WatchOptions } from './lib/manifest/watch';
import { excludeUnsafeRules } from './lib/unsafe-rules/exclude-unsafe-rules';

const DEFAULT_PATH_TO_FILTERS = './filters';
const DEFAULT_OUTPUT_PATH_FOR_RULESETS = './filters/declarative';

/**
 * Helper function to process array options that might be:
 * - Already proper arrays (from space-separated args)
 * - Single comma-separated strings (e.g. "--ids 1,2,3")
 * - Single elements
 * - Undefined/null.
 *
 * @param option Option value from Commander.
 *
 * @returns Properly processed array.
 */
const processArrayOption = (option: unknown): string[] => {
    if (Array.isArray(option)) {
        // If it's already an array, process each item (they could be comma-separated strings)
        return option.flatMap((item) => {
            return typeof item === 'string' && item.includes(',')
                ? item.split(',').map((s) => s.trim())
                : item;
        });
    }

    if (typeof option === 'string') {
        // If it's a single string, split by commas
        return option.includes(',') ? option.split(',').map((s) => s.trim()) : [option];
    }

    return option ? [String(option)] : [];
};

/**
 * Extended type for correct type checking of WatchOptions in CLI.
 */
type WatchOptionsCli = WatchOptions & {
    /**
     * Path to filters directory.
     * This is used to download filters and metadata file from the server.
     */
    pathToFilters: string;

    /**
     * Path to resources directory.
     * This is used to save built DNR rulesets.
     */
    outputPathForRulesets: string;
};

program
    .name('dnr-rulesets CLI')
    .version(version);

program
    .command('exclude-unsafe-rules')
    .description('Exclude unsafe rules from rulesets and save them to metadata of rulesets')
    .argument('<dir>', 'Path to rulesets folder')
    .option('-j, --prettify-json <bool>', 'Prettify JSON output', false)
    .option('-l, --limit <number>', 'Limit the number of unsafe rules to exclude, on overflow will throw an error')
    .action(async (dir, options) => {
        try {
            console.log(`Excluding unsafe rules from: ${dir}`);
            await excludeUnsafeRules({ dir, ...options });
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    });

program
    .command('load')
    .description('Downloads rulesets for MV3 extension')
    .argument('<path-to-output>', 'rulesets download path')
    .option('-l, --latest-filters', 'download latest text filters instead of DNR rulesets', false)
    .action(async (dest: string, options?: AssetsLoaderOptions) => {
        const loader = new AssetsLoader();

        try {
            await loader.load(dest, options);
            console.info(`assets was copied to ${dest}`);
        } catch (e) {
            console.error(e);
        }
    });

/* eslint-disable max-len */
program
    .command('manifest')
    .description('Patch MV3 manifest file')
    .argument('<path-to-manifest>', 'manifest src path')
    .argument('<path-to-filters>', 'filters src path')
    .option('-f, --force-update', 'force update rulesets with existing id, otherwise it will throw error if ruleset is already in the manifest', false)
    .option('-i, --ids <ids...>', 'filters ids to process, others will be ignored, by default will process all filters matched via `--filters-match`', [])
    .option('-e, --enable <ids...>', 'enable filters by default in manifest.json (they will be enabled after enabling/reloading extension)', [])
    .option('-r, --ruleset-prefix <prefix>', 'prefix for filters ids', 'ruleset_')
    .option('-m, --filters-match <match>', 'filters files match glob pattern', 'filter_+([0-9]).txt')
    /* eslint-enable max-len */
    .action((
        manifestPath: string,
        filtersPath: string,
        options?: Partial<PatchManifestOptions>,
    ) => {
        // Process options to handle both space and comma-separated arrays
        const processedOptions = {
            ...options,
            ids: processArrayOption(options?.ids),
            enable: processArrayOption(options?.enable),
        };

        const patcher = new ManifestPatcher();
        patcher.patch(manifestPath, filtersPath, processedOptions);
    });

/* eslint-disable max-len */
program
    .command('watch')
    .description('Watch for changes in the filters directory and rebuild DNR rulesets')
    .argument('<path-to-manifest>', 'path to the manifest.json')
    .argument('<path-to-resources>', 'folder with resources to build $redirect rules (can be obtained via `@adguard/tswebextension war` command)')
    .option('-p, --path-to-filters', 'path to filters and i18n metadata file (default: `./filters` relative to manifest folder)', '')
    .option('-o, --output-path-for-rulesets', 'output path for rulesets (default: `./filters/declarative` relative to manifest folder)', '')
    .option('-f, --force-update', 'force update rulesets with existing id, otherwise it will throw error if ruleset is already in the manifest', true)
    .option('-i, --ids <ids...>', 'filters ids to process, others will be ignored, by default will process all filters matched via `--filters-match`', [])
    .option('-e, --enable <ids...>', 'enable filters by default in manifest.json (they will be enabled after enabling/reloading extension)', [])
    .option('-r, --ruleset-prefix <prefix>', 'prefix for filters ids', 'ruleset_')
    .option('-m, --filters-match <match>', 'filters files match glob pattern', ManifestPatcher.DEFAULT_FILTERS_MATCH_GLOB)
    .option('-l, --latest-filters', 'download latest text filters on first start before watch', false)
    .option('-d, --debug', 'enable extended logging during conversion or not', false)
    .option('-j, --prettify-json <bool>', 'Prettify JSON output for human readability', false)
    /* eslint-enable max-len */
    .action(async (
        manifestPath: string,
        resourcesPath: string,
        options?: Partial<WatchOptionsCli>,
    ) => {
        if (!manifestPath || !resourcesPath) {
            // eslint-disable-next-line max-len
            throw new Error(`Please provide all required arguments: manifestPath (provided: ${manifestPath}), resourcesPath (provided: ${resourcesPath})`);
        }

        // Process options to handle both space and comma-separated arrays
        const processedOptions = {
            ...options,
            ids: processArrayOption(options?.ids),
            enable: processArrayOption(options?.enable),
        };

        const defaultFiltersPath = path.resolve(path.dirname(manifestPath), DEFAULT_PATH_TO_FILTERS);
        const defaultDestRulesetsPath = path.resolve(path.dirname(manifestPath), DEFAULT_OUTPUT_PATH_FOR_RULESETS);

        const paths = {
            manifestPath,
            filtersPath: options?.pathToFilters || defaultFiltersPath,
            resourcesPath,
            destinationRulesetsPath: options?.outputPathForRulesets || defaultDestRulesetsPath,
        };

        const watcher = new Watcher();
        await watcher.watch(paths, processedOptions);
    });

program.parse(process.argv);
