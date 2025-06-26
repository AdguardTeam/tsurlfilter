import { generateMD5Hash } from '@adguard/tsurlfilter';
import { convertFilters } from '@adguard/tsurlfilter/cli';
import {
    DeclarativeRule,
    IFilter,
    IRuleSet,
    MetadataRuleSet,
    RULESET_NAME_PREFIX,
    SafetyPatch,
} from '@adguard/tsurlfilter/es/declarative-converter';
import { getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import { promises as fs } from 'fs';
import { ensureDir } from 'fs-extra';
import path from 'path';

import { LOCAL_METADATA_FILE_NAME } from '../../common/constants';
import { calculateChecksumMD5, CHECKSUM_TAG, hasChecksum } from '../utils/calculate-checksum';
import { findFiles } from '../utils/find-files';
import { splitByLines } from '../utils/split-by-lines';
import { loadRuleSetAndFilterFromDir } from './ruleset-deserialize';
import { createTag, removeTag } from './tags';

const SAFE_ACTIONS = new Set(['block', 'allow', 'allowAllRequests', 'upgradeScheme']);

// FIXME: Add some tests

/**
 * Options for the build safe patch function.
 */
interface BuildSafePatchOptions {
    /**
     * Path to the old rulesets directory.
     */
    oldDir: string;

    /**
     * Path to the new rulesets directory.
     */
    newDir: string;

    /**
     * Path to the resources directory.
     * This is used to build $redirect rules.
     */
    resourcesPath: string;

    /**
     * Defines whether to prettify the rulesets JSON or not.
     * Not prettifying can save on JSON size.
     */
    prettifyJson?: boolean;
}

type RulesetWithFilter = {
    /**
     * The ruleset ID.
     */
    id: string;

    /**
     * The ruleset.
     */
    ruleSet: IRuleSet;

    /**
     * The filter associated with the ruleset.
     */
    filter: IFilter;
};

type FilterWithNewRules = {
    /**
     * The text of raw filter with new rules added.
     */
    filter: string;

    /**
     * Contains unsafe rules which should be added to the metadata.
     */
    patch: SafetyPatch;
};

/**
 * Scans a folder for ruleset JSON files and loads them.
 *
 * @param dirPath The path to the directory containing ruleset JSON files.
 *
 * @returns A promise that resolves to an array of rulesets with their filters.
 */
async function scanFolder(dirPath: string): Promise<RulesetWithFilter[]> {
    await ensureDir(dirPath);

    const rulesetsPaths = await findFiles(
        dirPath,
        (filePath: string) => filePath.endsWith('.json'),
    );

    const results: RulesetWithFilter[] = [];

    for (const rulesetPath of rulesetsPaths) {
        const jsonFilePath = rulesetPath;

        const basename = path.basename(jsonFilePath, '.json');
        const id = basename.slice(RULESET_NAME_PREFIX.length);

        // Skip ruleset with metadata.
        if (id === '0') {
            continue;
        }

        const { ruleSet, filter } = await loadRuleSetAndFilterFromDir(rulesetPath, id);

        console.log(`Loaded ruleset with ID ${id} from ${jsonFilePath}`);

        results.push({
            id,
            ruleSet,
            filter,
        });
    }

    return results;
}

/**
 * Updates the metadata ruleset with checksums and saves it to the specified path.
 *
 * @param pathToMetadata The path to the metadata directory containing the local metadata file.
 * @param rulesetsPath The path to the directory where rulesets are stored.
 * @param checksums An object containing checksums for the rulesets,
 * where keys are ruleset IDs and values are checksums.
 * @param prettifyJson Optional parameter to define whether to prettify the JSON output.
 */
async function updateMetadataRuleset(
    pathToMetadata: string,
    rulesetsPath: string,
    checksums: Record<string, string>,
    prettifyJson?: boolean,
) {
    // We save metadata to special ruleset since it is required condition to use
    // "skip review" option in CWS, that changes should be only in rulesets.
    // We also have filters_i18n.json file in the filtersPath, but it is not
    // often updated, so we pack inside ruleset only filters' metadata with
    // versions, checksums and other information, not translations.
    const rawMetadata = await fs.readFile(
        path.join(pathToMetadata, LOCAL_METADATA_FILE_NAME),
        { encoding: 'utf-8' },
    );
    const metadata = JSON.parse(rawMetadata);

    const metadataRuleSet = new MetadataRuleSet(
        checksums,
        { metadata },
    );

    const metadataRulesetId = metadataRuleSet.getId();

    const metadataRuleSetPath = getRuleSetPath(metadataRulesetId, rulesetsPath);

    await fs.writeFile(
        metadataRuleSetPath,
        metadataRuleSet.serialize(prettifyJson),
    );

    console.log(`Metadata ruleset updated and saved to ${metadataRuleSetPath}`);
}

/**
 * Updates the checksum tag in the filter content, if it exists.
 *
 * @param filterContent The content of the filter as a string.
 *
 * @returns The updated filter content with the new checksum tag.
 */
export const updateChecksumTag = (filterContent: string): string => {
    if (!hasChecksum(filterContent)) {
        return filterContent;
    }

    // FIXME: Can be optimized: avoid splitting the content and replace the tag
    // directly in the string.
    // Split the content of the filters into lines to properly process
    // the checksum tag.
    let newFileSplitted = splitByLines(filterContent);

    const hasUserAgent = newFileSplitted[0].startsWith('![') || newFileSplitted[0].startsWith('[');

    // Remove tag 'Checksum' from content of filter.
    newFileSplitted = removeTag(CHECKSUM_TAG, newFileSplitted);

    const lineEnding = newFileSplitted[0].endsWith('\r\n') ? '\r\n' : '\n';

    // Calculate and insert a new checksum tag at the start of the filter
    const updatedChecksum = calculateChecksumMD5(newFileSplitted.join(''));
    const checksumTag = createTag(CHECKSUM_TAG, updatedChecksum, lineEnding);

    if (hasUserAgent) {
        // Insert Checksum after the userAgent header.
        newFileSplitted.splice(1, 0, checksumTag);
    } else {
        newFileSplitted.unshift(checksumTag);
    }

    return newFileSplitted.join('');
};

/**
 * Build a safety patch by comparing two declarative ruleset directories.
 * Compares rules by condition, maps to original text rules, and outputs patch.
 *
 * @param newRuleSet The new ruleset to compare against the old one.
 * @param oldRuleSet The old ruleset to compare with the new one.
 * @param oldFilter The old filter associated with the old ruleset.
 *
 * @returns A promise that resolves to an object containing the old filter text
 * with added safe rules and a patch containing unsafe rules to be added
 * to the metadata.
 */
export async function buildSafePatch(
    newRuleSet: IRuleSet,
    oldRuleSet: IRuleSet,
    oldFilter: IFilter,
): Promise<FilterWithNewRules> {
    const oldDeclarativeRules = await oldRuleSet.getDeclarativeRules();
    const newDeclarativeRules = await newRuleSet.getDeclarativeRules();

    // IMPORTANT: you must not compare declarative rules by id only!
    // IDs can theoretically collide: if the rule text changes slightly,
    // the new ruleset may have a different rule with the same id.
    const serializeKey = (rule: DeclarativeRule) => JSON.stringify({ rule });

    const newByKey = new Map<string, DeclarativeRule>();
    for (const rule of newDeclarativeRules) {
        newByKey.set(serializeKey(rule), rule);
    }

    const oldByKey = new Map<string, DeclarativeRule>();
    for (const rule of oldDeclarativeRules) {
        oldByKey.set(serializeKey(rule), rule);
    }

    const deletedKeys = [...oldByKey.keys()].filter((k) => !newByKey.has(k));
    const addedKeys = [...newByKey.keys()].filter((k) => !oldByKey.has(k));

    // FIXME: Here comparing will not work since they have different values,
    // but comparing them with id is not correct, since id can be reused for
    // different rules.
    // So we can easily not use changed rules at all, since they just will be
    // added AND deleted in the same time.
    const changedKeys = [...oldByKey.keys()].filter((k) => {
        return newByKey.has(k) && JSON.stringify(oldByKey.get(k)) !== JSON.stringify(newByKey.get(k));
    });

    console.log(`=== Safety patch statistics for ruleset ${oldRuleSet.getId()} ===`);
    console.log('Deleted rules:', deletedKeys.length);
    console.log('Added rules:', addedKeys.length);
    console.log('Changed rules:', changedKeys.length);
    console.log('\n');

    const isUnsafe = (rule: DeclarativeRule) => !SAFE_ACTIONS.has(rule.action?.type);
    const disableUnsafeRulesIds = new Set<number>();
    const addUnsafeRules = new Set<string>();
    const addSafeRules = new Set<string>();

    // For all deleted we mark them as disabled unsafe rules.
    for (const key of [...deletedKeys, ...changedKeys]) {
        const oldRule = oldByKey.get(key);
        if (!oldRule) {
            throw new Error('Cannot find old rule for key: ' + key);
        }

        if (!isUnsafe(oldRule)) {
            continue;
        }

        disableUnsafeRulesIds.add(oldRule.id);
    }

    // For added rules we neither add them to the metadata, neither to
    // the ruleset rules.
    for (const key of addedKeys) {
        const newRule = newByKey.get(key);

        if (!newRule) {
            throw new Error('Cannot find new rule for key: ' + key);
        }

        const srcRules = await newRuleSet.getRulesById(newRule.id);
        for (const { sourceRule } of srcRules) {
            if (isUnsafe(newRule)) {
                addUnsafeRules.add(sourceRule);
            } else {
                addSafeRules.add(sourceRule);
            }
        }
    }

    // Patch with unsafe rules, which will be inserted into the metadata.
    const patch: SafetyPatch = {
        disableUnsafeRulesIds: Array.from(disableUnsafeRulesIds),
        addUnsafeRules: Array.from(addUnsafeRules),
    };

    // Old filter text with added safe rules.
    const oldContent = await oldFilter.getContent();
    const oldFilterWithAddedSafeRules = oldContent.rawFilterList.concat(
        '\n##### Safety patch ######\n',
        Array.from(addSafeRules).join('\n'),
    );

    const filter = updateChecksumTag(oldFilterWithAddedSafeRules);

    return {
        filter,
        patch,
    };
}

/**
 * Processes rulesets from the specified directories.
 *
 * @param params Parameters for processing rulesets.
 * @param params.oldDir Path to the old extension's directory with rulesets
 * inside '/declarative' folder.
 * @param params.newDir Path to the new extension's directory with rulesets
 * inside '/declarative' folder.
 * @param params.resourcesPath Path to the resources directory for building $redirect rules.
 * @param params.options Optional options.
 */
export async function processRulesets(params: BuildSafePatchOptions): Promise<void> {
    const {
        oldDir,
        newDir,
        resourcesPath,
        prettifyJson,
    } = params;

    const rulesetsPatches = new Map<string, SafetyPatch>();

    const oldRulesets = await scanFolder(path.join(oldDir, '/declarative'));
    console.log('Extracted old rulesets:', oldRulesets.length);
    const newRulesets = await scanFolder(path.join(newDir, '/declarative'));
    console.log('Extracted new rulesets:', newRulesets.length);

    console.log('\n');
    console.log('\n');

    let tasks = oldRulesets.map(async (oldRuleset) => {
        // Since we operate with several dozens of rulesets it's okay to find
        // ruleset by ID in array instead of using Map.
        const newRuleSet = newRulesets.find((r) => r.id === oldRuleset.id)?.ruleSet;

        if (!newRuleSet) {
            console.warn(`No new ruleset found for ruleset ID: ${oldRuleset.id}`);
            return;
        }

        const { filter, patch } = await buildSafePatch(newRuleSet, oldRuleset.ruleSet, oldRuleset.filter);

        rulesetsPatches.set(oldRuleset.id, patch);

        const p = path.join(newDir, `filter_${oldRuleset.id}.txt`);
        await fs.writeFile(p, filter);
        console.log('Filter with added safe rules saved to to: ', p);
    });

    await Promise.all(tasks);
    tasks = [];

    // Convert all filters to correctly update counters and source maps for
    // newly added safe rules.
    await convertFilters(
        newDir,
        resourcesPath,
        path.join(newDir, '/declarative'),
        { prettifyJson },
    );

    // Now scan the new directory again to get updated rulesets.
    const regeneratedNewRulesets = await scanFolder(path.join(newDir, '/declarative'));

    // After changes in rulesets we will need to update the metadata ruleset with
    // checksums for the rulesets.
    const checksums: Record<string, string> = {};

    // And insert unsafe rules into metadata of the rulesets.
    tasks = regeneratedNewRulesets.map(async (newRuleset) => {
        const patch = rulesetsPatches.get(newRuleset.id);

        if (!patch) {
            console.warn(`No patch found for ruleset ID: ${newRuleset.id}`);
            return;
        }

        const rulesetWithSafeAndUnsafeRules = await newRuleset.ruleSet.serializeCompact(
            prettifyJson,
            patch,
        );

        const ruleSetPath = getRuleSetPath(newRuleset.id, path.join(newDir, '/declarative'));

        await ensureDir(path.dirname(ruleSetPath));

        await fs.writeFile(ruleSetPath, rulesetWithSafeAndUnsafeRules);

        checksums[newRuleset.ruleSet.getId()] = generateMD5Hash(rulesetWithSafeAndUnsafeRules);

        console.log(`========== Ruleset #${newRuleset.id} ==========`);
        console.log('Disabled unsafe DNR rules ids:', patch.disableUnsafeRulesIds);
        console.log('Added unsafe rules:', patch.addUnsafeRules);
        console.log('Safety update for ruleset saved to:', ruleSetPath);
        console.log(`========== Ruleset #${newRuleset.id} ==========`);
        console.log('\n');
    });

    await Promise.all(tasks);

    await updateMetadataRuleset(
        newDir,
        path.join(newDir, '/declarative'),
        checksums,
        prettifyJson,
    );

    console.log('All rulesets processed successfully.');
}
