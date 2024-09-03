#!/usr/bin/env node
import { Command } from 'commander';

import { PATCH_FILE_ERROR_TEXT, Resolution, isPatchNameValid } from '../common/patch-name';
import { buildDiff } from '../diff-builder/build';
import { version } from '../../package.json';

const program = new Command();

/**
 * CLI wrapper for {@link buildDiff} function.
 */
async function main(): Promise<void> {
    program
        .name('diff-builder')
        .description('A tool for generating differential updates for filter lists.')
        .version(version);

    program
        /* eslint-disable max-len */
        .command('build')
        .argument('<old_filter>', 'the relative path to the old filter')
        .argument('<new_filter>', 'the relative path to the new filter')
        .argument('<path_to_patches>', 'the relative path to the patches. The patch filename will be `<path_to_patches>/$PATCH`, where `$PATCH` is the "<patchName>[-<resolution>]-<epochTimestamp>-<expirationPeriod>.patch"')
        .requiredOption('-n, --name <name>', 'name of the patch file, an arbitrary string to identify the patch. Must be a string of length 1-64 with no spaces or other special characters.')
        .requiredOption('-t, --time <expirationPeriod>', 'expiration time for the diff update (the unit depends on `resolution`).')
        .option('-r, --resolution <timestampResolution>', 'is an optional flag, that specifies the resolution for both `expirationPeriod` and `epochTimestamp` (timestamp when the patch was generated). It can be either `h` (hours), `m` (minutes) or `s` (seconds). If `resolution` is not specified, it is assumed to be `h`.')
        .option('-c, --checksum', 'an optional flag, indicating whether it should calculate the SHA sum for the filter and add it to the `diff` directive with the filter name and the number of changed lines, following this format: `diff name:[name] checksum:[checksum] lines:[lines]`')
        .option('-d, --delete-older-than-sec <seconds>', 'an optional parameter, the time to live for the patch in *seconds*. By default, it will be `604800` (7 days). The utility will scan `<path_to_patches>` and delete patches whose created epoch timestamp has expired, if they are not empty.')
        .option('-v, --verbose', 'verbose mode')
        /* eslint-enable max-len */
        .action(async (
            oldFilterPath,
            newFilterPath,
            patchesPath,
            options,
        ) => {
            const {
                name,
                time,
                resolution,
                checksum,
                deleteOlderThanSec,
                verbose,
            } = options;

            if (resolution && !Object.values(Resolution).includes(resolution as Resolution)) {
                throw new Error(`Resolution should be one of ${Object.values(Resolution).join(',')}`);
            }

            if (!isPatchNameValid(name)) {
                throw new Error(PATCH_FILE_ERROR_TEXT);
            }

            await buildDiff({
                oldFilterPath,
                newFilterPath,
                patchesPath,
                name,
                time,
                resolution,
                checksum,
                deleteOlderThanSec,
                verbose,
            });
        });

    program.parseAsync(process.argv);
}

const isRunningViaCli = require.main === module;

if (isRunningViaCli) {
    main();
}
