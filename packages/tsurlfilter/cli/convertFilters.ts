/* eslint-disable no-console */
import path from 'path';
import fs from 'fs';

import {
    type ConversionResult,
    type IRuleSet,
    DeclarativeFilterConverter,
    Filter,
    METADATA_FILENAME,
    LAZY_METADATA_FILENAME,
} from '../src/rules/declarative-converter';

const ensureDirSync = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Converts filters with textual rules from the provided path to declarative
 * rule sets and saves them with counters, source map and list of source filter
 * identifiers on the specified path.
 *
 * @param filtersDir Path fo source filters.
 * @param resourcesDir Path to web accessible resources.
 * @param destRuleSetsDir Destination path for declarative rule sets.
 * @param debug Print debug information about conversion.
 */
export const convertFilters = async (
    filtersDir: string,
    resourcesDir: string,
    destRuleSetsDir: string,
    debug: boolean,
): Promise<void> => {
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
            const index = filePath.match(/\d+/);

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

            return new Filter(filterId, {
                getContent: async () => data.split(/\r?\n/),
            });
        })
        .filter((filter): filter is Filter => filter !== null);

    const convertedRuleSets: IRuleSet[] = [];
    let errors: ConversionResult['errors'] = [];
    let limitations: ConversionResult['limitations'] = [];

    const converter = new DeclarativeFilterConverter();

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

    for (let i = 0; i < convertedRuleSets.length; i += 1) {
        const ruleSet = convertedRuleSets[i];

        const {
            id,
            data,
            lazyData,
            // eslint-disable-next-line no-await-in-loop
        } = await ruleSet.serialize();

        // eslint-disable-next-line no-await-in-loop
        const declarativeRules = await ruleSet.getDeclarativeRules();

        const ruleSetDir = `${destRuleSetsPath}/${id}`;
        ensureDirSync(ruleSetDir);

        // eslint-disable-next-line no-await-in-loop
        await Promise.all([
            fs.promises.writeFile(`${ruleSetDir}/${id}.json`, JSON.stringify(declarativeRules, null, '\t')),
            fs.promises.writeFile(`${ruleSetDir}/${METADATA_FILENAME}`, data),
            fs.promises.writeFile(`${ruleSetDir}/${LAZY_METADATA_FILENAME}`, lazyData),
        ]);

        console.log('===============================================');
        console.info(`Rule set with id ${id} and all rule set info`);
        console.info('(counters, source map, filter list) was saved');
        console.info(`to ${destRuleSetsDir}/${id}`);
        console.log('===============================================');
    }
};
