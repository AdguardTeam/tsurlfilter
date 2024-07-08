#!/usr/bin/env node
import { program } from 'commander';

import { version } from '../package.json';

import { convertFilters } from './convertFilters';

export const DEFAULT_DEST_RULE_SETS_DIR = 'build/ruleSets';

async function main() {
    program
        .name('tsurlfilter')
        .description('CLI to convert filters to declarative rule sets')
        .version(version);

    program
        .command('convert')
        .description('Converts filters to declarative rule sets')
        .argument('<filters_dir>', 'Path to filters to convert')
        .argument('<resources_dir>', 'Path to web accessible resources')
        .argument('[dest_rule_sets_dir]', 'Destination path for rule sets', DEFAULT_DEST_RULE_SETS_DIR)
        .option('--debug', 'Enable debug mode', false)
        .option('--prettify-json', 'Prettify JSON output', true)
        .action((filtersDir, resourcesDir, destRuleSetsDir, options) => {
            convertFilters(filtersDir, resourcesDir, destRuleSetsDir, {
                debug: options.debug,
                prettifyJson: options.prettifyJson,
            });
        });

    await program.parseAsync(process.argv);
}

const isRunningViaCli = require.main === module;

if (isRunningViaCli) {
    main();
}

export { convertFilters };
