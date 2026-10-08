import { describe, expect, it } from 'vitest';

import { Platform, redirectsCompatibilityTable } from '../../src/compatibility-tables';
import { ValidationContext } from '../../src/compatibility-tables/validators/validation-context';

const baseNoopJsData = {
    name: 'noopjs',
    aliases: ['noop.js', 'blank-js'],
    // ...
};

describe('Redirects Compatibility Table', () => {
    it('redirectsCompatibilityTable.has', () => {
        expect(redirectsCompatibilityTable.has('noopjs')).toBeTruthy();
        expect(redirectsCompatibilityTable.has('noopjs:99')).toBeTruthy();
        expect(redirectsCompatibilityTable.has('noopjs:-1')).toBeTruthy();
        expect(redirectsCompatibilityTable.has('blank-js')).toBeTruthy();

        expect(redirectsCompatibilityTable.has('nonexistent')).toBeFalsy();
    });

    it('redirectsCompatibilityTable.supports', () => {
        expect(redirectsCompatibilityTable.supports('noopjs', Platform.AdgExtChrome)).toBeTruthy();
        expect(redirectsCompatibilityTable.supports('nonexistent', Platform.AbpExtChrome)).toBeFalsy();

        expect(redirectsCompatibilityTable.supports('noopjs', Platform.AdgExtAny)).toBeTruthy();
        expect(redirectsCompatibilityTable.supports('nonexistent', Platform.AbpExtAny)).toBeFalsy();
    });

    it('redirectsCompatibilityTable.get', () => {
        expect(
            redirectsCompatibilityTable.get('noopjs', Platform.AdgExtChrome),
        ).toMatchObject(baseNoopJsData);

        expect(redirectsCompatibilityTable.get('nonexistent', Platform.AbpExtChrome)).toBeNull();
    });

    it('redirectsCompatibilityTable.queryAll', () => {
        const results = redirectsCompatibilityTable.queryAll('noopjs', Platform.AdgExtAny);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toMatchObject(baseNoopJsData);

        expect(redirectsCompatibilityTable.queryAll('nonexistent', Platform.AdgExtAny)).toEqual([]);
    });

    describe('redirectsCompatibilityTable.validate', () => {
        it('valid redirect passes', () => {
            const ctx = new ValidationContext();
            redirectsCompatibilityTable.validate('noopjs', ctx, Platform.AdgExtChrome);
            expect(ctx.valid).toBe(true);
        });

        it('unknown redirect fails', () => {
            const ctx = new ValidationContext();
            redirectsCompatibilityTable.validate('nonexistent', ctx, Platform.AdgExtChrome);
            expect(ctx.valid).toBe(false);
        });

        it('valid redirect passes with a product-level wildcard', () => {
            const ctx = new ValidationContext();
            redirectsCompatibilityTable.validate('noopjs', ctx, Platform.AdgAny);
            expect(ctx.valid).toBe(true);
        });

        it('valid redirect passes with the any-product wildcard', () => {
            const ctx = new ValidationContext();
            redirectsCompatibilityTable.validate('noopjs', ctx, Platform.Any);
            expect(ctx.valid).toBe(true);
        });

        it('throws when the platform is omitted', () => {
            const ctx = new ValidationContext();
            expect(() => redirectsCompatibilityTable.validate('noopjs', ctx)).toThrow(/platform/i);
        });
    });

    describe('googlesyndication-adsbygoogle redirect', () => {
        const REDIRECT_ALIAS = 'googlesyndication.com/adsbygoogle.js';
        const REDIRECT_ALIAS_UNDERSCORE = 'googlesyndication_adsbygoogle.js';
        const REDIRECT_ALIAS_UBO_PREFIX = 'ubo-googlesyndication.com/adsbygoogle.js';
        const EXPECTED_ADG_NAME = 'googlesyndication-adsbygoogle';

        it('should resolve googlesyndication.com/adsbygoogle.js alias for ADG platform', () => {
            // This alias is used in uBO syntax and should be resolved to ADG redirect name
            expect(redirectsCompatibilityTable.has(REDIRECT_ALIAS)).toBeTruthy();
            expect(
                redirectsCompatibilityTable.supports(REDIRECT_ALIAS, Platform.AdgAny),
            ).toBeTruthy();

            const adgData = redirectsCompatibilityTable.query(
                REDIRECT_ALIAS,
                Platform.AdgAny,
            );
            expect(adgData).not.toBeNull();
            expect(adgData?.name).toBe(EXPECTED_ADG_NAME);
        });

        it('should resolve googlesyndication_adsbygoogle.js alias for ADG platform', () => {
            expect(
                redirectsCompatibilityTable.supports(REDIRECT_ALIAS_UNDERSCORE, Platform.AdgAny),
            ).toBeTruthy();

            const adgData = redirectsCompatibilityTable.query(
                REDIRECT_ALIAS_UNDERSCORE,
                Platform.AdgAny,
            );
            expect(adgData).not.toBeNull();
            expect(adgData?.name).toBe(EXPECTED_ADG_NAME);
        });

        it('should resolve ubo-googlesyndication.com/adsbygoogle.js alias for ADG platform', () => {
            expect(
                redirectsCompatibilityTable.supports(REDIRECT_ALIAS_UBO_PREFIX, Platform.AdgAny),
            ).toBeTruthy();

            const adgData = redirectsCompatibilityTable.query(
                REDIRECT_ALIAS_UBO_PREFIX,
                Platform.AdgAny,
            );
            expect(adgData).not.toBeNull();
            expect(adgData?.name).toBe(EXPECTED_ADG_NAME);
        });
    });

    // TODO: Add more tests
});
