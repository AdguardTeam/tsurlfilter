import { describe, expect, it } from 'vitest';

import {
    isLimitationError,
    MaxScannedRulesError,
    TooManyError,
    TooManyRegexpRulesError,
    TooManyRulesError,
    TooManyUnsafeRulesError,
} from '../../../src/errors/limitation-errors';

describe('Limitation Errors', () => {
    const message = 'Test error message';
    const lineIndex = 42;
    const excludedRulesIds = [1, 2, 3];
    const numberOfMaximumRules = 100;
    const numberOfExcludedDeclarativeRules = 10;

    describe('MaxScannedRulesError', () => {
        it('should create an instance correctly', () => {
            const error = new MaxScannedRulesError(message, lineIndex);

            expect(error).toBeInstanceOf(MaxScannedRulesError);
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('MaxScannedRulesError');
            expect(error.message).toBe(message);
            expect(error.lineIndex).toBe(lineIndex);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('TooManyRegexpRulesError', () => {
        it('should create an instance correctly', () => {
            const error = new TooManyRegexpRulesError(
                message,
                excludedRulesIds,
                numberOfMaximumRules,
                numberOfExcludedDeclarativeRules,
            );

            expect(error).toBeInstanceOf(TooManyRegexpRulesError);
            expect(error).toBeInstanceOf(TooManyError); // inherited
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('TooManyRegexpRulesError');
            expect(error.message).toBe(message);
            expect(error.excludedRulesIds).toBe(excludedRulesIds);
            expect(error.numberOfMaximumRules).toBe(numberOfMaximumRules);
            expect(error.numberOfExcludedDeclarativeRules).toBe(numberOfExcludedDeclarativeRules);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('TooManyRulesError', () => {
        it('should create an instance correctly', () => {
            const error = new TooManyRulesError(
                message,
                excludedRulesIds,
                numberOfMaximumRules,
                numberOfExcludedDeclarativeRules,
            );

            expect(error).toBeInstanceOf(TooManyRulesError);
            expect(error).toBeInstanceOf(TooManyError); // inherited
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('TooManyRulesError');
            expect(error.message).toBe(message);
            expect(error.excludedRulesIds).toBe(excludedRulesIds);
            expect(error.numberOfMaximumRules).toBe(numberOfMaximumRules);
            expect(error.numberOfExcludedDeclarativeRules).toBe(numberOfExcludedDeclarativeRules);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('TooManyUnsafeRulesError', () => {
        it('should create an instance correctly', () => {
            const error = new TooManyUnsafeRulesError(
                message,
                excludedRulesIds,
                numberOfMaximumRules,
                numberOfExcludedDeclarativeRules,
            );

            expect(error).toBeInstanceOf(TooManyUnsafeRulesError);
            expect(error).toBeInstanceOf(TooManyError); // inherited
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('TooManyUnsafeRulesError');
            expect(error.message).toBe(message);
            expect(error.excludedRulesIds).toBe(excludedRulesIds);
            expect(error.numberOfMaximumRules).toBe(numberOfMaximumRules);
            expect(error.numberOfExcludedDeclarativeRules).toBe(numberOfExcludedDeclarativeRules);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('isLimitationError', () => {
        it('returns true for LimitationError instances', () => {
            const errors = [
                new MaxScannedRulesError(message, lineIndex),
                new TooManyRegexpRulesError(
                    message,
                    excludedRulesIds,
                    numberOfMaximumRules,
                    numberOfExcludedDeclarativeRules,
                ),
                new TooManyRulesError(
                    message,
                    excludedRulesIds,
                    numberOfMaximumRules,
                    numberOfExcludedDeclarativeRules,
                ),
                new TooManyUnsafeRulesError(
                    message,
                    excludedRulesIds,
                    numberOfMaximumRules,
                    numberOfExcludedDeclarativeRules,
                ),
            ];

            for (const error of errors) {
                expect(isLimitationError(error)).toBe(true);
            }
        });

        it('returns false for non-LimitationError instances', () => {
            const nonLimitationErrors = [
                new Error(message),
                { message },
                {
                    message,
                    lineIndex,
                },
                {
                    message,
                    excludedRulesIds,
                    numberOfMaximumRules,
                    numberOfExcludedDeclarativeRules,
                },
                null,
                undefined,
                42,
                'Not an error',
            ];

            for (const nonLimitationError of nonLimitationErrors) {
                expect(isLimitationError(nonLimitationError)).toBe(false);
            }
        });
    });
});
