/**
 * @file Platform expression evaluator with support for negation and wildcards.
 */

import { Platform, type SpecificProductCode, type SpecificPlatformType } from './platform';

/**
 * Platform separator, e.g. 'adg_os_any|adg_safari_any' means any AdGuard OS platform and
 * any AdGuard Safari content blocker platform.
 */
export const PLATFORM_SEPARATOR = '|';

/**
 * Platform negation character, e.g. 'adg_any|~adg_cb_android' means any AdGuard product except
 * content blocker on Android.
 *
 * @note Negation is supported via the Platform.negated flag.
 * @note In YAML keys, negated platforms are exclusions - data will NOT be inserted for them.
 */
export const PLATFORM_NEGATION = '~';

/**
 * Evaluates platform expressions with support for negation.
 * Converts expressions like 'adg_os_any|~adg_os_windows' into concrete platform lists.
 *
 * @example
 * ```typescript
 * // Simple expression
 * PlatformExpressionEvaluator.evaluate('adg_os_windows');
 * // Returns: [Platform.AdgOsWindows]
 *
 * // Wildcard expansion
 * PlatformExpressionEvaluator.evaluate('adg_os_any');
 * // Returns: [Platform.AdgOsWindows, Platform.AdgOsLinux, Platform.AdgOsMac, Platform.AdgOsAndroid]
 *
 * // Negation
 * PlatformExpressionEvaluator.evaluate('adg_os_any|~adg_os_windows');
 * // Returns: [Platform.AdgOsLinux, Platform.AdgOsMac, Platform.AdgOsAndroid]
 *
 * // Complex expression
 * PlatformExpressionEvaluator.evaluate('adg_any|~adg_cb_any');
 * // Returns: all AdGuard platforms except content blockers
 * ```
 */
export class PlatformExpressionEvaluator {
    /**
     * Evaluates a platform expression into concrete platforms.
     * Handles wildcards and negation operators.
     *
     * @param expression Platform expression string (e.g., 'adg_os_any|~adg_os_windows').
     * @returns Array of concrete Platform objects after expansion and filtering.
     * @throws Error if expression is empty or contains only negations.
     */
    static evaluate(expression: string): Platform[] {
        const parts = expression
            .split(PLATFORM_SEPARATOR)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

        const positivePlatforms: Platform[] = [];
        const negativePlatforms: Platform[] = [];

        // Parse and categorize platforms
        for (const part of parts) {
            if (part.startsWith(PLATFORM_NEGATION)) {
                // Negated platform
                const platformStr = part.slice(PLATFORM_NEGATION.length).trim();
                negativePlatforms.push(Platform.parse(platformStr));
            } else {
                // Positive platform
                positivePlatforms.push(Platform.parse(part));
            }
        }

        // Expression must contain at least one positive platform
        if (parts.length === 0) {
            throw new Error('Platform expression is empty');
        }

        if (positivePlatforms.length === 0) {
            throw new Error(
                `Platform expression must contain at least one positive (non-negated) platform: '${expression}'`,
            );
        }

        // Expand wildcards to concrete platforms
        const expandedPlatforms = this.expandPlatforms(positivePlatforms);

        // Filter out negated platforms
        const filteredPlatforms = this.filterNegated(expandedPlatforms, negativePlatforms);

        return filteredPlatforms;
    }

    /**
     * Expands wildcard platforms into their concrete matches.
     *
     * @param platforms Array of platforms (may include wildcards).
     * @returns Array of concrete platforms.
     */
    private static expandPlatforms(platforms: Platform[]): Platform[] {
        const result: Platform[] = [];
        const seen = new Set<string>();

        for (const platform of platforms) {
            if (platform.isWildcard) {
                // Expand wildcard to matching concrete platforms
                const matches = this.getConcreteMatches(platform);
                for (const match of matches) {
                    const key = match.toString();
                    if (!seen.has(key)) {
                        seen.add(key);
                        result.push(match);
                    }
                }
            } else {
                // Already concrete
                const key = platform.toString();
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(platform);
                }
            }
        }

