/**
 * @file Tests for redirect_resource validator.
 */

import { describe, expect, test } from 'vitest';

import { Platform } from '../../../src/compatibility-tables';
import { modifiersCompatibilityTable } from '../../../src/compatibility-tables/modifiers';
import { ValidationContext } from '../../../src/compatibility-tables/validators/validation-context';

/**
 * Helper: validate a modifier string and return the context.
 *
 * @param raw Raw modifier string, e.g. 'redirect=noopjs'.
 * @param platform Platform to validate against.
 *
 * @returns The validation context after validation.
 */
const validateModifier = (
    raw: string,
    platform: Platform = Platform.AdgOsWindows,
): ValidationContext => {
    const ctx = new ValidationContext();
    modifiersCompatibilityTable.validate(raw, ctx, platform);
    return ctx;
};

describe('redirect_resource validator', () => {
    describe('ADG platform', () => {
        test('valid redirect name', () => {
            const ctx = validateModifier('redirect=noopjs', Platform.AdgOsWindows);
            expect(ctx.valid).toBe(true);
        });

        test('valid redirect by alias', () => {
            const ctx = validateModifier('redirect=noop.js', Platform.AdgOsWindows);
            expect(ctx.valid).toBe(true);
        });

        test('invalid redirect name', () => {
            const ctx = validateModifier('redirect=nonexistent-resource', Platform.AdgOsWindows);
            expect(ctx.valid).toBe(false);
        });

        test('redirect without value is valid (value_optional)', () => {
            const ctx = validateModifier('redirect', Platform.AdgOsWindows);
            expect(ctx.valid).toBe(true);
        });
    });

    describe('uBO platform', () => {
        test('valid uBO redirect name', () => {
            const ctx = validateModifier('redirect=noop.js', Platform.UboExtChrome);
            expect(ctx.valid).toBe(true);
        });

        test('valid uBO redirect with priority suffix', () => {
            const ctx = validateModifier('redirect=noop.js:99', Platform.UboExtChrome);
            expect(ctx.valid).toBe(true);
        });

        test('valid uBO redirect with negative priority', () => {
            const ctx = validateModifier('redirect=noop.js:-1', Platform.UboExtChrome);
            expect(ctx.valid).toBe(true);
        });

        test('non-numeric suffix is not stripped', () => {
            const ctx = validateModifier('redirect=noop.js:abc', Platform.UboExtChrome);
            expect(ctx.valid).toBe(false);
        });

        test('uBO-only redirect fails for ADG', () => {
            const ctx = validateModifier('redirect=hd-main.js', Platform.AdgOsWindows);
            expect(ctx.valid).toBe(false);
        });
    });

    describe('ABP platform', () => {
        test('valid ABP redirect with abp-resource: prefix', () => {
            const ctx = validateModifier('rewrite=abp-resource:blank-js', Platform.AbpExtChrome);
            expect(ctx.valid).toBe(true);
        });

        test('invalid ABP redirect', () => {
            const ctx = validateModifier('rewrite=abp-resource:nonexistent', Platform.AbpExtChrome);
            expect(ctx.valid).toBe(false);
        });
    });

    describe('redirect-rule modifier', () => {
        test('valid redirect-rule value', () => {
            const ctx = validateModifier('redirect-rule=noopjs', Platform.AdgOsWindows);
            expect(ctx.valid).toBe(true);
        });

        test('invalid redirect-rule value', () => {
            const ctx = validateModifier('redirect-rule=nonexistent', Platform.AdgOsWindows);
            expect(ctx.valid).toBe(false);
        });

        test('redirect-rule without value is valid (value_optional)', () => {
            const ctx = validateModifier('redirect-rule', Platform.AdgOsWindows);
            expect(ctx.valid).toBe(true);
        });
    });
});
