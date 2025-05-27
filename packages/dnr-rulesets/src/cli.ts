import { Logger } from '@adguard/logger';
import { program } from 'commander';

import { version } from '../package.json';
import {
    AssetsLoader,
    ManifestPatcher,
    type PatchManifestOptions,
} from './lib';
import { Watcher } from './lib/manifest/watch';

/**
 * Helper function to process array options that might be:
 * - Already proper arrays (from space-separated args)
 * - Single comma-separated strings (e.g. "--ids 1,2,3")
 * - Single elements
 * - Undefined/null
 *
 * @param option Option value from Commander.
 *
 * @returns Properly processed array
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

program
    .name('dnr-rulesets CLI')
    .version(version);

program
    .command('load')
    .description('Downloads rule sets for MV3 extension')
    .argument('[path-to-output]', 'rule sets download path')
    .action(async (dest: string) => {
        const logger = new Logger();
        const loader = new AssetsLoader();

        try {
            await loader.load(dest);
            logger.info(`assets was copied to ${dest}`);
        } catch (e) {
            logger.error(e);
        }
    });

program
    .command('manifest')
    .description('Patch MV3 manifest file')
    .argument('[path-to-manifest]', 'manifest src path')
    .argument('[path-to-filters]', 'filters src path')
    .option('-f, --force-update', 'force update rulesets with existing id', false)
    .option('-i, --ids <ids...>', 'filters ids to append, others will be ignored', [])
    .option('-e, --enable <ids...>', 'enable filters by default', [])
    .option('-r, --ruleset-prefix <prefix>', 'prefix for filters ids', 'ruleset_')
    .option('-m, --filters-match <match>', 'filters files match glob pattern', 'filter_+([0-9]).txt')
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

program
    .command('watch')
    .description('Watch for changes in the filters directory and rebuild DNR rulesets')
    .argument('[path-to-manifest]', 'manifest src path')
    .argument('[path-to-filters]', 'filters src path and i18n metadata file')
    .argument('[path-to-resources]', 'folder with resources to build $redirect rules. Note: this folder can be copied via `@adguard/tswebextension war` command')
    .argument('[destination-path-to-rulesets]', 'destination path to rulesets')
    .option('-f, --force-update', 'force update rulesets with existing id', false)
    .option('-i, --ids <ids...>', 'filters ids to append, others will be ignored', [])
    .option('-e, --enable <ids...>', 'enable filters by default', [])
    .option('-r, --ruleset-prefix <prefix>', 'prefix for filters ids', 'ruleset_')
    .option('-m, --filters-match <match>', 'filters files match glob pattern', 'filter_+([0-9]).txt')
    .option('-d, --download', 'download filters on first start before watch', false)
    .action((
        manifestPath: string,
        filtersPath: string,
        resourcesPath: string,
        destinationRulesetsPath: string,
        options?: Partial<PatchManifestOptions>,
    ) => {
        if (!manifestPath || !filtersPath || !resourcesPath || !destinationRulesetsPath) {
            throw new Error(`Please provide all required arguments: manifestPath (provided: ${manifestPath}), filtersPath (provided: ${filtersPath}), resourcesPath (provided: ${resourcesPath}), destinationRulesetsPath (provided: ${destinationRulesetsPath})`);
        }

        // Process options to handle both space and comma-separated arrays
        const processedOptions = {
            ...options,
            ids: processArrayOption(options?.ids),
            enable: processArrayOption(options?.enable),
        };

        const paths = {
            manifestPath,
            filtersPath,
            resourcesPath,
            destinationRulesetsPath,
        };

        const watcher = new Watcher();
        watcher.watch(paths, processedOptions);
    });

program.parse(process.argv);
