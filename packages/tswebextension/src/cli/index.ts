#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';

import { program } from 'commander';

import { copyWar } from './copyWar';

export const DEFAULT_WAR_PATH = 'build/war';

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

    await program.parseAsync(process.argv);
}

const currentFilePath = fileURLToPath(import.meta.url);
const isRunningViaCli = path.resolve(process.argv[1]) === path.resolve(currentFilePath);

if (isRunningViaCli) {
    main();
}

export { copyWar };
