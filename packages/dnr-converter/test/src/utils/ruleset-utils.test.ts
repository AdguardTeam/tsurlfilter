import { describe, expect, it } from 'vitest';

import {
    extractRuleSetId,
    getRuleSetId,
    getRuleSetPath,
    RULESET_NAME_PREFIX,
} from '../../../src/utils/ruleset-utils';

describe('ruleset-utils', () => {
    describe('RULESET_NAME_PREFIX', () => {
        it('should be "ruleset_"', () => {
            expect(RULESET_NAME_PREFIX).toBe('ruleset_');
        });
    });

    describe('getRuleSetId', () => {
        it('should add prefix to numeric id', () => {
            expect(getRuleSetId(123)).toBe('ruleset_123');
        });

        it('should add prefix to string id', () => {
            expect(getRuleSetId('456')).toBe('ruleset_456');
        });

        it('should not duplicate prefix if already present', () => {
            expect(getRuleSetId('ruleset_789')).toBe('ruleset_789');
        });
    });

    describe('getRuleSetPath', () => {
        it('should return path with prefix and .json extension', () => {
            expect(getRuleSetPath('ruleset_123', '/filters'))
                .toBe('/filters/ruleset_123/ruleset_123.json');
        });

        it('should add prefix if missing', () => {
            expect(getRuleSetPath('123', '/filters'))
                .toBe('/filters/ruleset_123/ruleset_123.json');
        });

        it('should work with numeric input', () => {
            expect(getRuleSetPath(123, '/filters'))
                .toBe('/filters/ruleset_123/ruleset_123.json');
        });

        it('should work without base dir', () => {
            expect(getRuleSetPath('ruleset_1'))
                .toBe('ruleset_1/ruleset_1.json');
        });
    });

    describe('extractRuleSetId', () => {
        it('should extract numeric id from prefixed string', () => {
            expect(extractRuleSetId('ruleset_123')).toBe(123);
        });

        it('should extract numeric id from prefixed string with extension', () => {
            expect(extractRuleSetId('ruleset_456.json')).toBe(456);
        });

        it('should extract numeric id from path', () => {
            expect(extractRuleSetId('/filters/ruleset_456/ruleset_456.json')).toBe(456);
        });

        it('should return null for non-numeric id after prefix', () => {
            expect(extractRuleSetId('ruleset_abc')).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(extractRuleSetId('')).toBeNull();
        });

        it('should return null for numeric string without prefix', () => {
            expect(extractRuleSetId('123')).toBeNull();
        });

        it('should return null for path where last segment lacks prefix', () => {
            expect(extractRuleSetId('/filters/ruleset_456/not-a-ruleset_456.json')).toBeNull();
        });

        it('should return null for path with non-numeric id after prefix', () => {
            expect(extractRuleSetId('/filters/ruleset_abc/ruleset_abc.json')).toBeNull();
        });
    });
});
