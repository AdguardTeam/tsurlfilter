/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
import { promises as fs } from 'fs';
import path from 'path';
import { ensureDirSync, findFiles } from './utils';
import { METADATA_RULESET_ID, MetadataRuleSet } from '../src/rules/declarative-converter';
import { LOCAL_METADATA_FILE_NAME } from './convertFilters';
import { FilterListPreprocessor } from '../src/filterlist/preprocessor/preprocessor';
import { extractRuleSetId, RULESET_FILE_EXT } from '../src/rules/declarative-converter-utils/rule-set-path';

/**
 * Extractor class for extracting text filters from rulesets.
 */
export class Extractor {
    /**
     * Extracts metadata from a JSON file and saves it to the specified output path.
     *
     * @param jsonFilePath Path to the JSON file containing metadata.
     * @param outputPath Path to save the extracted metadata.
     */
    private static async extractMetadata(
        jsonFilePath: string,
        outputPath: string,
    ): Promise<void> {
        const rawJson = await fs.readFile(jsonFilePath, 'utf8');

        const metadataRuleset = MetadataRuleSet.deserialize(rawJson);

        const metadata = metadataRuleset.getAdditionalProperty('metadata');

        if (!metadata) {
            throw new Error(`Metadata not found in ${jsonFilePath}`);
        }

        await fs.writeFile(
            path.join(outputPath, LOCAL_METADATA_FILE_NAME),
            JSON.stringify(metadata, null, 2),
        );
    }

    /**
     * Extracts text filters from rulesets and saves them to the specified output path.
     *
     * @param rulesetsPath Path to the rulesets directory.
     * @param outputPath Path to save extracted filters.
     *
     * @throws Error if rulesetsPath is not a directory or if an error occurs while reading or parsing files.
     */
    public static async extract(
        rulesetsPath: string,
        outputPath: string,
    ): Promise<void> {
        ensureDirSync(outputPath);

        const rulesetsPaths = await findFiles(
            rulesetsPath,
            (filePath: string) => filePath.endsWith(RULESET_FILE_EXT),
        );

        for (const rulesetPath of rulesetsPaths) {
            const jsonFilePath = rulesetPath;

            try {
                const filterId = extractRuleSetId(jsonFilePath);

                if (filterId === null) {
                    throw new Error(`Cannot extract ruleset id from ${jsonFilePath}`);
                }

                if (filterId === METADATA_RULESET_ID) {
                    await Extractor.extractMetadata(jsonFilePath, outputPath);
                    continue;
                }

                const data = await fs.readFile(jsonFilePath, 'utf8');
                const parsedRuleSet = JSON.parse(data);

                if (!Array.isArray(parsedRuleSet) || parsedRuleSet.length === 0) {
                    console.log(`Ruleset ${jsonFilePath} is not an array or contain zero elements, skipping.`);
                }

                const { metadata } = parsedRuleSet[0];

                if (!metadata) {
                    console.log(`Ruleset ${jsonFilePath} is not contain metadata, skipping.`);
                }

                const { conversionMap, rawFilterList } = metadata;

                const outputFileName = `filter_${filterId}.txt`;
                const outputFilePath = path.join(outputPath, outputFileName);
                const originalFilterListText = FilterListPreprocessor.getOriginalFilterListText({
                    rawFilterList,
                    conversionMap,
                });
                await fs.writeFile(outputFilePath, originalFilterListText);
                console.log(`Successfully extracted filter ${filterId} to ${outputFilePath}`);
            } catch (e) {
                console.error(`Error reading or parsing ${jsonFilePath}:`, e);
            }
        }
    }
}
