import { describe, expect, it } from 'vitest';

import {
    modifiersCompatibilityTable,
    redirectsCompatibilityTable,
    scriptletsCompatibilityTable,
    Platform,
    PlatformExpressionEvaluator,
} from '../../src/compatibility-tables';

/**
 * Integration tests for compatibility tables.
 * Tests real-world scenarios and end-to-end workflows.
 */
describe('Compatibility Tables - Integration', () => {
    describe('cross-product modifier compatibility', () => {
        it('should check common modifiers across all products', () => {
            // Test known common modifiers
            const commonModifiers = ['domain', 'third-party'];

            for (const name of commonModifiers) {
                const adgSupport = modifiersCompatibilityTable.supports(name, Platform.AdgAny);
                const uboSupport = modifiersCompatibilityTable.supports(name, Platform.UboAny);
                const abpSupport = modifiersCompatibilityTable.supports(name, Platform.AbpAny);

                // All should support these common modifiers
                expect(adgSupport).toBe(true);
                expect(uboSupport).toBe(true);
                expect(abpSupport).toBe(true);
            }

            // important is in AdGuard and uBO but not ABP
            expect(modifiersCompatibilityTable.supports('important', Platform.AdgAny)).toBe(true);
            expect(modifiersCompatibilityTable.supports('important', Platform.UboAny)).toBe(true);
        });

        it('should identify product-specific modifiers', () => {
            // Test known product-specific modifiers
            const appAdg = modifiersCompatibilityTable.supports('app', Platform.AdgAny);
            const appUbo = modifiersCompatibilityTable.supports('app', Platform.UboAny);
            const appAbp = modifiersCompatibilityTable.supports('app', Platform.AbpAny);

            // app is AdGuard-only
            expect(appAdg).toBe(true);
            expect(appUbo).toBe(false);
            expect(appAbp).toBe(false);

            // popunder is uBO-only
            const popunderAdg = modifiersCompatibilityTable.supports('popunder', Platform.AdgAny);
            const popunderUbo = modifiersCompatibilityTable.supports('popunder', Platform.UboAny);
            const popunderAbp = modifiersCompatibilityTable.supports('popunder', Platform.AbpAny);

            expect(popunderAdg).toBe(false);
            expect(popunderUbo).toBe(true);
            expect(popunderAbp).toBe(false);
        });
    });

    describe('platform expression to query workflow', () => {
        it('should evaluate expression and query modifiers', () => {
            // 1. Parse platform expression
            const expression = 'adg_any|~adg_cb_any';
            const platforms = PlatformExpressionEvaluator.evaluate(expression);

            // 2. Optimize platform list
            const optimized = PlatformExpressionEvaluator.optimize(platforms);

            // Should optimize to adg_os_any + adg_ext_any
            expect(optimized.length).toBeLessThan(platforms.length);
            expect(optimized.some((p) => p.toString() === 'adg_os_any')).toBe(true);
            expect(optimized.some((p) => p.toString() === 'adg_ext_any')).toBe(true);

            // 3. Query with optimized platforms
            for (const platform of optimized) {
                const results = modifiersCompatibilityTable.queryAll('domain', platform);
                expect(results.length).toBeGreaterThan(0);
            }
        });

        it('should handle complex negation in real-world scenario', () => {
            // All uBO except MV3 extensions
            const expression = 'ubo_ext_any|~ubo_ext_chrome_mv3|~ubo_ext_firefox_mv3'
                + '|~ubo_ext_opera_mv3|~ubo_ext_edge_mv3';
            const platforms = PlatformExpressionEvaluator.evaluate(expression);

            // Should only have non-MV3 platforms
            expect(platforms.every((p) => !p.specific?.includes('mv3'))).toBe(true);
            expect(platforms.length).toBe(4); // chrome, firefox, opera, edge (non-MV3)
        });
    });

    describe('redirect and scriptlet lookup', () => {
        it('should find redirects with resource type modifiers', () => {
            const redirect = redirectsCompatibilityTable.get('noop.txt', Platform.UboExtChrome);

            expect(redirect).not.toBeNull();
            if (redirect) {
                // Get resource type modifiers
                const modifiers = redirectsCompatibilityTable.getResourceTypeModifiers(
                    redirect,
                    Platform.UboExtChrome,
                );

                expect(modifiers).toBeInstanceOf(Set);
                // noop.txt typically has resource type modifiers
                if (redirect.resourceTypes && redirect.resourceTypes.length > 0) {
                    expect(modifiers.size).toBeGreaterThan(0);
                }
            }
        });

        it('should find scriptlets across products with aliases', () => {
            // Some scriptlets have different names across products
            const adgResults = scriptletsCompatibilityTable.queryAll('set-constant', Platform.AdgAny);
            const uboResults = scriptletsCompatibilityTable.queryAll('set-constant', Platform.UboAny);

            // Both should find the scriptlet (possibly under different names/aliases)
            expect(adgResults.length).toBeGreaterThan(0);
            expect(uboResults.length).toBeGreaterThan(0);
        });
    });

    describe('groupByProduct workflow', () => {
        it('should group modifiers by product for documentation', () => {
            const byProduct = modifiersCompatibilityTable.groupByProduct();

            // Returns a Map with product names as keys
            const products = Array.from(byProduct.keys());
            expect(products).toContain('AdGuard');
            expect(products).toContain('UblockOrigin');
            expect(products).toContain('AdblockPlus');

            const adgMap = byProduct.get('AdGuard');
            const uboMap = byProduct.get('UblockOrigin');
            const abpMap = byProduct.get('AdblockPlus');

            // Each product should have multiple modifiers
            expect(adgMap?.size).toBeGreaterThan(10);
            expect(uboMap?.size).toBeGreaterThan(10);
            expect(abpMap?.size).toBeGreaterThan(5);

            // AdGuard should have app modifier
            expect(adgMap?.has('app')).toBe(true);

            // uBO should have popunder
            expect(uboMap?.has('popunder')).toBe(true);
        });

        it('should group redirects by product', () => {
            const byProduct = redirectsCompatibilityTable.groupByProduct();

            const products = Array.from(byProduct.keys());
            expect(products).toContain('AdGuard');
            expect(products).toContain('UblockOrigin');
            expect(products).toContain('AdblockPlus');

            // Each product should have redirects
            const adgMap = byProduct.get('AdGuard');
            const uboMap = byProduct.get('UblockOrigin');

            expect(adgMap?.size).toBeGreaterThan(0);
            expect(uboMap?.size).toBeGreaterThan(0);
        });

        it('should group scriptlets by product', () => {
            const byProduct = scriptletsCompatibilityTable.groupByProduct();

            const products = Array.from(byProduct.keys());
            expect(products).toContain('AdGuard');
            expect(products).toContain('UblockOrigin');
            expect(products).toContain('AdblockPlus');

            // Each product should have scriptlets
            const adgMap = byProduct.get('AdGuard');
            const uboMap = byProduct.get('UblockOrigin');

            expect(adgMap?.size).toBeGreaterThan(0);
            expect(uboMap?.size).toBeGreaterThan(0);
        });
    });

    describe('modifier name normalization', () => {
        it('should normalize noop modifier variations', () => {
            // _ and ____ should both map to the same modifier
            const result1 = modifiersCompatibilityTable.get('_', Platform.AdgExtChrome);
            const result2 = modifiersCompatibilityTable.get('____', Platform.AdgExtChrome);

            expect(result1).not.toBeNull();
            expect(result2).not.toBeNull();

            if (result1 && result2) {
                // Both should map to the same underlying modifier
                expect(result1.name).toBe(result2.name);
            }
        });

        it('should handle noopjs redirect with priority suffix', () => {
            // noopjs:99 should be normalized to noopjs
            const result1 = redirectsCompatibilityTable.get('noopjs', Platform.UboExtChrome);
            const result2 = redirectsCompatibilityTable.get('noopjs:99', Platform.UboExtChrome);

            if (result1 && result2) {
                // Normalized names should match
                expect(result1.name).toBe(result2.name);
            }
        });
    });

    describe('Platform.Any special handling', () => {
        it('should query all products with Platform.Any', () => {
            const results = modifiersCompatibilityTable.queryAll('domain', Platform.Any);

            // Should return results from all products (adg, ubo, abp)
            expect(results.length).toBeGreaterThanOrEqual(3);

            // Results should be deduplicated
            const uniqueResults = new Set(results);
            expect(uniqueResults.size).toBe(results.length);
        });

        it('should check Platform.Any support via queryAll', () => {
            // Platform.Any in queryAll returns results if feature exists anywhere
            const domainResults = modifiersCompatibilityTable.queryAll('domain', Platform.Any);
            expect(domainResults.length).toBeGreaterThan(0);

            const nonExistentResults = modifiersCompatibilityTable.queryAll('nonexistent-modifier', Platform.Any);
            expect(nonExistentResults.length).toBe(0);
        });
    });
});
