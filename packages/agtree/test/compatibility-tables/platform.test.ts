/* eslint-disable no-bitwise */
import { describe, it, expect } from 'vitest';

import { parseRawPlatforms, stringifyPlatforms } from '../../src/compatibility-tables/schemas/platform';
import { GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platforms';

describe('Platform Serialization', () => {
    describe('parseRawPlatforms', () => {
        it('should parse single generic platform', () => {
            expect(parseRawPlatforms('adg_os_any')).toBe(GenericPlatform.AdgOsAny);
            expect(parseRawPlatforms('adg_ext_chromium')).toBe(GenericPlatform.AdgExtChromium);
            expect(parseRawPlatforms('adg_any')).toBe(GenericPlatform.AdgAny);
            expect(parseRawPlatforms('any')).toBe(GenericPlatform.Any);
        });

        it('should parse single specific platform', () => {
            expect(parseRawPlatforms('adg_os_windows')).toBe(SpecificPlatform.AdgOsWindows);
            expect(parseRawPlatforms('adg_ext_chrome')).toBe(SpecificPlatform.AdgExtChrome);
            expect(parseRawPlatforms('ubo_ext_firefox')).toBe(SpecificPlatform.UboExtFirefox);
            expect(parseRawPlatforms('abp_ext_edge')).toBe(SpecificPlatform.AbpExtEdge);
        });

        it('should parse multiple platforms with OR', () => {
            const result = parseRawPlatforms('adg_os_windows|adg_ext_chrome');
            expect(result).toBe(SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgExtChrome);
        });

        it('should parse combination of generic and specific platforms', () => {
            const result = parseRawPlatforms('adg_os_any|ubo_ext_chrome');
            expect(result).toBe(GenericPlatform.AdgOsAny | SpecificPlatform.UboExtChrome);
        });

        it('should handle whitespace correctly', () => {
            expect(parseRawPlatforms('  adg_os_any  ')).toBe(GenericPlatform.AdgOsAny);
            expect(parseRawPlatforms('adg_os_windows | adg_ext_chrome')).toBe(
                SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgExtChrome,
            );
        });

        it('should handle platform negation', () => {
            const result = parseRawPlatforms('adg_any|~adg_safari_any');
            // adg_any with adg_safari_any removed
            expect(result).toBe(GenericPlatform.AdgAny & ~GenericPlatform.AdgSafariAny);
        });

        it('should handle multiple negations', () => {
            const result = parseRawPlatforms('adg_ext_any|~adg_ext_chrome|~adg_ext_opera');
            expect(result).toBe(
                GenericPlatform.AdgExtAny & ~SpecificPlatform.AdgExtChrome & ~SpecificPlatform.AdgExtOpera,
            );
        });

        it('should throw error for unknown platform', () => {
            expect(() => parseRawPlatforms('unknown_platform')).toThrow('Unknown platform: unknown_platform');
        });

        it('should throw error when result is 0', () => {
            expect(() => parseRawPlatforms('adg_os_windows|~adg_os_windows')).toThrow('No platforms specified');
        });
    });

    describe('stringifyPlatforms', () => {
        it('should serialize single generic platform', () => {
            expect(stringifyPlatforms(GenericPlatform.AdgOsAny)).toBe('adg_os_any');
            expect(stringifyPlatforms(GenericPlatform.AdgExtChromium)).toBe('adg_ext_chromium');
            expect(stringifyPlatforms(GenericPlatform.AdgAny)).toBe('adg_any');
            expect(stringifyPlatforms(GenericPlatform.Any)).toBe('any');
        });

        it('should serialize single specific platform', () => {
            expect(stringifyPlatforms(SpecificPlatform.AdgOsWindows)).toBe('adg_os_windows');
            expect(stringifyPlatforms(SpecificPlatform.AdgExtChrome)).toBe('adg_ext_chrome');
            expect(stringifyPlatforms(SpecificPlatform.UboExtFirefox)).toBe('ubo_ext_firefox');
            expect(stringifyPlatforms(SpecificPlatform.AbpExtEdge)).toBe('abp_ext_edge');
        });

        it('should prefer generic platforms over specific combinations', () => {
            // AdgOsAny = AdgOsWindows | AdgOsMac | AdgOsAndroid
            const bitmask = SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgOsMac | SpecificPlatform.AdgOsAndroid;
            expect(stringifyPlatforms(bitmask)).toBe('adg_os_any');
        });

        it('should serialize combination of generic platforms', () => {
            const bitmask = GenericPlatform.AdgOsAny | GenericPlatform.UboExtAny;
            const result = stringifyPlatforms(bitmask);
            expect(result).toContain('adg_os_any');
            expect(result).toContain('ubo_ext_any');
            expect(result.split('|')).toHaveLength(2);
        });

        it('should serialize mixed generic and specific platforms', () => {
            const bitmask = GenericPlatform.AdgOsAny | SpecificPlatform.UboExtChrome;
            const result = stringifyPlatforms(bitmask);
            expect(result).toContain('adg_os_any');
            expect(result).toContain('ubo_ext_chrome');
            expect(result.split('|')).toHaveLength(2);
        });

        it('should serialize multiple specific platforms', () => {
            const bitmask = SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgExtChrome;
            const result = stringifyPlatforms(bitmask);
            expect(result).toContain('adg_os_windows');
            expect(result).toContain('adg_ext_chrome');
            expect(result.split('|')).toHaveLength(2);
        });

        it('should handle Safari platforms correctly', () => {
            // AdgSafariAny = AdgCbSafari | AdgCbIos
            const bitmask = SpecificPlatform.AdgCbSafari | SpecificPlatform.AdgCbIos;
            expect(stringifyPlatforms(bitmask)).toBe('adg_safari_any');
        });

        it('should handle Chromium extensions correctly', () => {
            // AdgExtChromium = AdgExtChrome | AdgExtOpera | AdgExtEdge
            const bitmask = SpecificPlatform.AdgExtChrome | SpecificPlatform.AdgExtOpera | SpecificPlatform.AdgExtEdge;
            expect(stringifyPlatforms(bitmask)).toBe('adg_ext_chromium');
        });

        it('should throw error for bitmask 0', () => {
            expect(() => stringifyPlatforms(0)).toThrow('Invalid bitmask: 0');
        });

        it('should throw error for unknown platform bits', () => {
            // Use a bitmask with bits that don't correspond to any platform
            const invalidBitmask = 1 << 30;
            expect(() => stringifyPlatforms(invalidBitmask)).toThrow('Unknown platform bits in bitmask');
        });
    });

    describe('Round-trip conversion', () => {
        it('should correctly round-trip single generic platforms', () => {
            const platforms = [
                'adg_os_any',
                'adg_safari_any',
                'adg_ext_chromium',
                'adg_ext_any',
                'adg_any',
                'ubo_ext_chromium',
                'ubo_ext_any',
                'abp_ext_chromium',
                'abp_ext_any',
                'any',
            ];

            for (const platform of platforms) {
                const bitmask = parseRawPlatforms(platform);
                const serialized = stringifyPlatforms(bitmask);
                expect(serialized).toBe(platform);
            }
        });

        it('should handle equivalent generic platforms', () => {
            // ubo_any and ubo_ext_any have the same bitmask (UBO only has extensions)
            const uboBitmask = parseRawPlatforms('ubo_any');
            expect(stringifyPlatforms(uboBitmask)).toBe('ubo_ext_any');
            expect(parseRawPlatforms('ubo_ext_any')).toBe(uboBitmask);

            // abp_any and abp_ext_any have the same bitmask (ABP only has extensions)
            const abpBitmask = parseRawPlatforms('abp_any');
            expect(stringifyPlatforms(abpBitmask)).toBe('abp_ext_any');
            expect(parseRawPlatforms('abp_ext_any')).toBe(abpBitmask);
        });

        it('should correctly round-trip single specific platforms', () => {
            const platforms = [
                'adg_os_windows',
                'adg_os_mac',
                'adg_os_android',
                'adg_ext_chrome',
                'adg_ext_opera',
                'adg_ext_edge',
                'adg_ext_firefox',
                'adg_cb_android',
                'adg_cb_ios',
                'adg_cb_safari',
                'ubo_ext_chrome',
                'ubo_ext_opera',
                'ubo_ext_edge',
                'ubo_ext_firefox',
                'abp_ext_chrome',
                'abp_ext_opera',
                'abp_ext_edge',
                'abp_ext_firefox',
            ];

            for (const platform of platforms) {
                const bitmask = parseRawPlatforms(platform);
                const serialized = stringifyPlatforms(bitmask);
                expect(serialized).toBe(platform);
            }
        });

        it('should round-trip combinations preferring generic platforms', () => {
            // When serializing, generic platforms should be preferred
            const input = 'adg_os_windows|adg_os_mac|adg_os_android';
            const bitmask = parseRawPlatforms(input);
            const serialized = stringifyPlatforms(bitmask);
            // Should be converted to the generic equivalent
            expect(serialized).toBe('adg_os_any');
            // Should round-trip correctly
            expect(parseRawPlatforms(serialized)).toBe(bitmask);
        });

        it('should round-trip complex combinations', () => {
            const input = 'adg_os_windows|ubo_ext_chrome|abp_ext_firefox';
            const bitmask = parseRawPlatforms(input);
            const serialized = stringifyPlatforms(bitmask);
            // Should round-trip to the same bitmask
            expect(parseRawPlatforms(serialized)).toBe(bitmask);
        });

        it('should handle negation and preserve semantics', () => {
            const input = 'adg_any|~adg_safari_any';
            const bitmask = parseRawPlatforms(input);
            const serialized = stringifyPlatforms(bitmask);
            // The serialized form might be different but should have same bitmask
            expect(parseRawPlatforms(serialized)).toBe(bitmask);
        });
    });
});
