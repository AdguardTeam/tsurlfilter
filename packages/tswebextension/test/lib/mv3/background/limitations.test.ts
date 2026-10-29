import { describe, expect, it } from 'vitest';

import { TooManyRegexpRulesError, TooManyRulesError, TooManyUnsafeRulesError } from '@adguard/dnr-converter';

import { mergeLimitations } from '../../../../src/lib/mv3/background/limitations';

describe('mergeLimitations', () => {
    it('merges errors of the same class into one', () => {
        const first = new TooManyUnsafeRulesError('first', [1, 2], 5000, 2);
        const second = new TooManyUnsafeRulesError('second', [3], 5000, 1);

        const result = mergeLimitations([first, second]);

        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(TooManyUnsafeRulesError);
        expect((result[0] as TooManyUnsafeRulesError).excludedRulesIds).toEqual([1, 2, 3]);
        expect((result[0] as TooManyUnsafeRulesError).numberOfExcludedDeclarativeRules).toBe(3);
        expect((result[0] as TooManyUnsafeRulesError).numberOfMaximumRules).toBe(5000);
    });

    it('keeps errors of different classes apart', () => {
        const result = mergeLimitations([
            new TooManyUnsafeRulesError('unsafe', [1], 5000, 1),
            new TooManyRegexpRulesError('regexp', [2], 1000, 1),
            new TooManyRulesError('total', [3], 30000, 1),
        ]);

        expect(result).toHaveLength(3);
        expect(result.map((error) => error.constructor.name)).toEqual([
            'TooManyUnsafeRulesError',
            'TooManyRegexpRulesError',
            'TooManyRulesError',
        ]);
    });

    it('keeps the order of the first occurrence', () => {
        const result = mergeLimitations([
            new TooManyRulesError('total', [1], 30000, 1),
            new TooManyUnsafeRulesError('unsafe', [2], 5000, 1),
            new TooManyRulesError('total again', [3], 30000, 2),
        ]);

        expect(result).toHaveLength(2);
        expect(result[0]).toBeInstanceOf(TooManyRulesError);
        expect((result[0] as TooManyRulesError).excludedRulesIds).toEqual([1, 3]);
        expect((result[0] as TooManyRulesError).numberOfExcludedDeclarativeRules).toBe(3);
        expect(result[1]).toBeInstanceOf(TooManyUnsafeRulesError);
    });

    it('does not mutate the source errors', () => {
        const first = new TooManyUnsafeRulesError('first', [1], 5000, 1);
        const second = new TooManyUnsafeRulesError('second', [2], 5000, 1);

        mergeLimitations([first, second]);

        expect(first.excludedRulesIds).toEqual([1]);
        expect(first.numberOfExcludedDeclarativeRules).toBe(1);
    });

    it('keeps a single error of a class as is', () => {
        const error = new TooManyUnsafeRulesError('single', [1], 5000, 1);

        const result = mergeLimitations([error]);

        expect(result).toEqual([error]);
    });
});
