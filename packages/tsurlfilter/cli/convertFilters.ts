/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

import { CompatibilityTypes, setConfiguration } from '../src/configuration';
import { ConvertedFilterList } from '../src/filterlist/converted-filter-list';
import {
    type ConversionResult,
    DeclarativeFilterConverter,
    Filter,
    type IRuleSet,
} from '../src/rules/declarative-converter';
import { MetadataRuleSet } from '../src/rules/declarative-converter/metadata-ruleset';
import { re2Validator } from '../src/rules/declarative-converter/re2-regexp/re2-validator';
import { regexValidatorNode } from '../src/rules/declarative-converter/re2-regexp/regex-validator-node';
import { getRuleSetId, getRuleSetPath } from '../src/rules/declarative-converter-utils';
import { generateMD5Hash } from '../src/utils/checksum';
import { getIdFromFilterName } from '../src/utils/resource-names';

import { ensureDirSync } from './utils';

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
interface ConvertFiltersOptions {
    /**
     * If true, additional information is printed during conversion.
     * Default value specified here {@link CONVERT_FILTER_DEFAULT_OPTIONS.debug}.
     */
    debug?: boolean;

    /**
     * Defines whether to prettify the rulesets JSON or not.
     * Not prettifying can save on JSON size.
     * Default value specified here {@link CONVERT_FILTER_DEFAULT_OPTIONS.prettifyJson}.
     */
    prettifyJson?: boolean;

    /**
     * Additional properties that can be passed to the converter to record
     * inside metadata ruleset.
     * This field is not validated, but it must be JSON serializable.
     * Validation should be performed by users.
     */
    additionalProperties?: Record<string, unknown>;
}

/**
 * Converts filters with textual rules from the provided path to declarative
 * rulesets and saves them with counters, source map and list of source filter
 * identifiers on the specified path.
 *
 * @param filtersAndMetadataDir Path fo source filters with metadata to convert.
 * @param resourcesDir Path to web accessible resources.
 * @param destRulesetsDir Destination path for declarative rulesets.
 * @param options Options for convert filters {@link ConvertFiltersOptions}.
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

    ensureDirSync(filtersWithMetadataPath);
    ensureDirSync(destRulesetsPath);

    const filtersPaths = new Map<number, string>();

    console.info(`Scanning ${filtersWithMetadataPath} for filters...`);

    const files = await fs.promises.readdir(filtersWithMetadataPath);
    const filters = files
        .map((filePath: string) => {
            const curPath = path.join(filtersWithMetadataPath, filePath);

            console.info(`Extracting filter id from file ${curPath}...`);

            const index = getIdFromFilterName(filePath);

            if (!index) {
                console.info(`Path '${curPath}' skipped`);
                return null;
            }

            const filterId = Number(index);

            filtersPaths.set(filterId, filePath);
            const data = fs.readFileSync(
                path.resolve(filtersWithMetadataPath, filePath),
                { encoding: 'utf-8' },
            );

            console.info(`Added filter #${filterId} to convert`);

            return new Filter(
                filterId,
                { getContent: async () => new ConvertedFilterList(data) },
                // we consider that all preinstalled filters are trusted
                true,
            );
        })
        .filter((filter): filter is Filter => filter !== null);

    const convertedRulesets: IRuleSet[] = [];
    let errors: ConversionResult['errors'] = [];
    let limitations: ConversionResult['limitations'] = [];

    const converter = new DeclarativeFilterConverter();
    re2Validator.setValidator(regexValidatorNode);

    setConfiguration({
        engine: 'extension',
        version: '3',
        verbose: true,
        compatibility: CompatibilityTypes.Extension,
    });

    console.info(`Starting conversion filters: ${filters.map((f) => f.getId()).join(', ')}`);

    for (let i = 0; i < filters.length; i += 1) {
        const filter = filters[i];

        // eslint-disable-next-line no-await-in-loop
        const converted = await converter.convertStaticRuleSet(
            filter,
            { resourcesPath },
        );

        convertedRulesets.push(converted.ruleSet);
        errors = errors.concat(converted.errors);
        limitations = limitations.concat(converted.limitations);

        if (debug) {
            console.log('======================================');
            console.log(`Filter #${filter.getId()} info`);
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
    }

    console.log('\n');
    console.log('======================================');
    console.log('Common info');
    console.log('======================================');

    console.log(`Converted rulesets: ${convertedRulesets.length}`);

    console.log(`Errors: ${errors.length}`);

    if (debug && errors.length > 0) {
        console.log('======================================');
        console.log('Converted with following errors: ');
        console.log('======================================');
        errors.forEach((e) => console.log(e.message));
    }

    console.log(`Skipped converting for rules: ${limitations.length}`);

    if (debug && limitations.length > 0) {
        console.log('======================================');
        console.log('Converted with following limitations: ');
        console.log('======================================');
        limitations.forEach((e) => console.log(e.message));
    }

    const checksums: Record<string, string> = {};

    for (let i = 0; i < convertedRulesets.length; i += 1) {
        const ruleSet = convertedRulesets[i];
        const id = ruleSet.getId();

        const ruleSetDir = path.join(destRulesetsPath, getRuleSetId(id));
        ensureDirSync(ruleSetDir);

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

    // We save metadata to special ruleset since it is required condition to use
    // "skip review" option in CWS, that changes should be only in rulesets.
    // We also have filters_i18n.json file in the filtersPath, but it is not
    // often updated, so we pack inside ruleset only filters' metadata with
    // versions, checksums and other information, not translations.
    const rawMetadata = await fs.promises.readFile(
        path.join(filtersAndMetadataDir, LOCAL_METADATA_FILE_NAME),
        { encoding: 'utf-8' },
    );
    const metadata = JSON.parse(rawMetadata);

    const metadataRuleSet = new MetadataRuleSet(
        checksums,
        {
            metadata,
            ...additionalProperties,
        },
    );

    const metadataRulesetId = metadataRuleSet.getId();
    const metadataRulesetDir = path.join(destRulesetsPath, getRuleSetId(metadataRulesetId));
    ensureDirSync(metadataRulesetDir);

    const metadataRuleSetPath = getRuleSetPath(metadataRulesetId, destRulesetsPath);
    await fs.promises.writeFile(
        metadataRuleSetPath,
        metadataRuleSet.serialize(prettifyJson),
    );

    console.log('===============================================');
    console.info(`Metadata ruleset saved to ${metadataRuleSetPath}`);
    console.log('===============================================');
};
