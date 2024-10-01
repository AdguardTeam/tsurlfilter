import JSONParse from 'jsonparse';

import { getErrorMessage } from '../../common/error';
import { logger } from '../../utils/logger';
import { isNull } from '../../utils/guards';

import { type DeclarativeRuleWithMetadata, metadataRuleValidator } from './metadata-rule';
import { type MetadataRuleContent } from './metadata-rule-content';

/**
 * Extracts the metadata rule from the ruleset file at the given URL.
 *
 * Rulesets are JSON files that contain an array of rules and metadata rule always comes first in the array.
 * This approach uses a streaming logic to extract the metadata rule from the file
 * without needing to load and parse the entire file, since rulesets files can be large, even more than 10MB.
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
    const parser = new JSONParse();
    let firstRule: unknown | null = null;

    // eslint-disable-next-line func-names
    parser.onValue = function (value: unknown): void {
        if (this.stack.length === 1 && isNull(firstRule)) {
            firstRule = value;
        }
    };

    try {
        const response = await fetch(fileUrl);

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        while (!done && isNull(firstRule)) {
            // eslint-disable-next-line no-await-in-loop
            const { done: isDone, value } = await reader.read();
            done = isDone;

            if (value) {
                // Feed the chunk into the JSON parser
                parser.write(decoder.decode(value, { stream: true }));
            }
        }

        if (isNull(firstRule)) {
            throw new Error('No metadata rule found in the file');
        }

        const metadataRule = metadataRuleValidator.parse(firstRule);

        return metadataRule;
    } catch (e) {
        logger.error(
            `Error occurred while extracting metadata rule from ruleset: ${fileUrl}. Got error: ${getErrorMessage(e)}`,
        );
        throw e;
    }
};

/**
 * Extracts the metadata content from the ruleset file at the given URL.
 *
 * Rulesets are JSON files that contain an array of rules and metadata rule always comes first in the array.
 * This approach uses a streaming logic to extract the metadata rule from the file
 * without needing to load and parse the entire file, since rulesets files can be large, even more than 10MB.
 *
 * It just a wrapper around {@link extractMetadataRule} to extract the metadata content from the metadata rule.
 *
 * @param fileUrl The URL of the file to extract the metadata content from.
 *
 * @returns The extracted metadata content.
 *
 * @throws If the file cannot be fetched.
 * @throws If the file contains invalid JSON.
 * @throws If the file does not contain a metadata rule or the metadata rule is invalid.
 */
export const extractMetadataContent = async (fileUrl: string): Promise<MetadataRuleContent> => {
    const metadataRule = await extractMetadataRule(fileUrl);

    return metadataRule.metadata;
};
