import { getErrorMessage } from '../../common/error';
import { logger } from '../../utils/logger';

import { type DeclarativeRuleWithMetadata, metadataRuleValidator } from './metadata-rule';

const JSONParse = require('jsonparse');

export const extractMetadataRule = async (fileUrl: string): Promise<DeclarativeRuleWithMetadata> => {
    const parser = new JSONParse();
    let firstRule: unknown | null = null;

    // eslint-disable-next-line func-names
    parser.onValue = function (value: unknown): void {
        if (this.stack.length === 1 && firstRule === null) {
            firstRule = value;
        }
    };

    try {
        const response = await fetch(fileUrl);

        if (!response.body) {
            throw new Error('Response body is empty');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        while (!done && firstRule === null) {
            // eslint-disable-next-line no-await-in-loop
            const { done: isDone, value } = await reader.read();
            done = isDone;

            if (value) {
                // Feed the chunk into the JSON parser
                parser.write(decoder.decode(value, { stream: true }));
            }
        }

        if (firstRule === null) {
            throw new Error('No metadata rule found in the file');
        }

        const metadataRule = metadataRuleValidator.parse(firstRule);

        return metadataRule;
    } catch (e) {
        logger.error(
            `Error occurred while downloading file: ${fileUrl}. Got error: ${getErrorMessage(e)}`,
        );
        throw e;
    }
};
