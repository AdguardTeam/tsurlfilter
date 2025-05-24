import { describe, it, expect } from 'vitest';

import { modifiersCompatibilityTable } from '../../src/compatibility-tables/modifiers.js';
import { GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platforms.js';

const baseThirdPartyData = {
    name: 'third-party',
    aliases: ['3p'],
    // ...
};

describe('Modifiers Compatibility Table', () => {
    it('modifiersCompatibilityTable.existsAny', () => {
        expect(modifiersCompatibilityTable.existsAny('_')).toBeTruthy();
        expect(modifiersCompatibilityTable.existsAny('____')).toBeTruthy();
        expect(modifiersCompatibilityTable.existsAny('third-party')).toBeTruthy();

        expect(modifiersCompatibilityTable.existsAny('nonexistent')).toBeFalsy();
    });

    it('modifiersCompatibilityTable.exists', () => {
        expect(modifiersCompatibilityTable.exists('_', SpecificPlatform.AdgExtChrome)).toBeTruthy();
        expect(modifiersCompatibilityTable.exists('nonexistent', SpecificPlatform.AbpExtChrome)).toBeFalsy();

        expect(modifiersCompatibilityTable.exists('_', GenericPlatform.AdgExtAny)).toBeTruthy();
        expect(modifiersCompatibilityTable.exists('nonexistent', GenericPlatform.AbpExtAny)).toBeFalsy();
    });

    it('modifiersCompatibilityTable.getSingle', () => {
        expect(
            modifiersCompatibilityTable.getSingle('third-party', SpecificPlatform.AdgExtChrome),
        ).toMatchObject(baseThirdPartyData);

        expect(modifiersCompatibilityTable.getSingle('nonexistent', SpecificPlatform.AbpExtChrome)).toBeNull();

        // docs url differs
        expect(
            modifiersCompatibilityTable.getSingle('third-party', SpecificPlatform.AdgExtChrome)?.docs,
        ).not.toEqual(
            modifiersCompatibilityTable.getSingle('third-party', SpecificPlatform.AbpExtChrome)?.docs,
        );
    });

    it('modifiersCompatibilityTable.getMultiple', () => {
        expect(modifiersCompatibilityTable.getMultiple('third-party', GenericPlatform.AdgExtAny)).toMatchObject({
            [SpecificPlatform.AdgExtChrome]: baseThirdPartyData,
            [SpecificPlatform.AdgExtOpera]: baseThirdPartyData,
            [SpecificPlatform.AdgExtEdge]: baseThirdPartyData,
            [SpecificPlatform.AdgExtFirefox]: baseThirdPartyData,
        });

        expect(modifiersCompatibilityTable.getMultiple('nonexistent', GenericPlatform.AdgExtAny)).toBeNull();
    });

    // TODO: Add more tests
});
