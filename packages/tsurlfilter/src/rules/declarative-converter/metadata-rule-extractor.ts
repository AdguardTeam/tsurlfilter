import { getErrorMessage } from '../../common/error';
import { logger } from '../../utils/logger';

import { type DeclarativeRuleWithMetadata, metadataRuleValidator } from './metadata-rule';
import { type MetadataRuleContent } from './metadata-rule-content';

/**
 * Extracts the metadata rule from the ruleset file at the given URL.
 *
 * @param fileUrl The URL of the file to extract the metadata rule from.
 *
 * @returns The extracted metadata rule.
 *
 * @throws If the file cannot be fetched.
 * @throws If the file contains invalid JSON.
 * @throws If the file does not contain a metadata rule or the metadata rule is invalid.
 */
export const extractMetadataRule = async (fileUrl: string): Promise<DeclarativeRuleWithMetadata> => {
    try {
        const response = await fetch(fileUrl);
        const text = await response.text();
        const parsed = JSON.parse(text);

        // Validate the first rule with the schema
        const metadataRule = metadataRuleValidator.parse(parsed[0]);
        return metadataRule;
    } catch (e) {
        logger.error(
            `Error occurred while extracting metadata rule from ruleset: ${fileUrl}. Got error: ${getErrorMessage(e)}`,
        );
        throw e;
    }
};

/**
 * Extracts the metadata rule from the ruleset file at the given URL.
 *
 * @param fileUrl The URL of the file to extract the metadata rule from.
 *
 * @returns The extracted metadata rule.
 *
 * @throws If the file cannot be fetched.
 * @throws If the file contains invalid JSON.
 * @throws If the file does not contain a metadata rule or the metadata rule is invalid.
 */
export const extractMetadataContent = async (fileUrl: string): Promise<MetadataRuleContent> => {
    const metadataRule = await extractMetadataRule(fileUrl);

    return metadataRule.metadata;
};
