import { describe, expect, it } from 'vitest';

import { InvalidMetadataChunksError } from '../../../src/errors/metadata-errors';

describe('Metadata Errors', () => {
    describe('InvalidMetadataChunksError', () => {
        it('should create an instance correctly', () => {
            const cause = new SyntaxError('bad json');
            const error = new InvalidMetadataChunksError('ruleset_1', 'something is wrong', cause);

            expect(error).toBeInstanceOf(InvalidMetadataChunksError);
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('InvalidMetadataChunksError');
            expect(error.message).toBe("Cannot read metadata of rule set 'ruleset_1': something is wrong");
            expect(error.rulesetId).toBe('ruleset_1');
            expect(error.cause).toBe(cause);
            expect(error.stack).toBeDefined();
        });

        it('leaves cause undefined when not provided', () => {
            const error = new InvalidMetadataChunksError('ruleset_2', 'reason');

            expect(error.cause).toBeUndefined();
            expect(error.rulesetId).toBe('ruleset_2');
        });
    });
});
