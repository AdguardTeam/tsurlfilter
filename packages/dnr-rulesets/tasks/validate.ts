import { METADATA_RULESET_ID } from '@adguard/tsurlfilter/es/declarative-converter';
import { extractRuleSetId, getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import fs from 'fs';
import path from 'path';

import { version } from '../package.json';
import { DEST_RULE_SETS_DIR } from './constants';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * File name where old validator data is stored.
 */
const OLD_VALIDATOR_DATA_FILE_NAME = 'old-validator-data.json';

/**
 * Ruleset ids, metadata keys, and version.
 *
 * Needed to validate rulesets data.
 */
type RulesetIdsAndMetadataKeys = {
    /**
     * Version of the dnr-rulesets package.
     */
    version: string;

    /**
     * List of ruleset ids.
     */
    rulesetIds: number[];

    /**
     * List of metadata keys.
     */
    rulesetMetadataKeys: string[];
};

/**
 * Retrieves data needed for rulesets validation — rulesets ids and metadata keys.
 *
 * @param destDir Directory with declarative rulesets.
 *
 * @returns Data with ruleset ids and metadata keys.
 */
const getValidatorData = async (destDir: string): Promise<RulesetIdsAndMetadataKeys> => {
    const rulesetIds: number[] = [];
    const rulesetMetadataKeys: string[] = [];

    const destDirItems = await fs.promises.readdir(destDir, { withFileTypes: true });

    const destDirSubdirectories = destDirItems.filter((item) => item.isDirectory());

    destDirSubdirectories.forEach((item) => {
        const id = extractRuleSetId(item.name);

        if (id === null) {
            throw new Error(`Cannot extract ruleset id from ${item.name}`);
        }

        // Skip metadata ruleset, because its a special ruleset
        if (id === METADATA_RULESET_ID) {
            return;
        }

        rulesetIds.push(id);
    });

    const ruleSetPath = getRuleSetPath(rulesetIds[0], destDir);

    try {
        const rawRuleSetContent = await fs.promises.readFile(
            ruleSetPath,
            { encoding: 'utf-8' },
        );

        const ruleSetContent = JSON.parse(rawRuleSetContent);
        const metadataRule = ruleSetContent[0];
        const metadata = metadataRule.metadata;
        const declarativeMetadata = metadata.metadata;

        rulesetMetadataKeys.push(...Object.keys(declarativeMetadata));
    } catch (e: unknown) {
        console.error(`Error parsing metadata file ${ruleSetPath} due to ${e}`);
    }

    return {
        version,
        // sort ids to make it more readable
        rulesetIds: rulesetIds.sort((a, b) => a - b),
        rulesetMetadataKeys,
    };
};

/**
 * Retrieves old validator data.
 *
 * @returns Old rulesets data for validation.
 *
 * @throws Error if old rulesets data cannot be retrieved.
 */
const getOldValidatorData = async (): Promise<RulesetIdsAndMetadataKeys> => {
    let oldData: RulesetIdsAndMetadataKeys;

    try {
        const oldDataContent = await fs.promises.readFile(
            path.join(__dirname, OLD_VALIDATOR_DATA_FILE_NAME),
            { encoding: 'utf-8' },
        );
        oldData = JSON.parse(oldDataContent);
    } catch (e: unknown) {
        throw new Error(`Error parsing old rulesets data due to ${e}`);
    }

    return oldData;
};

/**
 * Validates rulesets — checks if list of ruleset ids or metadata keys has changed.
 *
 * Please note that error should be thrown for both manual and auto build,
 * because if manual build is run via npx command, a log message will not be displayed.
 *
 * @param newData New rulesets data.
 *
 * @throws Error if list of ruleset ids or metadata keys has changed.
 */
const validateRulesets = async (newData: RulesetIdsAndMetadataKeys): Promise<void> => {
    const oldData = await getOldValidatorData();

    const addedRulesetIds = newData.rulesetIds.filter((id) => !oldData.rulesetIds.includes(id));
    const removedRulesetIds = oldData.rulesetIds.filter((id) => !newData.rulesetIds.includes(id));

    if (addedRulesetIds.length > 0 || removedRulesetIds.length > 0) {
        const messageParts = [`Number of rulesets is changed comparing to the previous version (${oldData.version})`];

        if (addedRulesetIds.length > 0) {
            messageParts.push(`Added rulesets: ${addedRulesetIds.join(', ')}`);
        }
        if (removedRulesetIds.length) {
            messageParts.push(`Removed rulesets: ${removedRulesetIds.join(', ')}`);
        }

        messageParts.push(`Consider updating changelog ${OLD_VALIDATOR_DATA_FILE_NAME} for the next build`);

        throw new Error(messageParts.join('\n'));
    }

    const addedMetadataKeys = newData.rulesetMetadataKeys.filter((key) => !oldData.rulesetMetadataKeys.includes(key));
    const removedMetadataKeys = oldData.rulesetMetadataKeys.filter((key) => !newData.rulesetMetadataKeys.includes(key));

    if (addedMetadataKeys.length > 0 || removedMetadataKeys.length > 0) {
        const messageParts = [`Metadata keys have changed comparing to the previous version (${oldData.version})`];

        if (addedMetadataKeys.length > 0) {
            messageParts.push(`Added metadata keys: ${addedMetadataKeys.join(', ')}`);
        }
        if (removedMetadataKeys.length > 0) {
            messageParts.push(`Removed metadata keys: ${removedMetadataKeys.join(', ')}`);
        }

        // eslint-disable-next-line max-len
        messageParts.push(`Consider bumping package version, updating changelog and ${OLD_VALIDATOR_DATA_FILE_NAME} for the next build`);

        throw new Error(messageParts.join('\n'));
    }
};

/**
 * Validates rulesets.
 */
const validate = async (): Promise<void> => {
    const newData = await getValidatorData(DEST_RULE_SETS_DIR);

    await validateRulesets(newData);
};

validate();
