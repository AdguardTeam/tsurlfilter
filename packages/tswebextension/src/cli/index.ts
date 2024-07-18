#!/usr/bin/env node
import { program } from 'commander';

import { copyWar } from './copyWar';
import { downloadCompaniesDb } from './donwloadCompaniesDb';

export const DEFAULT_WAR_PATH = 'build/war';
export const DEFAULT_COMPANIES_DB_PATH = 'build/trackers.json';

/**
 * Main entrypoint.
 */
async function main(): Promise<void> {
    program
        .name('tswebextension')
        .description('CLI to some development utils')
        .version('0.0.1');

    program
        .command('war')
        .description('Downloads web accessible resources for redirect rules')
        .argument('[path]', 'resources download path', DEFAULT_WAR_PATH)
        .action(copyWar);

    program
        .command('companies')
        .description('Downloads companies database from AdguardTeam/companiesdb repository')
        .argument('[path]', 'companiesDB download path', DEFAULT_COMPANIES_DB_PATH)
        .action(downloadCompaniesDb);

    await program.parseAsync(process.argv);
}

const isRunningViaCli = require.main === module;

if (isRunningViaCli) {
    main();
}

export { copyWar, downloadCompaniesDb };
