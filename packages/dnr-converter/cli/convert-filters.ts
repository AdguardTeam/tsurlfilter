/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

import {
    type ConversionResult,
    Filter,
    FilterConverter,
    type IRulesetWithSourceMap,
    MetadataRuleset,
} from '../src/index';
import { re2Validator } from '../src/re2-regexp/re2-validator';
import { regexValidatorNode } from '../src/re2-regexp/regex-validator-node';

import {
    ensureDir,
    generateMD5Hash,
    getIdFromFilterName,
    getRuleSetPath,
} from './utils';

export const LOCAL_METADATA_FILE_NAME = 'filters.json';

/**
 * Default options used by convert filters.
 */
const CONVERT_FILTER_DEFAULT_OPTIONS = {
    debug: false,
    prettifyJson: true,
};

/**
 * Options for the convert filters function.
 */
export interface ConvertFiltersOptions {
    /**
     * If true, additional information is printed during conversion.
     */
    debug?: boolean;

    /**
     * Defines whether to prettify the rulesets JSON or not.
     */
    prettifyJson?: boolean;

    /**
     * Additional properties that can be passed to the converter to record
     * inside metadata ruleset.
     */
    additionalProperties?: Record<string, unknown>;
}

/**
 * Converts filters with textual rules from the provided path to declarative
 * rulesets and saves them with counters, source map and list of source filter
 * identifiers on the specified path.
 *
 * @param filtersAndMetadataDir Path to source filters with metadata to convert.
 * @param resourcesDir Path to web accessible resources.
 * @param destRulesetsDir Destination path for declarative rulesets.
 * @param options Options for convert filters.
 */
export const convertFilters = async (
    filtersAndMetadataDir: string,
    resourcesDir: string,
    destRulesetsDir: string,
    options: ConvertFiltersOptions = {},
): Promise<void> => {
    const {
        debug = CONVERT_FILTER_DEFAULT_OPTIONS.debug,
        prettifyJson = CONVERT_FILTER_DEFAULT_OPTIONS.prettifyJson,
        additionalProperties,
    } = options;

    const filtersWithMetadataPath = path.resolve(process.cwd(), filtersAndMetadataDir);
    const resourcesPath = path.resolve(process.cwd(), resourcesDir);
    const destRulesetsPath = path.resolve(process.cwd(), destRulesetsDir);

    await ensureDir(filtersWithMetadataPath);
    await ensureDir(destRulesetsPath);

    console.info(`Scanning ${filtersWithMetadataPath} for filters...`);

    const files = await fs.promises.readdir(filtersWithMetadataPath);
    const filtersTasks = await Promise.all(files.map(async (filePath: string) => {
        const curPath = path.join(filtersWithMetadataPath, filePath);

        console.info(`Extracting filter id from file ${curPath}...`);

        const filterId = getIdFromFilterName(filePath);

        if (filterId === null) {
            console.info(`Path '${curPath}' skipped`);
            return null;
        }

        const data = await fs.promises.readFile(
            path.resolve(filtersWithMetadataPath, filePath),
            { encoding: 'utf-8' },
        );

        console.info(`Added filter #${filterId} to convert`);

        return new Filter(filterId, data);
    }));
    const filters = filtersTasks.filter((filter): filter is Filter => filter !== null);

    re2Validator.setValidator(regexValidatorNode);

    const converter = new FilterConverter();

    console.info(`Starting conversion filters: ${filters.map((f) => f.getId()).join(', ')}`);

    const results: ConversionResult<IRulesetWithSourceMap>[] = await converter.convert(
        filters,
        { resourcesPath, withSourceMap: true },
    );

    let allErrors: ConversionResult<IRulesetWithSourceMap>['errors'] = [];
    let allLimitations: ConversionResult<IRulesetWithSourceMap>['limitations'] = [];

    for (const converted of results) {
        allErrors = allErrors.concat(converted.errors);
        allLimitations = allLimitations.concat(converted.limitations);

        if (!debug) {
            continue;
        }

        const filterId = converted.ruleSet.getId();
        console.log('======================================');
        console.log(`Filter #${filterId} info`);
        console.log('======================================');

        console.log(`Errors: ${converted.errors.length}`);
        if (converted.errors.length > 0) {
            console.log('======================================');
            console.log('Converted with following errors: ');
            console.log('======================================');
            converted.errors.forEach((e) => console.log(e.message));
        }

        if (converted.limitations.length > 0) {
            // eslint-disable-next-line max-len
            console.log(`Some converted rules were discarded to fit within the limits: ${converted.limitations.length}`);
            console.log('======================================');
            console.log('Converted with following limitations: ');
            console.log('======================================');
            converted.limitations.forEach((e) => console.log(e.message));
        }
    }

    console.log('\n');
    console.log('======================================');
    console.log('Common info');
    console.log('======================================');

    console.log(`Converted rulesets: ${results.length}`);

    console.log(`Errors: ${allErrors.length}`);

    if (debug && allErrors.length > 0) {
        console.log('======================================');
        console.log('Converted with following errors: ');
        console.log('======================================');
        allErrors.forEach((e) => console.log(e.message));
    }

    console.log(`Skipped converting for rules: ${allLimitations.length}`);

    if (debug && allLimitations.length > 0) {
        console.log('======================================');
        console.log('Converted with following limitations: ');
        console.log('======================================');
        allLimitations.forEach((e) => console.log(e.message));
    }

    const checksums: Record<string, string> = {};

    for (let i = 0; i < results.length; i += 1) {
        const { ruleSet } = results[i];
        const id = ruleSet.getId();

        const ruleSetDir = path.join(destRulesetsPath, id);
        // eslint-disable-next-line no-await-in-loop
        await ensureDir(ruleSetDir);

        // eslint-disable-next-line no-await-in-loop
        const result = await ruleSet.serializeCompact(prettifyJson);
        const ruleSetPath = getRuleSetPath(id, destRulesetsPath);
        // eslint-disable-next-line no-await-in-loop
        await fs.promises.writeFile(ruleSetPath, result);

        checksums[id] = generateMD5Hash(result);

        console.log('===============================================');
        console.info(`Ruleset with id ${id} and all ruleset info`);
        console.info('(counters, source map, filter list) was saved');
        console.info(`to ${ruleSetPath}`);
        console.log('===============================================');
    }

    const rawMetadata = await fs.promises.readFile(
        path.join(filtersWithMetadataPath, LOCAL_METADATA_FILE_NAME),
        { encoding: 'utf-8' },
    );
    const metadata = JSON.parse(rawMetadata);

    const metadataRuleSet = new MetadataRuleset(
        checksums,
        {
            metadata,
            ...additionalProperties,
        },
    );

    const metadataRulesetId = metadataRuleSet.getId();
    const metadataRulesetDir = path.join(destRulesetsPath, metadataRulesetId);
    await ensureDir(metadataRulesetDir);

    const metadataRuleSetPath = getRuleSetPath(metadataRulesetId, destRulesetsPath);
    await fs.promises.writeFile(
        metadataRuleSetPath,
        metadataRuleSet.serialize(prettifyJson),
    );

    console.log('===============================================');
    console.info(`Metadata ruleset saved to ${metadataRuleSetPath}`);
    console.log('===============================================');
};
