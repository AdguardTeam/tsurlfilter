/**
 * @file Name lookups resolve against the entry of the platform, not the whole feature row (F-025).
 */

import { describe, expect, it } from 'vitest';

import {
    modifiersCompatibilityTable,
    Platform,
    redirectsCompatibilityTable,
    scriptletsCompatibilityTable,
} from '../../src/compatibility-tables';
import { GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platform-compat';

describe('Name lookups are pinned to the platform entry', () => {
    describe('modifiers', () => {
        it('does not resolve a name that only another product declares', () => {
            // `rewrite` is an ABP modifier, AdGuard calls it `redirect`
            expect(modifiersCompatibilityTable.supports('rewrite', Platform.AbpExtChrome)).toBe(true);
            expect(modifiersCompatibilityTable.supports('rewrite', Platform.AdgExtChrome)).toBe(false);
            expect(modifiersCompatibilityTable.supports('rewrite', Platform.AdgAny)).toBe(false);
            expect(modifiersCompatibilityTable.get('rewrite', Platform.AdgExtChrome)).toBeNull();
            expect(modifiersCompatibilityTable.queryAll('rewrite', Platform.AdgAny)).toEqual([]);
            expect(modifiersCompatibilityTable.query('rewrite', Platform.AdgAny)).toBeNull();

            // `redirect` is not an ABP modifier
            expect(modifiersCompatibilityTable.supports('redirect', Platform.AdgExtChrome)).toBe(true);
            expect(modifiersCompatibilityTable.supports('redirect', Platform.AbpExtChrome)).toBe(false);
            expect(modifiersCompatibilityTable.queryAll('redirect', Platform.AbpAny)).toEqual([]);
        });

        it('resolves a name declared as an alias by the platform entry', () => {
            expect(modifiersCompatibilityTable.supports('3p', Platform.AdgExtChrome)).toBe(true);
            expect(modifiersCompatibilityTable.get('3p', Platform.AdgExtChrome)?.name).toBe('third-party');
            expect(modifiersCompatibilityTable.queryAll('3p', Platform.AdgExtAny)).toHaveLength(1);
        });

        it('does not resolve an alias on a product whose entry does not declare it', () => {
            // `ghide` is an alias of `generichide` for AdGuard and uBO, but not for ABP
            expect(modifiersCompatibilityTable.supports('ghide', Platform.UboExtChrome)).toBe(true);
            expect(modifiersCompatibilityTable.supports('ghide', Platform.AdgExtChrome)).toBe(true);
            expect(modifiersCompatibilityTable.supports('ghide', Platform.AbpAny)).toBe(false);
            expect(modifiersCompatibilityTable.supports('generichide', Platform.AbpAny)).toBe(true);
        });

        it('keeps the noop modifier working', () => {
            expect(modifiersCompatibilityTable.supports('____', Platform.AdgExtChrome)).toBe(true);
            expect(modifiersCompatibilityTable.supports('_', Platform.UboExtChrome)).toBe(true);
        });

        it('lists a feature only under the names the platform declares', () => {
            const adg = modifiersCompatibilityTable.getAll(Platform.AdgExtChrome);
            const abp = modifiersCompatibilityTable.getAll(Platform.AbpExtChrome);

            expect(adg.has('third-party')).toBe(true);
            expect(adg.has('3p')).toBe(true);
            expect(adg.has('rewrite')).toBe(false);
            expect(abp.has('rewrite')).toBe(true);
            expect(abp.has('redirect')).toBe(false);
        });

        it('legacy exists() answers per product as AGTree v4 did', () => {
            expect(modifiersCompatibilityTable.exists('rewrite', GenericPlatform.AdgAny)).toBe(false);
            expect(modifiersCompatibilityTable.exists('redirect', GenericPlatform.AbpAny)).toBe(false);
            expect(modifiersCompatibilityTable.exists('3p', GenericPlatform.AbpAny)).toBe(false);
            expect(modifiersCompatibilityTable.exists('ghide', GenericPlatform.AbpAny)).toBe(false);
            expect(modifiersCompatibilityTable.exists('generichide', GenericPlatform.AbpAny)).toBe(true);

            expect(modifiersCompatibilityTable.exists('rewrite', SpecificPlatform.AbpExtChrome)).toBe(true);
            expect(modifiersCompatibilityTable.exists('redirect', GenericPlatform.AdgAny)).toBe(true);
            expect(modifiersCompatibilityTable.exists('3p', GenericPlatform.UboAny)).toBe(true);
        });
    });

    describe('redirects', () => {
        it('resolves names declared by the platform entry only', () => {
            // AdGuard name and its aliases, one of which is the uBO name
            expect(redirectsCompatibilityTable.supports('noopjs', Platform.AdgExtChrome)).toBe(true);
            expect(redirectsCompatibilityTable.supports('noop.js', Platform.AdgExtChrome)).toBe(true);

            // uBO calls it `noop.js`, ABP calls it `blank-js`
            expect(redirectsCompatibilityTable.supports('noop.js', Platform.UboExtChrome)).toBe(true);
            expect(redirectsCompatibilityTable.supports('noopjs', Platform.UboExtChrome)).toBe(false);
            expect(redirectsCompatibilityTable.supports('blank-js', Platform.UboAny)).toBe(false);
            expect(redirectsCompatibilityTable.supports('blank-js', Platform.AbpExtChrome)).toBe(true);
            expect(redirectsCompatibilityTable.supports('noop.js', Platform.AbpExtChrome)).toBe(false);
        });

        it('still normalizes the priority suffix and the ABP resource prefix', () => {
            expect(redirectsCompatibilityTable.supports('noop.js:99', Platform.UboExtChrome)).toBe(true);
            expect(redirectsCompatibilityTable.supports('abp-resource:blank-js', Platform.AbpExtChrome)).toBe(true);
        });
    });

    describe('scriptlets', () => {
        it('does not resolve a uBO alias on AdGuard and vice versa', () => {
            // `acs` is a uBO alias, AdGuard only knows `acs.js` and `ubo-acs`
            expect(scriptletsCompatibilityTable.supports('acs', Platform.UboExtChrome)).toBe(true);
            expect(scriptletsCompatibilityTable.supports('acs', Platform.AdgExtChrome)).toBe(false);
            expect(scriptletsCompatibilityTable.query('acs', Platform.AdgAny)).toBeNull();

            expect(scriptletsCompatibilityTable.supports('ubo-acs', Platform.AdgExtChrome)).toBe(true);
            expect(scriptletsCompatibilityTable.supports('ubo-acs', Platform.UboExtChrome)).toBe(false);
            expect(scriptletsCompatibilityTable.query('ubo-acs', Platform.UboAny)).toBeNull();
        });
    });

    describe('translate()', () => {
        it('maps a name of one product onto the entry of another platform', () => {
            expect(scriptletsCompatibilityTable.translate('acs', Platform.AdgAny)?.name)
                .toBe('abort-current-inline-script');
            expect(scriptletsCompatibilityTable.translate('abort-current-inline-script', Platform.UboAny)?.name)
                .toBe('abort-current-script.js');
            expect(redirectsCompatibilityTable.translate('noopjs', Platform.UboAny)?.name).toBe('noop.js');
            expect(modifiersCompatibilityTable.translate('rewrite', Platform.AdgAny)?.name).toBe('redirect');
        });

        it('returns null for an unknown name or a platform the feature does not exist on', () => {
            expect(modifiersCompatibilityTable.translate('nonexistent', Platform.AdgAny)).toBeNull();
            // `hls` has no ABP entry
            expect(modifiersCompatibilityTable.translate('hls', Platform.AdgAny)).not.toBeNull();
            expect(modifiersCompatibilityTable.translate('hls', Platform.AbpAny)).toBeNull();
        });
    });
});
