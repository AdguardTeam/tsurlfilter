import { describe, expect, it } from 'vitest';

import { type DeclarativeRule } from '../../../src/declarative-rule';
import {
    EmptyDomainsError,
    EmptyResourcesError,
    InvalidDeclarativeRuleError,
    isConversionError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
} from '../../../src/errors/conversion-errors';
import { type Rule } from '../../../src/rule/rule';

describe('Conversion Errors', () => {
    const message = 'Test error message';
    const rule = {} as Rule;
    const declarativeRule = {} as DeclarativeRule;
    const reason = 'Test reason';

    describe('EmptyDomainsError', () => {
        it('should create an instance correctly', () => {
            const error = new EmptyDomainsError(message, rule, declarativeRule);

            expect(error).toBeInstanceOf(EmptyDomainsError);
            expect(error).toBeInstanceOf(InvalidDeclarativeRuleError); // inherited
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('EmptyDomainsError');
            expect(error.message).toBe(message);
            expect(error.rule).toBe(rule);
            expect(error.declarativeRule).toBe(declarativeRule);
            expect(error.reason).toBeUndefined();
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('EmptyResourcesError', () => {
        it('should create an instance correctly', () => {
            const error = new EmptyResourcesError(message, rule, declarativeRule);

            expect(error).toBeInstanceOf(EmptyResourcesError);
            expect(error).toBeInstanceOf(InvalidDeclarativeRuleError); // inherited
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('EmptyResourcesError');
            expect(error.message).toBe(message);
            expect(error.rule).toBe(rule);
            expect(error.declarativeRule).toBe(declarativeRule);
            expect(error.reason).toBeUndefined();
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('UnsupportedModifierError', () => {
        it('should create an instance correctly', () => {
            const error = new UnsupportedModifierError(message, rule);

            expect(error).toBeInstanceOf(UnsupportedModifierError);
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('UnsupportedModifierError');
            expect(error.message).toBe(message);
            expect(error.rule).toBe(rule);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('UnsupportedRegexpError', () => {
        it('should create an instance correctly', () => {
            const error = new UnsupportedRegexpError(message, rule, declarativeRule, reason);

            expect(error).toBeInstanceOf(UnsupportedRegexpError);
            expect(error).toBeInstanceOf(InvalidDeclarativeRuleError); // inherited
            expect(error).toBeInstanceOf(Error); // inherited
            expect(error.name).toBe('UnsupportedRegexpError');
            expect(error.message).toBe(message);
            expect(error.rule).toBe(rule);
            expect(error.declarativeRule).toBe(declarativeRule);
            expect(error.reason).toBe(reason);
            expect(error.cause).toBeUndefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('isConversionError', () => {
        it('returns true for ConversionError instances', () => {
            const errors = [
                new EmptyDomainsError(message, rule, declarativeRule),
                new EmptyResourcesError(message, rule, declarativeRule),
                new UnsupportedModifierError(message, rule),
                new UnsupportedRegexpError(message, rule, declarativeRule, reason),
            ];

            for (const error of errors) {
                expect(isConversionError(error)).toBe(true);
            }
        });

        it('returns false for non-ConversionError instances', () => {
            const nonConversionErrors = [
                new Error(message),
                { message },
                {
                    message,
                    rule,
                },
                {
                    message,
                    rule,
                    declarativeRule,
                },
                {
                    message,
                    rule,
                    declarativeRule,
                    reason,
                },
                null,
                undefined,
                42,
                'Not an error',
            ];

            for (const nonConversionError of nonConversionErrors) {
                expect(isConversionError(nonConversionError)).toBe(false);
            }
        });
    });
});
