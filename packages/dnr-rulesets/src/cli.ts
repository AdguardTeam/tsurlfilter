#!/usr/bin/env node
import { Logger } from '@adguard/logger';
import { program } from 'commander';

import { version } from '../package.json';
import { AssetsLoader, ManifestPatcher, type PatchManifestOptions } from './lib';

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
    .option('-i, --ids <ids...>', 'filters ids to append', [])
    .option('-e, --enable <ids...>', 'enable filters by default', [])
    .option('-r, --ruleset-prefix <prefix>', 'prefix for filters ids', 'ruleset_')
    .option('-m, --filters-match <match>', 'filters files match glob pattern', 'filter_+([0-9]).txt')
    .action((
        manifestPath: string,
        filtersPath: string,
        options?: Partial<PatchManifestOptions>,
    ) => {
        const patcher = new ManifestPatcher();
        patcher.patch(manifestPath, filtersPath, options);
    });

program.parse(process.argv);
