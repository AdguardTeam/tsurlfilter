#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';

import { program } from 'commander';

import { version } from '../../package.json';

import { copyWar } from './copyWar';

export const DEFAULT_WAR_PATH = 'build/war';

const CLI_NAME = 'tswebextension';

/**
 * Main entrypoint.
 */
async function main(): Promise<void> {
    program
        .name(CLI_NAME)
        .description('CLI to some development utils')
        .version(version);

    program
        .command('war')
        .description('Downloads web accessible resources for redirect rules')
        .argument('[path]', 'resources download path', DEFAULT_WAR_PATH)
        .action(copyWar);

    await program.parseAsync(process.argv);
}

const scriptFileName = path.basename(fileURLToPath(import.meta.url));
const processFileName = path.basename(process.argv[1]);

/**
 * Check if the script is executed directly (CLI mode).
 *
 * This works reliably because:
 * - When running via Node.js directly (e.g., `node cli.js`), `process.argv[1]`
 *   matches the script filename.
 * - When running via shebang (`#!/usr/bin/env node`), the script is directly
 *   invoked, thus matching filenames.
 * - When running via NPX (`npx package-name`), `process.argv[1]` points
 *   to the CLI script defined in "bin" of package.json.
 *
 * Using basename ensures the check is robust against differences in absolute
 * paths, symlinks, and installation methods.
 *
 * Check if the script is executed directly as CLI, with an additional safeguard:
 * - scriptFileName === processFileName: ensures it's directly executed (CLI).
 * - process.argv[1].includes(CLI_NAME): ensures it's specifically the intended CLI script,
 *   preventing accidental interception when used as an API inside other CLI tools.
 */
const isRunningViaCli = scriptFileName === processFileName && process.argv[1].includes(CLI_NAME);

if (isRunningViaCli) {
    main();
}

export { copyWar };
