#!/usr/bin/env node
import { program } from 'commander';

import { copyWar } from './copyWar';

export const DEFAULT_WAR_PATH = 'build/war';

async function main() {
    program
        .name('tswebextension')
        .description('CLI to some development utils')
        .version('0.0.1');

    program
        .command('war')
        .description('Downloads web accessible resources for redirect rules')
        .argument('[path]', 'resources download path', DEFAULT_WAR_PATH)
        .action(copyWar);

    await program.parseAsync(process.argv);
}

const isRunningViaCli = require.main === module;

if (isRunningViaCli) {
    main();
}

export { copyWar };
