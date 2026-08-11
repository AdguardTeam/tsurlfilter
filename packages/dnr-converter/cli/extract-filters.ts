/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
import fs from 'node:fs/promises';
import path from 'node:path';

import { METADATA_RULESET_ID, MetadataRuleset } from '../src/index';

import { LOCAL_METADATA_FILE_NAME } from './convert-filters';
import {
    ensureDir,
    extractRulesetId,
    findFiles,
    RULESET_FILE_EXT,
} from './utils';

/**
 * Extractor class for extracting text filters from rulesets.
 */
export class Extractor {
    /**
     * Extracts metadata from a JSON file and saves it to the specified output
     * path.
     *
     * @param jsonFilePath Path to the JSON file containing metadata.
     * @param outputPath Path to save the extracted metadata.
     */
    private static async extractMetadata(
        jsonFilePath: string,
        outputPath: string,
    ): Promise<void> {
        const rawJson = await fs.readFile(jsonFilePath, 'utf8');

        const metadataRuleset = MetadataRuleset.deserialize(rawJson);

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
     * Extracts text filters from rulesets and saves them to the specified
     * output path.
     *
     * @param rulesetsPath Path to the rulesets directory.
     * @param outputPath Path to save extracted filters.
     *
     * @throws Error if rulesetsPath is not a directory or if an error occurs
     * while reading or parsing files.
     */
    public static async extract(
        rulesetsPath: string,
        outputPath: string,
    ): Promise<void> {
        await ensureDir(outputPath);

        const rulesetsPaths = await findFiles(
            rulesetsPath,
            (filePath: string) => filePath.endsWith(RULESET_FILE_EXT),
        );

        for (const rulesetPath of rulesetsPaths) {
            const jsonFilePath = rulesetPath;

            try {
                const filterId = extractRulesetId(jsonFilePath);

                if (filterId === null) {
                    throw new Error(`Cannot extract ruleset id from ${jsonFilePath}`);
                }

                if (filterId === METADATA_RULESET_ID) {
                    await Extractor.extractMetadata(jsonFilePath, outputPath);
                    continue;
                }

                const data = await fs.readFile(jsonFilePath, 'utf8');
                const parsedRuleset = JSON.parse(data);

                if (!Array.isArray(parsedRuleset) || parsedRuleset.length === 0) {
                    console.log(`Ruleset ${jsonFilePath} is not an array or contains zero elements, skipping.`);
                    continue;
                }

                const { metadata } = parsedRuleset[0];

                if (!metadata) {
                    console.log(`Ruleset ${jsonFilePath} does not contain metadata, skipping.`);
                    continue;
                }

                const { filterContent } = metadata;

                const outputFileName = `filter_${filterId}.txt`;
                const outputFilePath = path.join(outputPath, outputFileName);
                await fs.writeFile(outputFilePath, filterContent);
                console.log(`Successfully extracted filter ${filterId} to ${outputFilePath}`);
            } catch (e) {
                console.error(`Error reading or parsing ${jsonFilePath}:`, e);
            }
        }
    }
}
