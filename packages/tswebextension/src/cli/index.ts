#!/usr/bin/env node
import { program } from 'commander';

import { copyWar } from './copyWar';

program
    .name('tswebextension-utils')
    .description('CLI to some development utils')
    .version('0.0.1');


async function main() {
    program
        .command('war')
        .description('Downloads web accessible resources for redirect rules')
        .argument('[path]', 'resources download path', 'build/war')
        .action(copyWar);

    await program.parseAsync(process.argv);
}

main();