        return result;
    }

    /**
     * Gets all concrete platforms that match a wildcard platform.
     *
     * @param wildcard Wildcard platform to match against.
     * @returns Array of matching concrete platforms.
     */
    private static getConcreteMatches(wildcard: Platform): Platform[] {
        const allConcrete = Platform.getAllConcretePlatforms();
        return allConcrete.filter((concrete) => wildcard.matches(concrete));
    }

    /**
     * Converts an array of platforms to a Set of their string representations.
     *
     * @param platforms Array of platforms.
     * @returns Set of platform strings.
     */
    private static toPlatformStringSet(platforms: Platform[]): Set<string> {
        return new Set(platforms.map((p) => p.toString()));
    }

    /**
     * Filters out platforms that match any of the negated patterns.
     *
     * @param platforms Platforms to filter.
     * @param negated Negated platform patterns (may include wildcards).
     * @returns Filtered platforms.
     */
    private static filterNegated(platforms: Platform[], negated: Platform[]): Platform[] {
        if (negated.length === 0) {
            return platforms;
        }

        return platforms.filter((platform) => {
            // Check if this platform matches any negated pattern
            for (const neg of negated) {
                if (neg.matches(platform)) {
                    // Exclude this platform
                    return false;
                }
            }
            // Include this platform
            return true;
        });
    }

    /**
     * Optimizes platform representation by combining concrete platforms into wildcards when possible.
     * Returns the minimal set of platforms needed to represent the input.
     *
     * @param platforms Array of concrete Platform objects.
     * @returns Optimized array with wildcards where possible.
     *
     * @example
     * ```typescript
     * // If all AdGuard OS platforms are present
     * PlatformExpressionEvaluator.optimize([
     *   Platform.AdgOsWindows,
     *   Platform.AdgOsLinux,
     *   Platform.AdgOsMac,
     *   Platform.AdgOsAndroid
     * ]);
     * // Returns: [Platform.AdgOsAny]
     *
     * // If only some platforms are present
     * PlatformExpressionEvaluator.optimize([
     *   Platform.AdgOsWindows,
     *   Platform.AdgOsLinux
     * ]);
     * // Returns: [Platform.AdgOsWindows, Platform.AdgOsLinux]
     * ```
     */
    static optimize(platforms: Platform[]): Platform[] {
        if (platforms.length === 0) {
            return [];
        }

        // Group platforms by product and type
        const groups = new Map<string, Platform[]>();

        for (const platform of platforms) {
            // Skip wildcards - they're already optimized
            if (platform.isWildcard) {
                continue;
            }

            const key = `${platform.product}:${platform.type || ''}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(platform);
        }

        const result: Platform[] = [];

        // Try to optimize each group
        for (const [groupKey, groupPlatforms] of groups) {
            const [product, type] = groupKey.split(':');

            // Get the wildcard that would match this group
            const wildcard = type
                ? new Platform(product as SpecificProductCode, type as SpecificPlatformType)
                : new Platform(product as SpecificProductCode);

            // Get all concrete platforms that match this wildcard
            const allMatches = this.getConcreteMatches(wildcard);

            // If the group contains all possible matches, use the wildcard
            if (groupPlatforms.length === allMatches.length) {
                const groupSet = this.toPlatformStringSet(groupPlatforms);
                const allMatchSet = this.toPlatformStringSet(allMatches);

                // Check if both sets are equal
                let setsEqual = true;
                for (const item of allMatchSet) {
                    if (!groupSet.has(item)) {
                        setsEqual = false;
                        break;
                    }
                }

                if (setsEqual) {
                    result.push(wildcard);
                    continue;
                }
            }

            // Otherwise, add the concrete platforms as-is
            result.push(...groupPlatforms);
        }

        // Re-add any wildcards that were in the input (deduplicating against already-added ones)
        const resultSet = this.toPlatformStringSet(result);
        for (const platform of platforms) {
            if (platform.isWildcard) {
                const key = platform.toString();
                if (!resultSet.has(key)) {
                    resultSet.add(key);
                    result.push(platform);
                }
            }
        }

        // Try product-level optimization (e.g., all adg platforms -> adg_any)
        return this.optimizeProducts(result);
    }

    /**
     * Attempts to optimize at the product level.
     * If all platforms for a product are present, replace with product wildcard.
     *
     * @param platforms Array of platforms (may include type-level wildcards).
     * @returns Optimized array.
     */
    private static optimizeProducts(platforms: Platform[]): Platform[] {
        // Group by product
        const byProduct = new Map<string, Platform[]>();

        for (const platform of platforms) {
            if (!byProduct.has(platform.product)) {
                byProduct.set(platform.product, []);
            }
            byProduct.get(platform.product)!.push(platform);
        }

        const result: Platform[] = [];

        for (const [product, productPlatforms] of byProduct) {
            // Get the product-level wildcard
            const productWildcard = new Platform(product as SpecificProductCode);

            // Get all concrete platforms for this product
            const allProductPlatforms = this.getConcreteMatches(productWildcard);

            // Check if we have complete coverage
            const currentSet = new Set<string>();
            for (const p of productPlatforms) {
                if (p.isWildcard) {
                    // Expand wildcard and add all its matches
                    const matches = this.getConcreteMatches(p);
                    for (const match of matches) {
                        currentSet.add(match.toString());
                    }
                } else {
                    currentSet.add(p.toString());
                }
            }

            const allSet = this.toPlatformStringSet(allProductPlatforms);

            // If current set covers all platforms for this product, use product wildcard
            if (currentSet.size === allSet.size) {
                let allCovered = true;
                for (const item of allSet) {
                    if (!currentSet.has(item)) {
                        allCovered = false;
                        break;
                    }
                }

                if (allCovered) {
                    result.push(productWildcard);
                    continue;
                }
            }

            // Otherwise, add platforms as-is
            result.push(...productPlatforms);
        }

        return result;
    }
}
