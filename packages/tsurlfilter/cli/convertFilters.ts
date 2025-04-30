/* eslint-disable no-console */
import path from 'node:path';
import fs from 'node:fs';

import {
    type ConversionResult,
    type IRuleSet,
    DeclarativeFilterConverter,
    Filter,
} from '../src/rules/declarative-converter';
import { CompatibilityTypes, setConfiguration } from '../src/configuration';
import { FilterListPreprocessor } from '../src/filterlist/preprocessor';
import { getIdFromFilterName } from '../src/utils/resource-names';
import { re2Validator } from '../src/rules/declarative-converter/re2-regexp/re2-validator';
import { regexValidatorNode } from '../src/rules/declarative-converter/re2-regexp/regex-validator-node';
import { generateMD5Hash } from '../src/utils/checksum';
import { MetadataRuleSet } from '../src/rules/declarative-converter/metadata-ruleset';
import { getRuleSetId, getRuleSetPath } from '../src/rules/declarative-converter-utils';

const ensureDirSync = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

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
}

/**
 * Converts filters with textual rules from the provided path to declarative
 * rule sets and saves them with counters, source map and list of source filter
 * identifiers on the specified path.
 *
 * @param filtersDir Path fo source filters.
 * @param resourcesDir Path to web accessible resources.
 * @param destRuleSetsDir Destination path for declarative rule sets.
 * @param options Options for convert filters {@link ConvertFiltersOptions}.
 */
export const convertFilters = async (
    filtersDir: string,
    resourcesDir: string,
    destRuleSetsDir: string,
    options: ConvertFiltersOptions = {},
): Promise<void> => {
    const {
        debug = CONVERT_FILTER_DEFAULT_OPTIONS.debug,
        prettifyJson = CONVERT_FILTER_DEFAULT_OPTIONS.prettifyJson,
    } = options;

    const filtersPath = path.resolve(process.cwd(), filtersDir);
    const resourcesPath = path.resolve(process.cwd(), resourcesDir);
    const destRuleSetsPath = path.resolve(process.cwd(), destRuleSetsDir);

    ensureDirSync(filtersPath);
    ensureDirSync(destRuleSetsPath);

    const filtersPaths = new Map<number, string>();

    const files = fs.readdirSync(filtersPath);
    const filters = files
        .map((filePath: string) => {
            console.info(`Parsing ${filePath}...`);
            const index = getIdFromFilterName(filePath);

            if (!index) {
                console.info(`${filePath} skipped`);
                return null;
            }

            const filterId = Number(index);

            filtersPaths.set(filterId, filePath);
            const data = fs.readFileSync(
                path.resolve(filtersPath, filePath),
                { encoding: 'utf-8' },
            );

            console.info(`Preparing filter #${filterId} to convert`);

            return new Filter(
                filterId,
                { getContent: async () => FilterListPreprocessor.preprocess(data) },
                // we consider that all preinstalled filters are trusted
                true,
            );
        })
        .filter((filter): filter is Filter => filter !== null);

    const convertedRuleSets: IRuleSet[] = [];
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

    for (let i = 0; i < filters.length; i += 1) {
        const filter = filters[i];

        // eslint-disable-next-line no-await-in-loop
        const converted = await converter.convertStaticRuleSet(
            filter,
            { resourcesPath },
        );

        convertedRuleSets.push(converted.ruleSet);
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

    console.log('======================================');
    console.log('Common info');
    console.log('======================================');

    console.log(`Converted rule sets: ${convertedRuleSets.length}`);

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

    const metadataRuleSet = new MetadataRuleSet();

    for (let i = 0; i < convertedRuleSets.length; i += 1) {
        const ruleSet = convertedRuleSets[i];
        const id = ruleSet.getId();

        const ruleSetDir = path.join(destRuleSetsPath, getRuleSetId(id));
        ensureDirSync(ruleSetDir);

        // eslint-disable-next-line no-await-in-loop
        const result = await ruleSet.serializeCompact(prettifyJson);
        const ruleSetPath = getRuleSetPath(id, destRuleSetsPath);
        // eslint-disable-next-line no-await-in-loop
        await fs.promises.writeFile(ruleSetPath, result);

        metadataRuleSet.setChecksum(id, generateMD5Hash(result));

        console.log('===============================================');
        console.info(`Rule set with id ${id} and all rule set info`);
        console.info('(counters, source map, filter list) was saved');
        console.info(`to ${ruleSetPath}`);
        console.log('===============================================');
    }

    const metadataRulesetId = metadataRuleSet.getId();
    const metadataRulesetDir = path.join(destRuleSetsPath, getRuleSetId(metadataRulesetId));
    ensureDirSync(metadataRulesetDir);

    const metadataRuleSetPath = getRuleSetPath(metadataRulesetId, destRuleSetsPath);
    await fs.promises.writeFile(
        metadataRuleSetPath,
        metadataRuleSet.serialize(prettifyJson),
    );

    console.log('===============================================');
    console.info(`Metadata ruleset saved to ${metadataRuleSetPath}`);
    console.log('===============================================');
};
