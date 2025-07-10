/* eslint-disable no-console */
import { program } from 'commander';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { convertFilters, LOCAL_METADATA_FILE_NAME } from './convertFilters';
import { version } from '../package.json';
import { Extractor } from './extractFilters';
import { generateMD5Hash } from '../src/utils/checksum';

export const DEFAULT_DEST_RULE_SETS_DIR = './build/rulesets';

const CLI_NAME = 'tsurlfilter';

const parseBool = (v: string) => /^true|1|yes|on$/i.test(v);

/**
 * Main function to set up and run the CLI program.
 */
async function main() {
    program
        .name(CLI_NAME)
        .description('CLI to convert filters to declarative rulesets')
        .version(version);

    program
        .command('convert')
        .description('Converts filters to declarative rulesets')
        // eslint-disable-next-line max-len
        .argument('<filters_and_metadata_dir>', `Path to filters and their metadata with name "${LOCAL_METADATA_FILE_NAME}" to convert`)
        .argument('<resources_dir>', 'Path to web accessible resources')
        .argument('[dest_rule_sets_dir]', 'Destination path for rulesets', DEFAULT_DEST_RULE_SETS_DIR)
        .option('--debug', 'Enable debug mode', false)
        // parseBool is needed since commander.js treats boolean options as strings
        .option('--prettify-json <bool>', 'Prettify JSON output', parseBool, true)
        // eslint-disable-next-line max-len
        .option('--additional-properties <json>', 'Additional properties to include in metadata ruleset as JSON string', '{}')
        .action(async (filtersAndMetadataDir, resourcesDir, destRulesetsDir, options) => {
            await convertFilters(filtersAndMetadataDir, resourcesDir, destRulesetsDir, {
                debug: options.debug,
                prettifyJson: options.prettifyJson,
                additionalProperties: JSON.parse(options.additionalProperties),
            });
        });

    program
        .command('extract-filters')
        .description('Extracts filters from converted declarative rulesets')
        .argument('<path-to-rulesets>', 'path to the rulesets directory')
        .argument('<path-to-output>', 'path to save extracted filters')
        .action(async (
            rulesetsPath: string,
            outputPath: string,
        ) => {
            try {
                await Extractor.extract(rulesetsPath, outputPath);
                console.log(`Filters extracted to ${outputPath}`);
            } catch (error) {
                console.error('Error extracting filters:', error);
            }
        });

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

// For API-like usage, we export the convertFilters function.
export { convertFilters, generateMD5Hash };
