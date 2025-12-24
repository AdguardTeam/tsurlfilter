import { describe, it, expect } from 'vitest';

import { redirectsCompatibilityTable } from '../../src/compatibility-tables/redirects';
import { GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platforms';

const baseNoopJsData = {
    name: 'noopjs',
    aliases: ['noop.js', 'blank-js'],
    // ...
};

describe('Redirects Compatibility Table', () => {
    it('redirectsCompatibilityTable.existsAny', () => {
        expect(redirectsCompatibilityTable.existsAny('noopjs')).toBeTruthy();
        expect(redirectsCompatibilityTable.existsAny('noopjs:99')).toBeTruthy();
        expect(redirectsCompatibilityTable.existsAny('noopjs:-1')).toBeTruthy();
        expect(redirectsCompatibilityTable.existsAny('blank-js')).toBeTruthy();

        expect(redirectsCompatibilityTable.existsAny('nonexistent')).toBeFalsy();
    });

    it('redirectsCompatibilityTable.exists', () => {
        expect(redirectsCompatibilityTable.exists('noopjs', SpecificPlatform.AdgExtChrome)).toBeTruthy();
        expect(redirectsCompatibilityTable.exists('nonexistent', SpecificPlatform.AbpExtChrome)).toBeFalsy();

        expect(redirectsCompatibilityTable.exists('noopjs', GenericPlatform.AdgExtAny)).toBeTruthy();
        expect(redirectsCompatibilityTable.exists('nonexistent', GenericPlatform.AbpExtAny)).toBeFalsy();
    });

    it('redirectsCompatibilityTable.getSingle', () => {
        expect(
            redirectsCompatibilityTable.getSingle('noopjs', SpecificPlatform.AdgExtChrome),
        ).toMatchObject(baseNoopJsData);

        expect(redirectsCompatibilityTable.getSingle('nonexistent', SpecificPlatform.AbpExtChrome)).toBeNull();
    });

    it('redirectsCompatibilityTable.getMultiple', () => {
        expect(redirectsCompatibilityTable.getMultiple('noopjs', GenericPlatform.AdgExtAny)).toMatchObject({
            [SpecificPlatform.AdgExtChrome]: baseNoopJsData,
            [SpecificPlatform.AdgExtOpera]: baseNoopJsData,
            [SpecificPlatform.AdgExtEdge]: baseNoopJsData,
            [SpecificPlatform.AdgExtFirefox]: baseNoopJsData,
        });

        expect(redirectsCompatibilityTable.getMultiple('nonexistent', GenericPlatform.AdgExtAny)).toBeNull();
    });

    describe('googlesyndication-adsbygoogle redirect', () => {
        const REDIRECT_ALIAS = 'googlesyndication.com/adsbygoogle.js';
        const REDIRECT_ALIAS_UNDERSCORE = 'googlesyndication_adsbygoogle.js';
        const REDIRECT_ALIAS_UBO_PREFIX = 'ubo-googlesyndication.com/adsbygoogle.js';
        const EXPECTED_ADG_NAME = 'googlesyndication-adsbygoogle';

        it('should resolve googlesyndication.com/adsbygoogle.js alias for ADG platform', () => {
            // This alias is used in uBO syntax and should be resolved to ADG redirect name
            expect(redirectsCompatibilityTable.existsAny(REDIRECT_ALIAS)).toBeTruthy();
            expect(
                redirectsCompatibilityTable.exists(REDIRECT_ALIAS, GenericPlatform.AdgAny),
            ).toBeTruthy();

            const adgData = redirectsCompatibilityTable.getFirst(
                REDIRECT_ALIAS,
                GenericPlatform.AdgAny,
            );
            expect(adgData).not.toBeNull();
            expect(adgData?.name).toBe(EXPECTED_ADG_NAME);
        });

        it('should resolve googlesyndication_adsbygoogle.js alias for ADG platform', () => {
            expect(
                redirectsCompatibilityTable.exists(REDIRECT_ALIAS_UNDERSCORE, GenericPlatform.AdgAny),
            ).toBeTruthy();

            const adgData = redirectsCompatibilityTable.getFirst(
                REDIRECT_ALIAS_UNDERSCORE,
                GenericPlatform.AdgAny,
            );
            expect(adgData).not.toBeNull();
            expect(adgData?.name).toBe(EXPECTED_ADG_NAME);
        });

        it('should resolve ubo-googlesyndication.com/adsbygoogle.js alias for ADG platform', () => {
            expect(
                redirectsCompatibilityTable.exists(REDIRECT_ALIAS_UBO_PREFIX, GenericPlatform.AdgAny),
            ).toBeTruthy();

            const adgData = redirectsCompatibilityTable.getFirst(
                REDIRECT_ALIAS_UBO_PREFIX,
                GenericPlatform.AdgAny,
            );
            expect(adgData).not.toBeNull();
            expect(adgData?.name).toBe(EXPECTED_ADG_NAME);
        });
    });

    // TODO: Add more tests
});
