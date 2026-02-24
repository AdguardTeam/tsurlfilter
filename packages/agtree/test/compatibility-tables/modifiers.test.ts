import { describe, it, expect } from 'vitest';

import { modifiersCompatibilityTable, Platform } from '../../src/compatibility-tables';

const baseThirdPartyData = {
    name: 'third-party',
    aliases: ['3p'],
    // ...
};

describe('Modifiers Compatibility Table', () => {
    it('modifiersCompatibilityTable.has', () => {
        expect(modifiersCompatibilityTable.has('_')).toBeTruthy();
        expect(modifiersCompatibilityTable.has('____')).toBeTruthy();
        expect(modifiersCompatibilityTable.has('third-party')).toBeTruthy();

        expect(modifiersCompatibilityTable.has('nonexistent')).toBeFalsy();
    });

    it('modifiersCompatibilityTable.supports', () => {
        expect(modifiersCompatibilityTable.supports('_', Platform.AdgExtChrome)).toBeTruthy();
        expect(modifiersCompatibilityTable.supports('nonexistent', Platform.AbpExtChrome)).toBeFalsy();

        expect(modifiersCompatibilityTable.supports('_', Platform.AdgExtAny)).toBeTruthy();
        expect(modifiersCompatibilityTable.supports('nonexistent', Platform.AbpExtAny)).toBeFalsy();
    });

    it('modifiersCompatibilityTable.get', () => {
        expect(
            modifiersCompatibilityTable.get('third-party', Platform.AdgExtChrome),
        ).toMatchObject(baseThirdPartyData);

        expect(modifiersCompatibilityTable.get('nonexistent', Platform.AbpExtChrome)).toBeNull();

        // docs url differs
        expect(
            modifiersCompatibilityTable.get('third-party', Platform.AdgExtChrome)?.docs,
        ).not.toEqual(
            modifiersCompatibilityTable.get('third-party', Platform.AbpExtChrome)?.docs,
        );
    });

    it('modifiersCompatibilityTable.queryAll', () => {
        const results = modifiersCompatibilityTable.queryAll('third-party', Platform.AdgExtAny);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toMatchObject(baseThirdPartyData);

        expect(modifiersCompatibilityTable.queryAll('nonexistent', Platform.AdgExtAny)).toEqual([]);
    });

    // TODO: Add more tests
});
