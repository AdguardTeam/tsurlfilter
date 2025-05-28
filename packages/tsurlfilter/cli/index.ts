import { program } from 'commander';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { convertFilters } from './convertFilters';
import { version } from '../package.json';

export const DEFAULT_DEST_RULE_SETS_DIR = './build/rulesets';

/**
 * Main function to set up and run the CLI program.
 */
async function main() {
    program
        .name('tsurlfilter')
        .description('CLI to convert filters to declarative rulesets')
        .version(version);

    program
        .command('convert')
        .description('Converts filters to declarative rule sets')
        .argument('<filters_dir>', 'Path to filters to convert')
        .argument('<resources_dir>', 'Path to web accessible resources')
        .argument('[dest_rule_sets_dir]', 'Destination path for rule sets', DEFAULT_DEST_RULE_SETS_DIR)
        .option('--debug', 'Enable debug mode', false)
        .option('--prettify-json', 'Prettify JSON output', true)
        .action(async (filtersDir, resourcesDir, destRulesetsDir, options) => {
            await convertFilters(filtersDir, resourcesDir, destRulesetsDir, {
                debug: options.debug,
                prettifyJson: options.prettifyJson,
            });
        });

    await program.parseAsync(process.argv);
}

// FIXME: Describe in changelogs
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
 */
const isRunningViaCli = scriptFileName === processFileName;

if (isRunningViaCli) {
    main();
}

export { convertFilters };
