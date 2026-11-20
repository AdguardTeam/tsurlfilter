import { describe, expect, it } from 'vitest';

import { modifiersCompatibilityTable, Platform, scriptletsCompatibilityTable } from '../../src/compatibility-tables';
import { AdblockProduct } from '../../src/utils/adblockers';

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

    describe('data contracts', () => {
        it('returns frozen data', () => {
            const data = modifiersCompatibilityTable.get('important', Platform.AdgOsWindows);

            expect(data).not.toBeNull();
            expect(Object.isFrozen(data)).toBe(true);
            expect(() => {
                (data as { blockOnly: boolean }).blockOnly = true;
            }).toThrow(TypeError);
            expect(modifiersCompatibilityTable.get('important', Platform.AdgOsWindows)?.blockOnly).toBe(false);
        });

        it('returns frozen nested data', () => {
            const data = scriptletsCompatibilityTable.get('abort-on-property-read', Platform.AdgExtChrome);

            expect(Object.isFrozen(data?.parameters)).toBe(true);
            expect(Object.isFrozen(data?.parameters?.[0])).toBe(true);
        });

        it('returns a frozen list of variants', () => {
            const variants = modifiersCompatibilityTable.getAllVariants('important');
            const { length } = variants;

            expect(Object.isFrozen(variants)).toBe(true);
            expect(() => variants.push(variants[0])).toThrow(TypeError);
            expect(modifiersCompatibilityTable.getAllVariants('important')).toHaveLength(length);
        });

        it('queryAll lists an entry once even when it spans several platforms', () => {
            const results = modifiersCompatibilityTable.queryAll('third-party', Platform.AdgExtAny);

            expect(results).toHaveLength(1);
        });

        it('groupByProduct lists an entry once per product', () => {
            const grouped = modifiersCompatibilityTable.groupByProduct();

            for (const features of grouped.values()) {
                for (const variants of features.values()) {
                    expect(new Set(variants).size).toBe(variants.length);
                }
            }

            // `third-party` is one AdGuard entry spread over many platforms
            expect(grouped.get(AdblockProduct.Adg)?.get('third-party')).toHaveLength(1);
        });
    });

    // TODO: Add more tests
});
