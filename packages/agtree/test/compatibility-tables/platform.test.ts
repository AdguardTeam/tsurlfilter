import { describe, it, expect } from 'vitest';

import { Platform } from '../../src/compatibility-tables';

describe('Platform', () => {
    describe('parse', () => {
        it('should parse specific platforms', () => {
            const platform = Platform.parse('adg_os_windows');
            expect(platform.product).toBe('adg');
            expect(platform.type).toBe('os');
            expect(platform.specific).toBe('windows');
            expect(platform.isWildcard).toBe(false);
        });

        it('should parse wildcard platforms', () => {
            const platform = Platform.parse('adg_os_any');
            expect(platform.product).toBe('adg');
            expect(platform.type).toBe('os');
            expect(platform.specific).toBeUndefined();
            expect(platform.isWildcard).toBe(true);
        });

        it('should parse product-level wildcards', () => {
            const platform = Platform.parse('adg_any');
            expect(platform.product).toBe('adg');
            expect(platform.type).toBeUndefined();
            expect(platform.specific).toBeUndefined();
            expect(platform.isWildcard).toBe(true);
        });

        it('should parse any platform', () => {
            const platform = Platform.parse('any');
            expect(platform.product).toBe('any');
            expect(platform.isWildcard).toBe(true);
        });

        it('should throw on invalid product code', () => {
            expect(() => Platform.parse('xyz_os_windows')).toThrow('Invalid product code');
        });

        it('should throw on invalid platform type', () => {
            expect(() => Platform.parse('adg_foo_bar')).toThrow('Invalid platform type');
        });
    });

    describe('toString', () => {
        it('should serialize platforms correctly', () => {
            expect(Platform.AdgOsWindows.toString()).toBe('adg_os_windows');
            expect(Platform.AdgOsAny.toString()).toBe('adg_os_any');
            expect(Platform.AdgAny.toString()).toBe('adg_any');
            expect(Platform.Any.toString()).toBe('any');
        });
    });

    describe('matches', () => {
        it('should match wildcards to specific platforms', () => {
            expect(Platform.AdgOsAny.matches(Platform.AdgOsWindows)).toBe(true);
            expect(Platform.AdgAny.matches(Platform.AdgOsWindows)).toBe(true);
            expect(Platform.Any.matches(Platform.AdgOsWindows)).toBe(true);
        });

        it('should not match different products', () => {
            expect(Platform.AdgOsAny.matches(Platform.UboExtChrome)).toBe(false);
        });

        it('should not match different types', () => {
            expect(Platform.AdgOsAny.matches(Platform.AdgExtChrome)).toBe(false);
        });
    });
});
