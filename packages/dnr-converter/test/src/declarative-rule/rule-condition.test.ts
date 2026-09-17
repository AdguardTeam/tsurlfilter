import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
    DOMAIN_LIST_CONDITION_FIELDS,
    EXCLUSION_LIST_CONDITION_FIELDS,
    INCLUSION_LIST_CONDITION_FIELDS,
} from '../../../src/declarative-rule';
import { type RuleCondition, RuleConditionValidator } from '../../../src/declarative-rule/rule-condition';

describe('RuleCondition list fields', () => {
    it('groups fields by matching semantics', () => {
        expect(INCLUSION_LIST_CONDITION_FIELDS).toEqual([
            'initiatorDomains',
            'requestDomains',
            'resourceTypes',
            'requestMethods',
        ]);
        expect(EXCLUSION_LIST_CONDITION_FIELDS).toEqual([
            'excludedInitiatorDomains',
            'excludedRequestDomains',
            'excludedResourceTypes',
            'excludedRequestMethods',
        ]);
        expect(DOMAIN_LIST_CONDITION_FIELDS).toEqual([
            'initiatorDomains',
            'requestDomains',
            'excludedInitiatorDomains',
            'excludedRequestDomains',
        ]);
    });
});

describe('RuleConditionValidator', () => {
    it('accepts a condition with initiatorDomains and excludedInitiatorDomains', () => {
        const condition: RuleCondition = {
            urlFilter: 'example.com',
            initiatorDomains: ['example.com'],
            excludedInitiatorDomains: ['malicious.com'],
        };

        const result = v.safeParse(RuleConditionValidator, condition);

        expect(result.success).toBe(true);
    });

    it('rejects the removed deprecated `domains` key as unknown', () => {
        // `domains` is no longer part of RuleCondition; the strict validator
        // must reject it as an unknown key.
        const condition = {
            urlFilter: 'example.com',
            domains: ['example.com'],
        } as unknown as RuleCondition;

        const result = v.safeParse(RuleConditionValidator, condition);

        expect(result.success).toBe(false);
    });

    it('rejects the removed deprecated `excludedDomains` key as unknown', () => {
        const condition = {
            urlFilter: 'example.com',
            excludedDomains: ['malicious.com'],
        } as unknown as RuleCondition;

        const result = v.safeParse(RuleConditionValidator, condition);

        expect(result.success).toBe(false);
    });

    it('rejects empty initiatorDomains array', () => {
        const condition = {
            urlFilter: 'example.com',
            initiatorDomains: [],
        } as unknown as RuleCondition;

        const result = v.safeParse(RuleConditionValidator, condition);

        expect(result.success).toBe(false);
    });
});

// Compile-time regression guard: `domains` / `excludedDomains` must no longer
// be assignable to RuleCondition. If either key is re-added, the directives
// on the two object literals below will trigger "Unused @ts-expect-error"
// from TypeScript, causing lint:types to fail.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const compileTimeCheck = (): RuleCondition[] => {
    // @ts-expect-error `domains` is removed from RuleCondition
    const withDomains: RuleCondition = { urlFilter: 'x', domains: ['a'] };
    // @ts-expect-error `excludedDomains` is removed from RuleCondition
    const withExcludedDomains: RuleCondition = { urlFilter: 'x', excludedDomains: ['a'] };
    // Return both bindings so neither is flagged as unused by
    // @typescript-eslint/no-unused-vars (the eslint-disable above only covers
    // the _compileTimeCheck declaration line, not the function body).
    return [withDomains, withExcludedDomains];
};
