import { describe, it, expect } from 'vitest';

import { Platform, PlatformExpressionEvaluator } from '../../src/compatibility-tables';

describe('PlatformExpressionEvaluator', () => {
    describe('evaluate', () => {
        it('should handle simple platform expressions', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_os_windows');
            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('adg_os_windows');
        });

        it('should handle multiple platforms without negation', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_os_windows|ubo_ext_chrome');
            expect(result).toHaveLength(2);
            expect(result[0].toString()).toBe('adg_os_windows');
            expect(result[1].toString()).toBe('ubo_ext_chrome');
        });

        it('should expand wildcard platforms', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_os_any');
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).toContain('adg_os_windows');
            expect(resultStrings).toContain('adg_os_mac');
            expect(resultStrings).toContain('adg_os_android');
            expect(resultStrings).toContain('adg_os_linux');
            expect(resultStrings).toHaveLength(4);
        });

        it('should handle negation - remove specific platform from wildcard', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_os_any|~adg_os_windows');
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).not.toContain('adg_os_windows');
            expect(resultStrings).toContain('adg_os_mac');
            expect(resultStrings).toContain('adg_os_android');
            expect(resultStrings).toContain('adg_os_linux');
            expect(resultStrings).toHaveLength(3);
        });

        it('should handle negation - remove multiple specific platforms', () => {
            const result = PlatformExpressionEvaluator.evaluate(
                'adg_os_any|~adg_os_windows|~adg_os_mac',
            );
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).not.toContain('adg_os_windows');
            expect(resultStrings).not.toContain('adg_os_mac');
            expect(resultStrings).toContain('adg_os_android');
            expect(resultStrings).toContain('adg_os_linux');
            expect(resultStrings).toHaveLength(2);
        });

        it('should handle negation - remove wildcard from larger wildcard', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_any|~adg_cb_any');
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).toContain('adg_os_windows');
            expect(resultStrings).toContain('adg_ext_chrome');
            expect(resultStrings).not.toContain('adg_cb_ios');
            expect(resultStrings).not.toContain('adg_cb_safari');
            expect(resultStrings).not.toContain('adg_cb_android');
        });

        it('should handle complex expression with multiple products and negation', () => {
            const result = PlatformExpressionEvaluator.evaluate(
                'adg_ext_any|ubo_ext_firefox|~adg_ext_chrome',
            );
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).toContain('ubo_ext_firefox');
            expect(resultStrings).toContain('adg_ext_firefox');
            expect(resultStrings).toContain('adg_ext_opera');
            expect(resultStrings).not.toContain('adg_ext_chrome');
        });

        it('should throw for expression with only negation', () => {
            expect(() => PlatformExpressionEvaluator.evaluate('~adg_os_windows')).toThrow(
                'must contain at least one positive',
            );
        });

        it('should deduplicate platforms', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_os_windows|adg_os_windows');
            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('adg_os_windows');
        });

        it('should handle wildcard deduplication', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_os_any|adg_os_windows');
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).toContain('adg_os_windows');
            expect(resultStrings).toContain('adg_os_mac');
            expect(resultStrings).toContain('adg_os_android');
            expect(resultStrings).toContain('adg_os_linux');
            expect(resultStrings).toHaveLength(4);
        });

        it('should handle edge case: negate everything from a wildcard', () => {
            const result = PlatformExpressionEvaluator.evaluate(
                'adg_cb_any|~adg_cb_ios|~adg_cb_safari|~adg_cb_android',
            );
            expect(result).toHaveLength(0);
        });

        it('should handle product-level wildcards', () => {
            const result = PlatformExpressionEvaluator.evaluate('ubo_any');
            const resultStrings = result.map((p) => p.toString()).sort();

            // Should have all uBlock Origin platforms
            expect(resultStrings).toContain('ubo_ext_chrome');
            expect(resultStrings).toContain('ubo_ext_firefox');
            expect(resultStrings.every((s) => s.startsWith('ubo_'))).toBe(true);
        });

        it('should handle negation with product-level wildcards', () => {
            const result = PlatformExpressionEvaluator.evaluate('ubo_any|~ubo_ext_chrome');
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).not.toContain('ubo_ext_chrome');
            expect(resultStrings).toContain('ubo_ext_firefox');
            expect(resultStrings).toContain('ubo_ext_opera');
        });

        it('should handle MV3 platforms correctly', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_ext_any|~adg_ext_chrome_mv3');
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).not.toContain('adg_ext_chrome_mv3');
            expect(resultStrings).toContain('adg_ext_chrome');
            expect(resultStrings).toContain('adg_ext_firefox');
        });

        it('should preserve platform object properties', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_os_windows');

            expect(result[0].product).toBe('adg');
            expect(result[0].type).toBe('os');
            expect(result[0].specific).toBe('windows');
            expect(result[0].isWildcard).toBe(false);
        });

        it('should expand concrete platforms from wildcard matches', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_ext_any');

            // All results should be concrete (non-wildcard)
            expect(result.every((p) => !p.isWildcard)).toBe(true);
        });

        it('should throw for empty expression', () => {
            expect(() => PlatformExpressionEvaluator.evaluate('')).toThrow(
                'Platform expression is empty',
            );
        });

        it('should handle whitespace in expressions', () => {
            const result = PlatformExpressionEvaluator.evaluate('  adg_os_windows  |  ubo_ext_chrome  ');
            expect(result).toHaveLength(2);
            expect(result[0].toString()).toBe('adg_os_windows');
            expect(result[1].toString()).toBe('ubo_ext_chrome');
        });

        it('should handle real-world case: all AdGuard except Safari blockers', () => {
            const result = PlatformExpressionEvaluator.evaluate('adg_any|~adg_cb_ios|~adg_cb_safari');
            const resultStrings = result.map((p) => p.toString()).sort();

            expect(resultStrings).not.toContain('adg_cb_ios');
            expect(resultStrings).not.toContain('adg_cb_safari');
            expect(resultStrings).toContain('adg_cb_android');
            expect(resultStrings).toContain('adg_os_windows');
            expect(resultStrings).toContain('adg_ext_chrome');
        });
    });

    describe('optimize', () => {
        it('should return empty array for empty input', () => {
            const result = PlatformExpressionEvaluator.optimize([]);
            expect(result).toHaveLength(0);
        });

        it('should not optimize single platform', () => {
            const platforms = PlatformExpressionEvaluator.evaluate('adg_os_windows');
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('adg_os_windows');
            expect(result[0].isWildcard).toBe(false);
        });

        it('should not optimize partial type group', () => {
            const platforms = PlatformExpressionEvaluator.evaluate('adg_os_windows|adg_os_mac');
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(2);
            const resultStrings = result.map((p) => p.toString()).sort();
            expect(resultStrings).toEqual(['adg_os_mac', 'adg_os_windows']);
        });

        it('should optimize complete type group to type wildcard', () => {
            // All adg_os platforms: windows, mac, linux, android
            const platforms = PlatformExpressionEvaluator.evaluate(
                'adg_os_windows|adg_os_mac|adg_os_linux|adg_os_android',
            );
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('adg_os_any');
            expect(result[0].isWildcard).toBe(true);
        });

        it('should optimize complete adg_cb group to type wildcard', () => {
            // All adg_cb platforms: ios, safari, android
            const platforms = PlatformExpressionEvaluator.evaluate(
                'adg_cb_ios|adg_cb_safari|adg_cb_android',
            );
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('adg_cb_any');
            expect(result[0].isWildcard).toBe(true);
        });

        it('should optimize all AdGuard platforms to product wildcard', () => {
            // All AdGuard platforms across all types
            const platforms = PlatformExpressionEvaluator.evaluate('adg_any');
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('adg_any');
            expect(result[0].isWildcard).toBe(true);
        });

        it('should optimize all uBlock Origin platforms to product wildcard', () => {
            const platforms = PlatformExpressionEvaluator.evaluate('ubo_any');
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('ubo_any');
            expect(result[0].isWildcard).toBe(true);
        });

        it('should optimize multiple complete type groups', () => {
            // Complete adg_os group + complete ubo_ext group
            // Note: ubo_ext_any gets further optimized to ubo_any since uBO only has ext platforms
            const platforms = PlatformExpressionEvaluator.evaluate('adg_os_any|ubo_ext_any');
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(2);
            const resultStrings = result.map((p) => p.toString()).sort();
            expect(resultStrings).toEqual(['adg_os_any', 'ubo_any']);
        });

        it('should preserve existing wildcards in input', () => {
            const platforms = PlatformExpressionEvaluator.evaluate('adg_os_any|adg_ext_chrome');
            const result = PlatformExpressionEvaluator.optimize(platforms);

            // Should keep adg_os_any and adg_ext_chrome separately
            expect(result.length).toBeGreaterThanOrEqual(2);
            const resultStrings = result.map((p) => p.toString());
            expect(resultStrings).toContain('adg_os_any');
            expect(resultStrings).toContain('adg_ext_chrome');
        });

        it('should optimize type wildcards to product wildcard when complete', () => {
            // All three AdGuard type groups
            const platforms = PlatformExpressionEvaluator.evaluate('adg_os_any|adg_ext_any|adg_cb_any');
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('adg_any');
            expect(result[0].isWildcard).toBe(true);
        });

        it('should handle mixed concrete and wildcard platforms', () => {
            // One complete type group + one partial type group
            const platforms = PlatformExpressionEvaluator.evaluate(
                'adg_os_windows|adg_os_mac|adg_os_linux|adg_os_android|ubo_ext_chrome',
            );
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(2);
            const resultStrings = result.map((p) => p.toString()).sort();
            expect(resultStrings).toContain('adg_os_any');
            expect(resultStrings).toContain('ubo_ext_chrome');
        });

        it('should optimize concrete platforms from evaluate result', () => {
            // Evaluate expands wildcard, then optimize should collapse it back
            const evaluated = PlatformExpressionEvaluator.evaluate('adg_cb_any');
            const optimized = PlatformExpressionEvaluator.optimize(evaluated);

            expect(optimized).toHaveLength(1);
            expect(optimized[0].toString()).toBe('adg_cb_any');
        });

        it('should handle platforms from different products', () => {
            const platforms = PlatformExpressionEvaluator.evaluate(
                'adg_os_windows|ubo_ext_chrome|abp_ext_firefox',
            );
            const result = PlatformExpressionEvaluator.optimize(platforms);

            expect(result).toHaveLength(3);
            const resultStrings = result.map((p) => p.toString()).sort();
            expect(resultStrings).toEqual(['abp_ext_firefox', 'adg_os_windows', 'ubo_ext_chrome']);
        });

        it('should optimize complete AdGuard ext group including MV3 platforms', () => {
            // All adg_ext platforms (chrome, opera, edge, firefox + MV3 variants)
            const allAdgExt = PlatformExpressionEvaluator.evaluate('adg_ext_any');
            const result = PlatformExpressionEvaluator.optimize(allAdgExt);

            expect(result).toHaveLength(1);
            expect(result[0].toString()).toBe('adg_ext_any');
        });

        it('should not optimize incomplete ext group (missing MV3 platforms)', () => {
            // Only non-MV3 platforms
            const platforms = PlatformExpressionEvaluator.evaluate(
                'adg_ext_chrome|adg_ext_firefox|adg_ext_opera|adg_ext_edge',
            );
            const result = PlatformExpressionEvaluator.optimize(platforms);

            // Should keep as individual platforms since MV3 variants are missing
            expect(result.length).toBeGreaterThan(1);
            expect(result.every((p) => !p.isWildcard)).toBe(true);
        });

        it('should be idempotent - optimizing twice gives same result', () => {
            const platforms = PlatformExpressionEvaluator.evaluate('adg_os_any');
            const optimized1 = PlatformExpressionEvaluator.optimize(platforms);
            const optimized2 = PlatformExpressionEvaluator.optimize(optimized1);

            expect(optimized1.map((p) => p.toString())).toEqual(
                optimized2.map((p) => p.toString()),
            );
        });

        it('should optimize real-world case: all platforms except one', () => {
            // AdGuard any minus one platform - should NOT fully optimize
            const platforms = PlatformExpressionEvaluator.evaluate('adg_any|~adg_os_windows');
            const result = PlatformExpressionEvaluator.optimize(platforms);

            // Should have multiple items (can't use adg_any wildcard)
            expect(result.length).toBeGreaterThan(1);
            // But type groups should still be optimized where possible
            const resultStrings = result.map((p) => p.toString());
            expect(resultStrings).toContain('adg_ext_any');
            expect(resultStrings).toContain('adg_cb_any');
        });

        it('should handle duplicates in input (no deduplication)', () => {
            // optimize() doesn't deduplicate - duplicates are processed separately
            const platforms = [
                ...PlatformExpressionEvaluator.evaluate('adg_os_windows'),
                ...PlatformExpressionEvaluator.evaluate('adg_os_windows'),
            ];
            const result = PlatformExpressionEvaluator.optimize(platforms);

            // Both duplicates remain in output
            expect(result).toHaveLength(2);
            expect(result[0].toString()).toBe('adg_os_windows');
            expect(result[1].toString()).toBe('adg_os_windows');
        });

        it('should not produce duplicate wildcards when collapsing', () => {
            // Input: all concrete AdGuard OS platforms + the AdgOsAny wildcard
            // Without dedupe, optimize would output AdgOsAny twice
            const platforms = [
                ...PlatformExpressionEvaluator.evaluate('adg_os_any'),
                Platform.AdgOsAny,
            ];
            const result = PlatformExpressionEvaluator.optimize(platforms);
            const resultStrings = result.map((p) => p.toString());

            // adg_os_any should appear exactly once
            expect(resultStrings.filter((s) => s === 'adg_os_any')).toHaveLength(1);
        });
    });
});
