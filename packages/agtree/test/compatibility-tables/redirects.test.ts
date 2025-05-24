import { describe, it, expect } from 'vitest';

import { redirectsCompatibilityTable } from '../../src/compatibility-tables/redirects.js';
import { GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platforms.js';

const baseNoopJsData = {
    name: 'noopjs',
    aliases: ['noop.js', 'blank-js'],
    // ...
};

describe('Redirects Compatibility Table', () => {
    it('redirectsCompatibilityTable.existsAny', () => {
        expect(redirectsCompatibilityTable.existsAny('noopjs')).toBeTruthy();
        expect(redirectsCompatibilityTable.existsAny('noopjs:99')).toBeTruthy();
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

    // TODO: Add more tests
});
