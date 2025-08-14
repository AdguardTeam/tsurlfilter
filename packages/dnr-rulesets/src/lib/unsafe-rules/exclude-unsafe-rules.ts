import { promises as fs } from 'node:fs';
import path from 'node:path';

import { generateMD5Hash } from '@adguard/tsurlfilter/cli';
import {
    DeclarativeRule,
    IRuleSet,
    METADATA_RULESET_ID,
    MetadataRuleSet,
} from '@adguard/tsurlfilter/es/declarative-converter';
import {
    extractRuleSetId,
    getRuleSetPath,
    isSafeRule,
    RULESET_FILE_EXT,
} from '@adguard/tsurlfilter/es/declarative-converter-utils';
import { ensureDir } from 'fs-extra';

import { findFiles } from '../../utils/find-files';
import { loadRulesetAndFilter } from './ruleset-deserialize';

// TODO: Add some tests

/**
 * Options for the build safe patch function.
 */
interface ExcludeUnsafeRulesOptions {
    /**
     * Path to the rulesets directory.
     */
    dir: string;

    /**
     * Defines whether to prettify the rulesets JSON or not.
     * Not prettifying can save on JSON size.
     */
    prettifyJson?: boolean;

    /**
     * Optional limit for the number of unsafe rules to exclude.
     * If the number of unsafe rules exceeds this limit, an error will be thrown.
     */
    limit?: number;
}

/**
 * Scans a folder for ruleset JSON files and loads them.
 *
 * @param dirPath The path to the directory containing ruleset JSON files.
 *
 * @returns A promise that resolves to an array of rulesets.
 */
async function scanFolder(dirPath: string): Promise<IRuleSet[]> {
    await ensureDir(dirPath);

    const rulesetsPaths = await findFiles(
        dirPath,
        (filePath: string) => filePath.endsWith(RULESET_FILE_EXT),
    );

    const loadTasks = rulesetsPaths
        .map((rulesetPath) => {
            const jsonFilePath = rulesetPath;

            const id = extractRuleSetId(jsonFilePath);

            if (id === null) {
                throw new Error(`Failed to extract ruleset ID from path: ${jsonFilePath}.`);
            }

            // Skip ruleset with metadata.
            if (id === METADATA_RULESET_ID) {
                return null;
            }

            return [rulesetPath, id];
        })
        .filter((pathWithId): pathWithId is Array<string> => pathWithId !== null)
        .map(([rulesetPath, id]) => {
            return loadRulesetAndFilter(rulesetPath, id);
        });

    return Promise.all(loadTasks);
}

/**
 * Updates the metadata ruleset with checksums and saves it to the specified path.
 *
 * @param metadataRuleSetPath The path to the metadata ruleset.
 * @param checksums An object containing checksums for the rulesets,
 * where keys are ruleset IDs and values are checksums.
 * @param prettifyJson Optional parameter to define whether to prettify the JSON output.
 */
async function updateMetadataRuleset(
    metadataRuleSetPath: string,
    checksums: Record<string, string>,
    prettifyJson?: boolean,
) {
    console.log('Path to metadata ruleset:', metadataRuleSetPath);

    const rawMetadataRuleset = await fs.readFile(
        metadataRuleSetPath,
        { encoding: 'utf-8' },
    );

    const metadataRuleset = MetadataRuleSet.deserialize(rawMetadataRuleset);

    // Update each checksum in the metadata ruleset instead of recreating whole
    // ruleset to keep all additional properties not touched by this operation.
    Object.entries(checksums).forEach(([checksum, ruleSetId]) => {
        metadataRuleset.setChecksum(ruleSetId, checksum);
    });

    await fs.writeFile(
        metadataRuleSetPath,
        metadataRuleset.serialize(prettifyJson),
    );

    console.log(`Metadata ruleset updated and saved to ${metadataRuleSetPath}`);
}

/**
 * Excludes unsafe rules from rulesets and places them into the metadata rule.
 *
 * @param params Parameters for processing rulesets.
 * @param params.dir The directory containing the rulesets to process.
 * @param params.limit Optional limit for the maximum number of unsafe rules
 * to exclude.
 * @param params.prettifyJson Whether to prettify the JSON output.
 */
export async function excludeUnsafeRules(params: ExcludeUnsafeRulesOptions): Promise<void> {
    const {
        dir,
        limit,
        prettifyJson = false,
    } = params;

    const rulesets = await scanFolder(dir);

    console.log('Extracted rulesets:', rulesets.length);

    const totalUnsafeRulesCount = rulesets.reduce((acc, ruleset) => {
        return acc + ruleset.getUnsafeRulesCount();
    }, 0);

    // If limit is provided, check the number of unsafe rules
    // in all rulesets before processing them.
    if (limit) {
        if (totalUnsafeRulesCount > limit) {
            throw new Error(`Too many unsafe rules found: ${totalUnsafeRulesCount}. Limit is ${limit}.`);
        }
    }

    // After changes in rulesets we will need to update the metadata ruleset with
    // checksums for the rulesets.
    const checksums: Record<string, string> = {};

    const tasks = rulesets.map(async (ruleset) => {
        const declarativeRules = await ruleset.getDeclarativeRules();

        const unsafeDeclarativeRules = declarativeRules.filter((rule: DeclarativeRule) => {
            return !isSafeRule(rule);
        });

        const processedRuleset = await ruleset.serializeCompact(
            prettifyJson,
            unsafeDeclarativeRules,
        );

        const ruleSetPath = getRuleSetPath(
            ruleset.getId(),
            dir,
        );

        await ensureDir(path.dirname(ruleSetPath));
        await fs.writeFile(ruleSetPath, processedRuleset);

        checksums[ruleset.getId()] = generateMD5Hash(processedRuleset);

        console.log(`========== Ruleset #${ruleset.getId()} ==========`);
        console.log('Moved unsafe rules:', unsafeDeclarativeRules.length);
        console.log('Safety ruleset saved to:', ruleSetPath);
        console.log(`========== Ruleset #${ruleset.getId()} ==========`);
        console.log('\n');
    });

    await Promise.all(tasks);

    await updateMetadataRuleset(
        getRuleSetPath(METADATA_RULESET_ID, dir),
        checksums,
        prettifyJson,
    );

    console.log('Total excluded unsafe rules:', totalUnsafeRulesCount);
    console.log('All rulesets processed and their metadata updated.');
}
