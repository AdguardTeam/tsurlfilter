#!/usr/bin/env node
import { program } from 'commander';

import { version } from '../../package.json';

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
        .argument('<filters_dir>', 'path to filters to convert')
        .argument('<resources_dir>', 'path to web accessible resources')
        .argument('[dest_rule_sets_dir]', 'destination path for rule sets', DEFAULT_DEST_RULE_SETS_DIR)
        .argument('[debug]', 'debug mode', false)
        .action(convertFilters);

    await program.parseAsync(process.argv);
}

const isRunningViaCli = require.main === module;

if (isRunningViaCli) {
    main();
}

export { convertFilters };
