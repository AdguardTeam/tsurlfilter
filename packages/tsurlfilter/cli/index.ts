#!/usr/bin/env node
import { program } from 'commander';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { convertFilters } from './convertFilters';
import { version } from '../package.json';

export const DEFAULT_DEST_RULE_SETS_DIR = 'build/ruleSets';

/**
 * Main function to set up and run the CLI program.
 */
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

const modulePath = path.resolve(fileURLToPath(import.meta.url));
const procArgPath = path.resolve(process.argv[1]);
const isRunningViaCli = modulePath === procArgPath;

if (isRunningViaCli) {
    main();
}

export { convertFilters };
