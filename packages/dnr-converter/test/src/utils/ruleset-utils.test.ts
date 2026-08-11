import { describe, expect, it } from 'vitest';

import {
    extractRulesetId,
    getRulesetId,
    getRulesetPath,
    RULESET_NAME_PREFIX,
} from '../../../src/utils/ruleset-utils';

describe('ruleset-utils', () => {
    describe('RULESET_NAME_PREFIX', () => {
        it('should be "ruleset_"', () => {
            expect(RULESET_NAME_PREFIX).toBe('ruleset_');
        });
    });

    describe('getRulesetId', () => {
        it('should add prefix to numeric id', () => {
            expect(getRulesetId(123)).toBe('ruleset_123');
        });

        it('should add prefix to string id', () => {
            expect(getRulesetId('456')).toBe('ruleset_456');
        });

        it('should not duplicate prefix if already present', () => {
            expect(getRulesetId('ruleset_789')).toBe('ruleset_789');
        });
    });

    describe('getRulesetPath', () => {
        it('should return path with prefix and .json extension', () => {
            expect(getRulesetPath('ruleset_123', '/filters'))
                .toBe('/filters/ruleset_123/ruleset_123.json');
        });

        it('should add prefix if missing', () => {
            expect(getRulesetPath('123', '/filters'))
                .toBe('/filters/ruleset_123/ruleset_123.json');
        });

        it('should work with numeric input', () => {
            expect(getRulesetPath(123, '/filters'))
                .toBe('/filters/ruleset_123/ruleset_123.json');
        });

        it('should work without base dir', () => {
            expect(getRulesetPath('ruleset_1'))
                .toBe('ruleset_1/ruleset_1.json');
        });
    });

    describe('extractRulesetId', () => {
        it('should extract numeric id from prefixed string', () => {
            expect(extractRulesetId('ruleset_123')).toBe(123);
        });

        it('should extract numeric id from prefixed string with extension', () => {
            expect(extractRulesetId('ruleset_456.json')).toBe(456);
        });

        it('should extract numeric id from path', () => {
            expect(extractRulesetId('/filters/ruleset_456/ruleset_456.json')).toBe(456);
        });

        it('should return null for non-numeric id after prefix', () => {
            expect(extractRulesetId('ruleset_abc')).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(extractRulesetId('')).toBeNull();
        });

        it('should return null for numeric string without prefix', () => {
            expect(extractRulesetId('123')).toBeNull();
        });

        it('should return null for path where last segment lacks prefix', () => {
            expect(extractRulesetId('/filters/ruleset_456/not-a-ruleset_456.json')).toBeNull();
        });

        it('should return null for path with non-numeric id after prefix', () => {
            expect(extractRulesetId('/filters/ruleset_abc/ruleset_abc.json')).toBeNull();
        });
    });
});
