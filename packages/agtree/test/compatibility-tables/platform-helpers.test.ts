/* eslint-disable no-bitwise */
import { describe, it, expect } from 'vitest';

import {
    isGenericPlatform,
    hasPlatformMultipleProducts,
    platformToAdblockProduct,
    getPlatformsByProduct,
    getProductGenericPlatforms,
    getProductSpecificPlatforms,
    getPlatformId,
    getSpecificPlatformName,
    getHumanReadablePlatformName,
    getAllPlatformNames,
} from '../../src/compatibility-tables/utils/platform-helpers';
import { type AnyPlatform, GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platforms';
import { AdblockProduct } from '../../src/utils/adblockers';

describe('Platform Helpers', () => {
    describe('isGenericPlatform', () => {
        it('should return false for specific platforms', () => {
            expect(isGenericPlatform(SpecificPlatform.AdgOsWindows)).toBe(false);
            expect(isGenericPlatform(SpecificPlatform.AdgExtChrome)).toBe(false);
            expect(isGenericPlatform(SpecificPlatform.UboExtFirefox)).toBe(false);
            expect(isGenericPlatform(SpecificPlatform.AbpExtEdge)).toBe(false);
            expect(isGenericPlatform(SpecificPlatform.AdgCbSafari)).toBe(false);
        });

        it('should return true for generic platforms', () => {
            expect(isGenericPlatform(GenericPlatform.AdgOsAny)).toBe(true);
            expect(isGenericPlatform(GenericPlatform.AdgExtChromium)).toBe(true);
            expect(isGenericPlatform(GenericPlatform.AdgExtAny)).toBe(true);
            expect(isGenericPlatform(GenericPlatform.AdgAny)).toBe(true);
            expect(isGenericPlatform(GenericPlatform.UboExtAny)).toBe(true);
            expect(isGenericPlatform(GenericPlatform.UboAny)).toBe(true);
            expect(isGenericPlatform(GenericPlatform.AbpExtAny)).toBe(true);
            expect(isGenericPlatform(GenericPlatform.AbpAny)).toBe(true);
            expect(isGenericPlatform(GenericPlatform.Any)).toBe(true);
        });

        it('should return true for combinations of platforms', () => {
            const combined1 = (SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgOsMac) as AnyPlatform;
            const combined2 = (SpecificPlatform.AdgExtChrome | SpecificPlatform.UboExtChrome) as AnyPlatform;
            const combined3 = (GenericPlatform.AdgAny | GenericPlatform.UboAny) as AnyPlatform;
            expect(isGenericPlatform(combined1)).toBe(true);
            expect(isGenericPlatform(combined2)).toBe(true);
            expect(isGenericPlatform(combined3)).toBe(true);
        });
    });

    describe('hasPlatformMultipleProducts', () => {
        it('should return false for single AdGuard platforms', () => {
            expect(hasPlatformMultipleProducts(SpecificPlatform.AdgOsWindows)).toBe(false);
            expect(hasPlatformMultipleProducts(SpecificPlatform.AdgExtChrome)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.AdgOsAny)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.AdgExtChromium)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.AdgExtAny)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.AdgAny)).toBe(false);
        });

        it('should return false for single uBlock Origin platforms', () => {
            expect(hasPlatformMultipleProducts(SpecificPlatform.UboExtChrome)).toBe(false);
            expect(hasPlatformMultipleProducts(SpecificPlatform.UboExtFirefox)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.UboExtChromium)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.UboExtAny)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.UboAny)).toBe(false);
        });

        it('should return false for single Adblock Plus platforms', () => {
            expect(hasPlatformMultipleProducts(SpecificPlatform.AbpExtChrome)).toBe(false);
            expect(hasPlatformMultipleProducts(SpecificPlatform.AbpExtEdge)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.AbpExtChromium)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.AbpExtAny)).toBe(false);
            expect(hasPlatformMultipleProducts(GenericPlatform.AbpAny)).toBe(false);
        });

        it('should return true for AdGuard + uBlock Origin', () => {
            const adgUbo1 = (GenericPlatform.AdgAny | GenericPlatform.UboAny) as AnyPlatform;
            const adgUbo2 = (SpecificPlatform.AdgExtChrome | SpecificPlatform.UboExtChrome) as AnyPlatform;
            const adgUbo3 = (GenericPlatform.AdgOsAny | GenericPlatform.UboExtAny) as AnyPlatform;
            expect(hasPlatformMultipleProducts(adgUbo1)).toBe(true);
            expect(hasPlatformMultipleProducts(adgUbo2)).toBe(true);
            expect(hasPlatformMultipleProducts(adgUbo3)).toBe(true);
        });

        it('should return true for AdGuard + Adblock Plus', () => {
            const adgAbp1 = (GenericPlatform.AdgAny | GenericPlatform.AbpAny) as AnyPlatform;
            const adgAbp2 = (SpecificPlatform.AdgExtChrome | SpecificPlatform.AbpExtChrome) as AnyPlatform;
            const adgAbp3 = (GenericPlatform.AdgExtAny | GenericPlatform.AbpExtAny) as AnyPlatform;
            expect(hasPlatformMultipleProducts(adgAbp1)).toBe(true);
            expect(hasPlatformMultipleProducts(adgAbp2)).toBe(true);
            expect(hasPlatformMultipleProducts(adgAbp3)).toBe(true);
        });

        it('should return true for uBlock Origin + Adblock Plus', () => {
            const uboAbp1 = (GenericPlatform.UboAny | GenericPlatform.AbpAny) as AnyPlatform;
            const uboAbp2 = (SpecificPlatform.UboExtChrome | SpecificPlatform.AbpExtChrome) as AnyPlatform;
            const uboAbp3 = (GenericPlatform.UboExtAny | GenericPlatform.AbpExtChromium) as AnyPlatform;
            expect(hasPlatformMultipleProducts(uboAbp1)).toBe(true);
            expect(hasPlatformMultipleProducts(uboAbp2)).toBe(true);
            expect(hasPlatformMultipleProducts(uboAbp3)).toBe(true);
        });

        it('should return true for all three products', () => {
            const allProducts1 = (
                GenericPlatform.AdgAny | GenericPlatform.UboAny | GenericPlatform.AbpAny
            ) as AnyPlatform;
            const allProducts2 = (
                SpecificPlatform.AdgExtChrome
                | SpecificPlatform.UboExtChrome
                | SpecificPlatform.AbpExtChrome
            ) as AnyPlatform;
            expect(hasPlatformMultipleProducts(allProducts1)).toBe(true);
            expect(hasPlatformMultipleProducts(allProducts2)).toBe(true);
        });

        it('should return true for Any platform (contains all products)', () => {
            expect(hasPlatformMultipleProducts(GenericPlatform.Any)).toBe(true);
        });

        it('should return false for combinations within the same product', () => {
            const sameProduct1 = (SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgExtChrome) as AnyPlatform;
            const sameProduct2 = (SpecificPlatform.UboExtChrome | SpecificPlatform.UboExtFirefox) as AnyPlatform;
            const sameProduct3 = (SpecificPlatform.AbpExtChrome | SpecificPlatform.AbpExtEdge) as AnyPlatform;
            expect(hasPlatformMultipleProducts(sameProduct1)).toBe(false);
            expect(hasPlatformMultipleProducts(sameProduct2)).toBe(false);
            expect(hasPlatformMultipleProducts(sameProduct3)).toBe(false);
        });
    });

    describe('platformToAdblockProduct', () => {
        describe('AdGuard platforms', () => {
            it('should return AdGuard for specific AdGuard platforms', () => {
                expect(platformToAdblockProduct(SpecificPlatform.AdgOsWindows)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(SpecificPlatform.AdgOsMac)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(SpecificPlatform.AdgOsAndroid)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(SpecificPlatform.AdgExtChrome)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(SpecificPlatform.AdgExtFirefox)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(SpecificPlatform.AdgCbSafari)).toEqual([AdblockProduct.Adg]);
            });

            it('should return AdGuard for generic AdGuard platforms', () => {
                expect(platformToAdblockProduct(GenericPlatform.AdgOsAny)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(GenericPlatform.AdgSafariAny)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(GenericPlatform.AdgExtChromium)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(GenericPlatform.AdgExtAny)).toEqual([AdblockProduct.Adg]);
                expect(platformToAdblockProduct(GenericPlatform.AdgAny)).toEqual([AdblockProduct.Adg]);
            });

            it('should return AdGuard for combinations of AdGuard platforms', () => {
                const combined = (SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgExtChrome) as AnyPlatform;
                expect(platformToAdblockProduct(combined)).toEqual([AdblockProduct.Adg]);
            });
        });

        describe('uBlock Origin platforms', () => {
            it('should return UblockOrigin for specific uBlock Origin platforms', () => {
                expect(platformToAdblockProduct(SpecificPlatform.UboExtChrome)).toEqual([AdblockProduct.Ubo]);
                expect(platformToAdblockProduct(SpecificPlatform.UboExtOpera)).toEqual([AdblockProduct.Ubo]);
                expect(platformToAdblockProduct(SpecificPlatform.UboExtEdge)).toEqual([AdblockProduct.Ubo]);
                expect(platformToAdblockProduct(SpecificPlatform.UboExtFirefox)).toEqual([AdblockProduct.Ubo]);
            });

            it('should return UblockOrigin for generic uBlock Origin platforms', () => {
                expect(platformToAdblockProduct(GenericPlatform.UboExtChromium)).toEqual([AdblockProduct.Ubo]);
                expect(platformToAdblockProduct(GenericPlatform.UboExtAny)).toEqual([AdblockProduct.Ubo]);
                expect(platformToAdblockProduct(GenericPlatform.UboAny)).toEqual([AdblockProduct.Ubo]);
            });

            it('should return UblockOrigin for combinations of uBlock Origin platforms', () => {
                const combined = (SpecificPlatform.UboExtChrome | SpecificPlatform.UboExtFirefox) as AnyPlatform;
                expect(platformToAdblockProduct(combined)).toEqual([AdblockProduct.Ubo]);
            });
        });

        describe('Adblock Plus platforms', () => {
            it('should return AdblockPlus for specific Adblock Plus platforms', () => {
                expect(platformToAdblockProduct(SpecificPlatform.AbpExtChrome)).toEqual([AdblockProduct.Abp]);
                expect(platformToAdblockProduct(SpecificPlatform.AbpExtOpera)).toEqual([AdblockProduct.Abp]);
                expect(platformToAdblockProduct(SpecificPlatform.AbpExtEdge)).toEqual([AdblockProduct.Abp]);
                expect(platformToAdblockProduct(SpecificPlatform.AbpExtFirefox)).toEqual([AdblockProduct.Abp]);
            });

            it('should return AdblockPlus for generic Adblock Plus platforms', () => {
                expect(platformToAdblockProduct(GenericPlatform.AbpExtChromium)).toEqual([AdblockProduct.Abp]);
                expect(platformToAdblockProduct(GenericPlatform.AbpExtAny)).toEqual([AdblockProduct.Abp]);
                expect(platformToAdblockProduct(GenericPlatform.AbpAny)).toEqual([AdblockProduct.Abp]);
            });

            it('should return AdblockPlus for combinations of Adblock Plus platforms', () => {
                const combined = (SpecificPlatform.AbpExtChrome | SpecificPlatform.AbpExtEdge) as AnyPlatform;
                expect(platformToAdblockProduct(combined)).toEqual([AdblockProduct.Abp]);
            });
        });

        describe('Multiple products', () => {
            it('should return array with AdGuard and UblockOrigin', () => {
                const adgUbo1 = (GenericPlatform.AdgAny | GenericPlatform.UboAny) as AnyPlatform;
                const adgUbo2 = (SpecificPlatform.AdgExtChrome | SpecificPlatform.UboExtChrome) as AnyPlatform;
                expect(platformToAdblockProduct(adgUbo1)).toEqual([AdblockProduct.Adg, AdblockProduct.Ubo]);
                expect(platformToAdblockProduct(adgUbo2)).toEqual([AdblockProduct.Adg, AdblockProduct.Ubo]);
            });

            it('should return array with AdGuard and AdblockPlus', () => {
                const adgAbp1 = (GenericPlatform.AdgAny | GenericPlatform.AbpAny) as AnyPlatform;
                const adgAbp2 = (SpecificPlatform.AdgExtChrome | SpecificPlatform.AbpExtChrome) as AnyPlatform;
                expect(platformToAdblockProduct(adgAbp1)).toEqual([AdblockProduct.Adg, AdblockProduct.Abp]);
                expect(platformToAdblockProduct(adgAbp2)).toEqual([AdblockProduct.Adg, AdblockProduct.Abp]);
            });

            it('should return array with UblockOrigin and AdblockPlus', () => {
                const uboAbp1 = (GenericPlatform.UboAny | GenericPlatform.AbpAny) as AnyPlatform;
                const uboAbp2 = (SpecificPlatform.UboExtChrome | SpecificPlatform.AbpExtChrome) as AnyPlatform;
                expect(platformToAdblockProduct(uboAbp1)).toEqual([AdblockProduct.Ubo, AdblockProduct.Abp]);
                expect(platformToAdblockProduct(uboAbp2)).toEqual([AdblockProduct.Ubo, AdblockProduct.Abp]);
            });

            it('should return array with all three products', () => {
                const allProducts = (
                    GenericPlatform.AdgAny
                    | GenericPlatform.UboAny
                    | GenericPlatform.AbpAny
                ) as AnyPlatform;
                expect(platformToAdblockProduct(allProducts)).toEqual([
                    AdblockProduct.Adg,
                    AdblockProduct.Ubo,
                    AdblockProduct.Abp,
                ]);
            });

            it('should return all three products for Any platform', () => {
                expect(platformToAdblockProduct(GenericPlatform.Any)).toEqual([
                    AdblockProduct.Adg,
                    AdblockProduct.Ubo,
                    AdblockProduct.Abp,
                ]);
            });
        });

        describe('Edge cases', () => {
            it('should return empty array for platform with no product bits', () => {
                expect(platformToAdblockProduct(0 as AnyPlatform)).toEqual([]);
            });
        });
    });

    describe('getPlatformsByProduct', () => {
        it('should return object with AdGuard key for AdGuard-only platform', () => {
            const result = getPlatformsByProduct(GenericPlatform.AdgAny);
            expect(Object.keys(result)).toEqual([AdblockProduct.Adg]);
            expect(result[AdblockProduct.Adg]).toEqual([GenericPlatform.AdgAny]);
        });

        it('should return object with UblockOrigin key for uBlock Origin-only platform', () => {
            const result = getPlatformsByProduct(GenericPlatform.UboAny);
            expect(Object.keys(result)).toEqual([AdblockProduct.Ubo]);
            expect(result[AdblockProduct.Ubo]).toEqual([GenericPlatform.UboAny]);
        });

        it('should return object with AdblockPlus key for Adblock Plus-only platform', () => {
            const result = getPlatformsByProduct(GenericPlatform.AbpAny);
            expect(Object.keys(result)).toEqual([AdblockProduct.Abp]);
            expect(result[AdblockProduct.Abp]).toEqual([GenericPlatform.AbpAny]);
        });

        it('should split AdGuard + uBlock Origin into two product keys', () => {
            const combined = (GenericPlatform.AdgAny | GenericPlatform.UboAny) as AnyPlatform;
            const result = getPlatformsByProduct(combined);
            expect(Object.keys(result).sort()).toEqual([AdblockProduct.Adg, AdblockProduct.Ubo].sort());
            expect(result[AdblockProduct.Adg]).toEqual([GenericPlatform.AdgAny]);
            expect(result[AdblockProduct.Ubo]).toEqual([GenericPlatform.UboAny]);
        });

        it('should split AdGuard + Adblock Plus into two product keys', () => {
            const combined = (GenericPlatform.AdgAny | GenericPlatform.AbpAny) as AnyPlatform;
            const result = getPlatformsByProduct(combined);
            expect(Object.keys(result).sort()).toEqual([AdblockProduct.Abp, AdblockProduct.Adg].sort());
            expect(result[AdblockProduct.Adg]).toEqual([GenericPlatform.AdgAny]);
            expect(result[AdblockProduct.Abp]).toEqual([GenericPlatform.AbpAny]);
        });

        it('should split uBlock Origin + Adblock Plus into two product keys', () => {
            const combined = (GenericPlatform.UboAny | GenericPlatform.AbpAny) as AnyPlatform;
            const result = getPlatformsByProduct(combined);
            expect(Object.keys(result).sort()).toEqual([AdblockProduct.Abp, AdblockProduct.Ubo].sort());
            expect(result[AdblockProduct.Ubo]).toEqual([GenericPlatform.UboAny]);
            expect(result[AdblockProduct.Abp]).toEqual([GenericPlatform.AbpAny]);
        });

        it('should split all three products', () => {
            const combined = (
                GenericPlatform.AdgAny | GenericPlatform.UboAny | GenericPlatform.AbpAny
            ) as AnyPlatform;
            const result = getPlatformsByProduct(combined);
            expect(Object.keys(result).sort()).toEqual(
                [AdblockProduct.Abp, AdblockProduct.Adg, AdblockProduct.Ubo].sort(),
            );
            expect(result[AdblockProduct.Adg]).toEqual([GenericPlatform.AdgAny]);
            expect(result[AdblockProduct.Ubo]).toEqual([GenericPlatform.UboAny]);
            expect(result[AdblockProduct.Abp]).toEqual([GenericPlatform.AbpAny]);
        });

        it('should extract only product bits for each platform', () => {
            const combined = (GenericPlatform.AdgAny | GenericPlatform.UboAny) as AnyPlatform;
            const result = getPlatformsByProduct(combined);

            // Verify AdGuard platform only has AdGuard bits
            const adgPlatform = result[AdblockProduct.Adg]![0];
            expect(adgPlatform & GenericPlatform.AdgAny).toBeTruthy();
            expect(adgPlatform & GenericPlatform.UboAny).toBeFalsy();
            expect(adgPlatform & GenericPlatform.AbpAny).toBeFalsy();

            // Verify uBlock platform only has uBlock bits
            const uboPlatform = result[AdblockProduct.Ubo]![0];
            expect(uboPlatform & GenericPlatform.UboAny).toBeTruthy();
            expect(uboPlatform & GenericPlatform.AdgAny).toBeFalsy();
            expect(uboPlatform & GenericPlatform.AbpAny).toBeFalsy();
        });

        it('should return empty object for platform with no product bits', () => {
            const result = getPlatformsByProduct(0 as AnyPlatform);
            expect(result).toEqual({});
        });

        it('should work with specific platforms', () => {
            const result = getPlatformsByProduct(SpecificPlatform.AdgExtChrome);
            expect(Object.keys(result)).toEqual([AdblockProduct.Adg]);
            expect(result[AdblockProduct.Adg]).toEqual([SpecificPlatform.AdgExtChrome]);
        });

        describe('Optimization logic', () => {
            it('should optimize Chrome + Firefox extensions to smallest covering generic', () => {
                const combined = (
                    SpecificPlatform.AdgExtChrome | SpecificPlatform.AdgExtFirefox
                ) as AnyPlatform;
                const result = getPlatformsByProduct(combined);

                // Should optimize to a single generic platform
                expect(result[AdblockProduct.Adg]).toHaveLength(1);
                const optimized = result[AdblockProduct.Adg]![0];
                // Verify it covers both Chrome and Firefox
                expect(optimized & SpecificPlatform.AdgExtChrome).toBeTruthy();
                expect(optimized & SpecificPlatform.AdgExtFirefox).toBeTruthy();
            });

            it('should keep strongest generic when all Chromium platforms are covered', () => {
                // All Chromium-based extensions (Chrome, Firefox, Opera, Edge)
                const allChromiumExt = (
                    SpecificPlatform.AdgExtChrome
                    | SpecificPlatform.AdgExtFirefox
                    | SpecificPlatform.AdgExtOpera
                    | SpecificPlatform.AdgExtEdge
                ) as AnyPlatform;
                const result = getPlatformsByProduct(allChromiumExt);

                // Should optimize to single generic
                expect(result[AdblockProduct.Adg]).toHaveLength(1);
                const optimized = result[AdblockProduct.Adg]![0];
                // Verify it covers all platforms
                expect(optimized & SpecificPlatform.AdgExtChrome).toBeTruthy();
                expect(optimized & SpecificPlatform.AdgExtFirefox).toBeTruthy();
                expect(optimized & SpecificPlatform.AdgExtOpera).toBeTruthy();
                expect(optimized & SpecificPlatform.AdgExtEdge).toBeTruthy();
            });

            it('should include both generic and specific when not all platforms covered', () => {
                // Extension platforms + one OS platform that aren't part of the same generic
                const mixed = (
                    SpecificPlatform.AdgExtChrome
                    | SpecificPlatform.AdgExtFirefox
                    | SpecificPlatform.AdgOsWindows
                ) as AnyPlatform;
                const result = getPlatformsByProduct(mixed);

                // Should optimize, but exact length depends on generic platform hierarchy
                // What matters is all bits are covered
                const platforms = result[AdblockProduct.Adg]!;
                let combinedBits = 0;
                for (const p of platforms) {
                    combinedBits |= p as unknown as number;
                }
                // Verify all original platforms are covered
                expect(combinedBits & SpecificPlatform.AdgExtChrome).toBeTruthy();
                expect(combinedBits & SpecificPlatform.AdgExtFirefox).toBeTruthy();
                expect(combinedBits & SpecificPlatform.AdgOsWindows).toBeTruthy();
            });

            it('should optimize to most specific generic platforms first', () => {
                // All AdGuard OS platforms (Windows, Mac, Android)
                const allOs = (
                    SpecificPlatform.AdgOsWindows
                    | SpecificPlatform.AdgOsMac
                    | SpecificPlatform.AdgOsAndroid
                ) as AnyPlatform;
                const result = getPlatformsByProduct(allOs);

                // Should optimize to AdgOsAny (most specific generic covering all OS)
                expect(result[AdblockProduct.Adg]).toEqual([GenericPlatform.AdgOsAny]);
            });

            it('should handle partial coverage with multiple generics', () => {
                // OS platforms + Extension platforms - should optimize each separately
                const osAndExt = (
                    SpecificPlatform.AdgOsWindows
                    | SpecificPlatform.AdgOsMac
                    | SpecificPlatform.AdgOsAndroid
                    | SpecificPlatform.AdgExtChrome
                    | SpecificPlatform.AdgExtFirefox
                ) as AnyPlatform;
                const result = getPlatformsByProduct(osAndExt);

                // Should have at least one platform, possibly multiple
                const platforms = result[AdblockProduct.Adg]!;
                expect(platforms.length).toBeGreaterThan(0);

                // Verify all original platforms are covered
                let combinedBits = 0;
                for (const p of platforms) {
                    combinedBits |= p as unknown as number;
                }
                expect(combinedBits & SpecificPlatform.AdgOsWindows).toBeTruthy();
                expect(combinedBits & SpecificPlatform.AdgOsMac).toBeTruthy();
                expect(combinedBits & SpecificPlatform.AdgOsAndroid).toBeTruthy();
                expect(combinedBits & SpecificPlatform.AdgExtChrome).toBeTruthy();
                expect(combinedBits & SpecificPlatform.AdgExtFirefox).toBeTruthy();
            });

            it('should optimize to AdgAny when all AdGuard platforms present', () => {
                // If all platforms under AdgAny are present, should return just AdgAny
                const result = getPlatformsByProduct(GenericPlatform.AdgAny);
                expect(result[AdblockProduct.Adg]).toEqual([GenericPlatform.AdgAny]);
            });

            it('should not break down already optimal generic platform', () => {
                // AdgExtAny should remain as-is, not broken into smaller parts
                const result = getPlatformsByProduct(GenericPlatform.AdgExtAny);
                expect(result[AdblockProduct.Adg]).toEqual([GenericPlatform.AdgExtAny]);
            });

            it('should optimize uBlock platforms similarly', () => {
                const chromiumExt = (
                    SpecificPlatform.UboExtChrome | SpecificPlatform.UboExtOpera
                ) as AnyPlatform;
                const result = getPlatformsByProduct(chromiumExt);

                // Should optimize to single generic covering both
                expect(result[AdblockProduct.Ubo]).toHaveLength(1);
                const optimized = result[AdblockProduct.Ubo]![0];
                expect(optimized & SpecificPlatform.UboExtChrome).toBeTruthy();
                expect(optimized & SpecificPlatform.UboExtOpera).toBeTruthy();
            });

            it('should optimize Adblock Plus platforms similarly', () => {
                const chromiumExt = (
                    SpecificPlatform.AbpExtChrome
                    | SpecificPlatform.AbpExtOpera
                    | SpecificPlatform.AbpExtEdge
                ) as AnyPlatform;
                const result = getPlatformsByProduct(chromiumExt);

                // Should optimize to single generic covering all three
                expect(result[AdblockProduct.Abp]).toHaveLength(1);
                const optimized = result[AdblockProduct.Abp]![0];
                expect(optimized & SpecificPlatform.AbpExtChrome).toBeTruthy();
                expect(optimized & SpecificPlatform.AbpExtOpera).toBeTruthy();
                expect(optimized & SpecificPlatform.AbpExtEdge).toBeTruthy();
            });
        });
    });

    describe('getPlatformId', () => {
        it('should return specific platform for specific platform names', () => {
            expect(getPlatformId('adg_os_windows')).toBe(SpecificPlatform.AdgOsWindows);
            expect(getPlatformId('adg_ext_chrome')).toBe(SpecificPlatform.AdgExtChrome);
            expect(getPlatformId('ubo_ext_firefox')).toBe(SpecificPlatform.UboExtFirefox);
            expect(getPlatformId('abp_ext_edge')).toBe(SpecificPlatform.AbpExtEdge);
        });

        it('should return generic platform for generic platform names', () => {
            expect(getPlatformId('adg_os_any')).toBe(GenericPlatform.AdgOsAny);
            expect(getPlatformId('adg_ext_chromium')).toBe(GenericPlatform.AdgExtChromium);
            expect(getPlatformId('adg_any')).toBe(GenericPlatform.AdgAny);
            expect(getPlatformId('any')).toBe(GenericPlatform.Any);
        });

        it('should throw error for unknown platform', () => {
            expect(() => getPlatformId('unknown_platform')).toThrow('Unknown platform: unknown_platform');
            expect(() => getPlatformId('invalid')).toThrow('Unknown platform: invalid');
        });
    });

    describe('getSpecificPlatformName', () => {
        it('should return platform name for specific platforms', () => {
            expect(getSpecificPlatformName(SpecificPlatform.AdgOsWindows)).toBe('adg_os_windows');
            expect(getSpecificPlatformName(SpecificPlatform.AdgExtChrome)).toBe('adg_ext_chrome');
            expect(getSpecificPlatformName(SpecificPlatform.UboExtFirefox)).toBe('ubo_ext_firefox');
            expect(getSpecificPlatformName(SpecificPlatform.AbpExtEdge)).toBe('abp_ext_edge');
        });

        it('should throw error for unknown platform', () => {
            expect(() => getSpecificPlatformName(999999 as SpecificPlatform)).toThrow('Unknown platform');
        });
    });

    describe('getHumanReadablePlatformName', () => {
        it('should return human-readable name for specific platforms', () => {
            expect(getHumanReadablePlatformName(SpecificPlatform.AdgOsWindows))
                .toBe('AdGuard App for Windows');
            expect(getHumanReadablePlatformName(SpecificPlatform.AdgExtChrome))
                .toBe('AdGuard Browser Extension for Chrome');
            expect(getHumanReadablePlatformName(SpecificPlatform.UboExtFirefox))
                .toBe('uBlock Origin Browser Extension for Firefox');
            expect(getHumanReadablePlatformName(SpecificPlatform.AbpExtEdge))
                .toBe('AdBlock / Adblock Plus Browser Extension for Edge');
        });

        it('should return human-readable name for generic platforms', () => {
            expect(getHumanReadablePlatformName(GenericPlatform.AdgOsAny)).toBe('Any System-level AdGuard App');
            expect(getHumanReadablePlatformName(GenericPlatform.AdgExtChromium))
                .toBe('Any AdGuard Browser Extension for Chromium');
            expect(getHumanReadablePlatformName(GenericPlatform.AdgAny)).toBe('Any AdGuard product');
            expect(getHumanReadablePlatformName(GenericPlatform.UboAny)).toBe('Any uBlock Origin product');
            expect(getHumanReadablePlatformName(GenericPlatform.AbpAny)).toBe('Any AdBlock / Adblock Plus product');
            expect(getHumanReadablePlatformName(GenericPlatform.Any)).toBe('Any product');
        });

        it('should throw error for unknown platform', () => {
            expect(() => getHumanReadablePlatformName(999999 as AnyPlatform))
                .toThrow('Unknown platform');
        });
    });

    describe('getProductGenericPlatforms', () => {
        it('should return a record with all three products', () => {
            const result = getProductGenericPlatforms();
            expect(Object.keys(result).sort()).toEqual([
                AdblockProduct.Abp,
                AdblockProduct.Adg,
                AdblockProduct.Ubo,
            ].sort());
        });

        it('should include all AdGuard generic platforms', () => {
            const result = getProductGenericPlatforms();
            const adgPlatforms = result[AdblockProduct.Adg];

            expect(adgPlatforms).toContain(GenericPlatform.AdgOsAny);
            expect(adgPlatforms).toContain(GenericPlatform.AdgSafariAny);
            expect(adgPlatforms).toContain(GenericPlatform.AdgExtChromium);
            expect(adgPlatforms).toContain(GenericPlatform.AdgExtAny);
            expect(adgPlatforms).toContain(GenericPlatform.AdgAny);
        });

        it('should include all uBlock Origin generic platforms', () => {
            const result = getProductGenericPlatforms();
            const uboPlatforms = result[AdblockProduct.Ubo];

            expect(uboPlatforms).toContain(GenericPlatform.UboExtChromium);
            expect(uboPlatforms).toContain(GenericPlatform.UboExtAny);
            expect(uboPlatforms).toContain(GenericPlatform.UboAny);
        });

        it('should include all Adblock Plus generic platforms', () => {
            const result = getProductGenericPlatforms();
            const abpPlatforms = result[AdblockProduct.Abp];

            expect(abpPlatforms).toContain(GenericPlatform.AbpExtChromium);
            expect(abpPlatforms).toContain(GenericPlatform.AbpExtAny);
            expect(abpPlatforms).toContain(GenericPlatform.AbpAny);
        });

        it('should sort platforms by specificity (fewer bits first)', () => {
            const result = getProductGenericPlatforms();

            // Check AdGuard platforms are sorted by bit count
            const adgPlatforms = result[AdblockProduct.Adg];
            for (let i = 0; i < adgPlatforms.length - 1; i += 1) {
                const currentBits = (adgPlatforms[i] as unknown as number).toString(2).split('1').length - 1;
                const nextBits = (adgPlatforms[i + 1] as unknown as number).toString(2).split('1').length - 1;
                expect(currentBits).toBeLessThanOrEqual(nextBits);
            }
        });

        it('should cache the result on subsequent calls', () => {
            const result1 = getProductGenericPlatforms();
            const result2 = getProductGenericPlatforms();

            // Should return the exact same object (reference equality)
            expect(result1).toBe(result2);
        });

        it('should return readonly arrays', () => {
            const result = getProductGenericPlatforms();

            // Arrays should be readonly (compile-time check, runtime verify it's an array)
            expect(Array.isArray(result[AdblockProduct.Adg])).toBe(true);
            expect(Array.isArray(result[AdblockProduct.Ubo])).toBe(true);
            expect(Array.isArray(result[AdblockProduct.Abp])).toBe(true);
        });

        it('should not include GenericPlatform.Any in any product', () => {
            const result = getProductGenericPlatforms();

            // GenericPlatform.Any doesn't start with Adg/Ubo/Abp prefix
            expect(result[AdblockProduct.Adg]).not.toContain(GenericPlatform.Any);
            expect(result[AdblockProduct.Ubo]).not.toContain(GenericPlatform.Any);
            expect(result[AdblockProduct.Abp]).not.toContain(GenericPlatform.Any);
        });

        it('should only include platforms with matching prefix', () => {
            const result = getProductGenericPlatforms();

            // Verify each product only has its own platforms
            const adgPlatforms = result[AdblockProduct.Adg];
            const uboPlatforms = result[AdblockProduct.Ubo];
            const abpPlatforms = result[AdblockProduct.Abp];

            // No overlap between products
            for (const platform of adgPlatforms) {
                expect(uboPlatforms).not.toContain(platform);
                expect(abpPlatforms).not.toContain(platform);
            }

            for (const platform of uboPlatforms) {
                expect(adgPlatforms).not.toContain(platform);
                expect(abpPlatforms).not.toContain(platform);
            }

            for (const platform of abpPlatforms) {
                expect(adgPlatforms).not.toContain(platform);
                expect(uboPlatforms).not.toContain(platform);
            }
        });

        it('should have most specific platforms first', () => {
            const result = getProductGenericPlatforms();

            // AdgOsAny should come before AdgAny (fewer bits)
            const adgPlatforms = result[AdblockProduct.Adg];
            const osAnyIndex = adgPlatforms.indexOf(GenericPlatform.AdgOsAny);
            const adgAnyIndex = adgPlatforms.indexOf(GenericPlatform.AdgAny);
            expect(osAnyIndex).toBeLessThan(adgAnyIndex);

            // AdgExtChromium should come before AdgExtAny (fewer bits)
            const extChromiumIndex = adgPlatforms.indexOf(GenericPlatform.AdgExtChromium);
            const extAnyIndex = adgPlatforms.indexOf(GenericPlatform.AdgExtAny);
            expect(extChromiumIndex).toBeLessThan(extAnyIndex);
        });
    });

    describe('getProductSpecificPlatforms', () => {
        it('should return all AdGuard specific platforms', () => {
            const result = getProductSpecificPlatforms(AdblockProduct.Adg);

            expect(result).toContain(SpecificPlatform.AdgOsWindows);
            expect(result).toContain(SpecificPlatform.AdgOsMac);
            expect(result).toContain(SpecificPlatform.AdgOsAndroid);
            expect(result).toContain(SpecificPlatform.AdgExtChrome);
            expect(result).toContain(SpecificPlatform.AdgExtOpera);
            expect(result).toContain(SpecificPlatform.AdgExtEdge);
            expect(result).toContain(SpecificPlatform.AdgExtFirefox);
            expect(result).toContain(SpecificPlatform.AdgCbAndroid);
            expect(result).toContain(SpecificPlatform.AdgCbIos);
            expect(result).toContain(SpecificPlatform.AdgCbSafari);

            // Should have exactly 10 AdGuard specific platforms
            expect(result).toHaveLength(10);
        });

        it('should return all uBlock Origin specific platforms', () => {
            const result = getProductSpecificPlatforms(AdblockProduct.Ubo);

            expect(result).toContain(SpecificPlatform.UboExtChrome);
            expect(result).toContain(SpecificPlatform.UboExtOpera);
            expect(result).toContain(SpecificPlatform.UboExtEdge);
            expect(result).toContain(SpecificPlatform.UboExtFirefox);

            // Should have exactly 4 uBlock Origin specific platforms
            expect(result).toHaveLength(4);
        });

        it('should return all Adblock Plus specific platforms', () => {
            const result = getProductSpecificPlatforms(AdblockProduct.Abp);

            expect(result).toContain(SpecificPlatform.AbpExtChrome);
            expect(result).toContain(SpecificPlatform.AbpExtOpera);
            expect(result).toContain(SpecificPlatform.AbpExtEdge);
            expect(result).toContain(SpecificPlatform.AbpExtFirefox);

            // Should have exactly 4 Adblock Plus specific platforms
            expect(result).toHaveLength(4);
        });

        it('should not include generic platforms', () => {
            const adgResult = getProductSpecificPlatforms(AdblockProduct.Adg);
            const uboResult = getProductSpecificPlatforms(AdblockProduct.Ubo);
            const abpResult = getProductSpecificPlatforms(AdblockProduct.Abp);

            // Should not contain any generic platforms (check a few)
            expect(adgResult).not.toContain(GenericPlatform.AdgAny);
            expect(adgResult).not.toContain(GenericPlatform.AdgOsAny);
            expect(adgResult).not.toContain(GenericPlatform.AdgExtAny);

            expect(uboResult).not.toContain(GenericPlatform.UboAny);
            expect(uboResult).not.toContain(GenericPlatform.UboExtAny);

            expect(abpResult).not.toContain(GenericPlatform.AbpAny);
            expect(abpResult).not.toContain(GenericPlatform.AbpExtAny);
        });

        it('should cache the result on subsequent calls', () => {
            const result1 = getProductSpecificPlatforms(AdblockProduct.Adg);
            const result2 = getProductSpecificPlatforms(AdblockProduct.Adg);

            // Should return the exact same object (reference equality)
            expect(result1).toBe(result2);
        });

        it('should return readonly arrays', () => {
            const adgResult = getProductSpecificPlatforms(AdblockProduct.Adg);
            const uboResult = getProductSpecificPlatforms(AdblockProduct.Ubo);
            const abpResult = getProductSpecificPlatforms(AdblockProduct.Abp);

            // Arrays should be readonly (compile-time check, runtime verify it's an array)
            expect(Array.isArray(adgResult)).toBe(true);
            expect(Array.isArray(uboResult)).toBe(true);
            expect(Array.isArray(abpResult)).toBe(true);
        });

        it('should only include platforms with matching prefix', () => {
            const adgPlatforms = getProductSpecificPlatforms(AdblockProduct.Adg);
            const uboPlatforms = getProductSpecificPlatforms(AdblockProduct.Ubo);
            const abpPlatforms = getProductSpecificPlatforms(AdblockProduct.Abp);

            // Verify each platform starts with the correct prefix
            for (const platform of adgPlatforms) {
                const platformValue = platform as unknown as number;
                // Should be one of the AdGuard-specific platform bits
                expect(platformValue & (GenericPlatform.AdgAny as unknown as number)).toBeTruthy();
            }

            for (const platform of uboPlatforms) {
                const platformValue = platform as unknown as number;
                // Should be one of the uBlock-specific platform bits
                expect(platformValue & (GenericPlatform.UboAny as unknown as number)).toBeTruthy();
            }

            for (const platform of abpPlatforms) {
                const platformValue = platform as unknown as number;
                // Should be one of the Adblock Plus-specific platform bits
                expect(platformValue & (GenericPlatform.AbpAny as unknown as number)).toBeTruthy();
            }
        });

        it('should not have any overlap between products', () => {
            const adgPlatforms = getProductSpecificPlatforms(AdblockProduct.Adg);
            const uboPlatforms = getProductSpecificPlatforms(AdblockProduct.Ubo);
            const abpPlatforms = getProductSpecificPlatforms(AdblockProduct.Abp);

            // No overlap between products
            for (const platform of adgPlatforms) {
                expect(uboPlatforms).not.toContain(platform);
                expect(abpPlatforms).not.toContain(platform);
            }

            for (const platform of uboPlatforms) {
                expect(adgPlatforms).not.toContain(platform);
                expect(abpPlatforms).not.toContain(platform);
            }

            for (const platform of abpPlatforms) {
                expect(adgPlatforms).not.toContain(platform);
                expect(uboPlatforms).not.toContain(platform);
            }
        });

        it('should return platforms that are truly specific (single bit set)', () => {
            const adgPlatforms = getProductSpecificPlatforms(AdblockProduct.Adg);

            for (const platform of adgPlatforms) {
                const platformValue = platform as unknown as number;
                // Check if only one bit is set (power of 2)
                // A number is a power of 2 if (n & (n-1)) === 0 and n !== 0
                expect(platformValue & (platformValue - 1)).toBe(0);
                expect(platformValue).not.toBe(0);
            }
        });
    });

    describe('getAllPlatformNames', () => {
        it('should return all specific platform names', () => {
            const { specificPlatformNames } = getAllPlatformNames();

            expect(specificPlatformNames).toContain('adg_os_windows');
            expect(specificPlatformNames).toContain('adg_os_mac');
            expect(specificPlatformNames).toContain('adg_os_android');
            expect(specificPlatformNames).toContain('adg_ext_chrome');
            expect(specificPlatformNames).toContain('ubo_ext_chrome');
            expect(specificPlatformNames).toContain('abp_ext_chrome');
            expect(specificPlatformNames.length).toBe(18);
        });

        it('should return all generic platform names', () => {
            const { genericPlatformNames } = getAllPlatformNames();

            expect(genericPlatformNames).toContain('adg_os_any');
            expect(genericPlatformNames).toContain('adg_safari_any');
            expect(genericPlatformNames).toContain('adg_ext_chromium');
            expect(genericPlatformNames).toContain('adg_ext_any');
            expect(genericPlatformNames).toContain('adg_any');
            expect(genericPlatformNames).toContain('ubo_ext_chromium');
            expect(genericPlatformNames).toContain('ubo_ext_any');
            expect(genericPlatformNames).toContain('ubo_any');
            expect(genericPlatformNames).toContain('abp_ext_chromium');
            expect(genericPlatformNames).toContain('abp_ext_any');
            expect(genericPlatformNames).toContain('abp_any');
            expect(genericPlatformNames).toContain('any');
            expect(genericPlatformNames.length).toBe(12);
        });

        it('should return readonly arrays', () => {
            const { specificPlatformNames, genericPlatformNames } = getAllPlatformNames();

            // TypeScript should enforce readonly, but we can verify the arrays are created
            expect(Array.isArray(specificPlatformNames)).toBe(true);
            expect(Array.isArray(genericPlatformNames)).toBe(true);
        });

        it('should return unique platform names', () => {
            const { specificPlatformNames, genericPlatformNames } = getAllPlatformNames();

            const specificSet = new Set(specificPlatformNames);
            const genericSet = new Set(genericPlatformNames);

            expect(specificSet.size).toBe(specificPlatformNames.length);
            expect(genericSet.size).toBe(genericPlatformNames.length);
        });

        it('should not have overlap between specific and generic platforms', () => {
            const { specificPlatformNames, genericPlatformNames } = getAllPlatformNames();

            const specificSet = new Set(specificPlatformNames);
            const genericSet = new Set(genericPlatformNames);

            for (const name of specificPlatformNames) {
                expect(genericSet.has(name)).toBe(false);
            }

            for (const name of genericPlatformNames) {
                expect(specificSet.has(name)).toBe(false);
            }
        });
    });
});
