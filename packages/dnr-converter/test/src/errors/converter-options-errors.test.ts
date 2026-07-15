import { describe, expect, it } from 'vitest';

import {
    EmptyOrNegativeNumberOfRulesError,
    isConverterOptionsError,
    NegativeNumberOfRulesError,
    ResourcesPathError,
} from '../../../src/errors/converter-options-errors';

describe('Converter Options Errors', () => {
    const message = 'Test error message';

    describe('EmptyOrNegativeNumberOfRulesError', () => {
        it('should create an instance correctly', () => {
            const error = new EmptyOrNegativeNumberOfRulesError(message);

            expect(error).toBeInstanceOf(EmptyOrNegativeNumberOfRulesError);
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('EmptyOrNegativeNumberOfRulesError');
            expect(error.message).toBe(message);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('NegativeNumberOfRulesError', () => {
        it('should create an instance correctly', () => {
            const error = new NegativeNumberOfRulesError(message);

            expect(error).toBeInstanceOf(NegativeNumberOfRulesError);
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('NegativeNumberOfRulesError');
            expect(error.message).toBe(message);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('ResourcesPathError', () => {
        it('should create an instance correctly', () => {
            const error = new ResourcesPathError(message);

            expect(error).toBeInstanceOf(ResourcesPathError);
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('ResourcesPathError');
            expect(error.message).toBe(message);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('isConverterOptionsError', () => {
        it('returns true for ConverterOptionsError instances', () => {
            const errors = [
                new EmptyOrNegativeNumberOfRulesError(message),
                new NegativeNumberOfRulesError(message),
                new ResourcesPathError(message),
            ];

            for (const error of errors) {
                expect(isConverterOptionsError(error)).toBe(true);
            }
        });

        it('returns false for non-ConverterOptionsError instances', () => {
            const nonConverterOptionsErrors = [
                new Error(message),
                { message },
                null,
                undefined,
                42,
                'Not an error',
            ];

            for (const nonConverterOptionsError of nonConverterOptionsErrors) {
                expect(isConverterOptionsError(nonConverterOptionsError)).toBe(false);
            }
        });
    });
});
