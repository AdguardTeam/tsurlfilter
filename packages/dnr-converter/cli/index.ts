/* eslint-disable no-console */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { program } from 'commander';

import { DNR_CONVERTER_VERSION } from '../src/index';

import { convertFilters, LOCAL_METADATA_FILE_NAME } from './convert-filters';
import { Extractor } from './extract-filters';
import {
    extractRulesetId,
    generateMD5Hash,
    getIdFromFilterName,
    getRulesetId,
    getRulesetPath,
    RULESET_FILE_EXT,
} from './utils';

export const DEFAULT_DEST_RULESETS_DIR = './build/rulesets';

const CLI_NAME = 'dnr-converter';

const parseBool = (v: string) => /^(true|1|yes|on)$/i.test(v);

/**
 * Main function to set up and run the CLI program.
 */
async function main() {
    program
        .name(CLI_NAME)
        .description('CLI to convert filters to declarative rulesets')
        .version(DNR_CONVERTER_VERSION);

    program
        .command('convert')
        .description('Converts filters to declarative rulesets')
        // eslint-disable-next-line max-len
        .argument('<filters_and_metadata_dir>', `Path to filters and their metadata with name "${LOCAL_METADATA_FILE_NAME}" to convert`)
        .argument('<resources_dir>', 'Path to web accessible resources')
        .argument('[dest_rule_sets_dir]', 'Destination path for rulesets', DEFAULT_DEST_RULESETS_DIR)
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
                process.exitCode = 1;
            }
        });

    await program.parseAsync(process.argv);
}

// Compute the script filename safely.
//
// `fileURLToPath(import.meta.url)` can throw when the module is imported in a
// non-file:// context (e.g. in test runners that use the jsdom environment,
// where Rollup's `import.meta.url` polyfill resolves to an http(s) URL). In such
// cases the module is being used as a library, not run as a CLI, so we default
// to an empty filename which keeps `isRunningViaCli` false (no side effects).
let scriptFileName = '';
try {
    scriptFileName = path.basename(fileURLToPath(import.meta.url));
} catch {
    // Not running in a file:// context — not running as a CLI.
}
const processFileName = process.argv[1] !== undefined
    ? path.basename(process.argv[1])
    : '';

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
 * paths, symlinks, and installation methods (including published bin symlinks
 * that resolve to `dist/cli.js`).
 */
const isRunningViaCli = scriptFileName === processFileName;

if (isRunningViaCli) {
    main();
}

// For API-like usage, export the convertFilters function and generateMD5Hash.
export {
    convertFilters,
    generateMD5Hash,
    getIdFromFilterName,
    extractRulesetId,
    getRulesetId,
    getRulesetPath,
    RULESET_FILE_EXT,
};
export type { ConvertFiltersOptions } from './convert-filters';
