/**
 * @file New compatibility table base class with Platform-based queries.
 */

import { type Node } from '../nodes';
import { type AdblockProduct } from '../utils/adblockers';

import {
    getValidAdblockProducts,
    getValidProductCodes,
    Platform,
    WILDCARD_ANY,
} from './platform';
import { GenericPlatform, SpecificPlatform } from './platform-compat';
import { type BaseCompatibilityDataSchema } from './schemas';
import { type CompatibilityTable, type HybridCompatibilityTableRow } from './types';
import { type ValidationContext } from './validators/types';

/**
 * Lists all supported entity records by a product.
 *
 * Keys are compatibility flags, values are compatibility data records.
 *
 * @template T Compatibility data schema.
 */
export type ProductRecords<T> = {
    [key: string]: T;
};

/**
 * Defines a compatibility table row by product.
 *
 * Keys are Adblock products, values are product records.
 *
 * @template T Compatibility data schema.
 */
export type RowByProduct<T> = {
    [AdblockProduct.Adg]: ProductRecords<T>;
    [AdblockProduct.Ubo]: ProductRecords<T>;
    [AdblockProduct.Abp]: ProductRecords<T>;
};

/**
 * Defines multiple compatibility table rows by product.
 *
 * @template T Compatibility data schema.
 */
export type RowsByProduct<T> = RowByProduct<T>[];

/**
 * Name transformer function type.
 *
 * @param name Compatibility data name.
 *
 * @returns Normalized name.
 */
type NameTransformer = (name: string) => string;

/**
 * Base compatibility table class with hierarchical platform queries.
 *
 * @template T Compatibility data schema.
 */
export abstract class CompatibilityTableBase<T extends BaseCompatibilityDataSchema> {
    /**
     * Compatibility table data.
     */
    private data: CompatibilityTable<T>;

    /**
     * Optional name transformer function.
     */
    protected readonly nameTransformer: NameTransformer | null;

    /**
     * Creates a new compatibility table.
     *
     * @param data Compatibility table data.
     * @param nameTransformer Optional name transformer.
     */
    constructor(data: CompatibilityTable<T>, nameTransformer: NameTransformer | null = null) {
        this.data = data;
        this.nameTransformer = nameTransformer;
    }

    /**
     * Normalizes a feature name using the transformer if available.
     *
     * @param name Feature name.
     *
     * @returns Normalized name.
     */
    private normalizeName(name: string): string {
        return this.nameTransformer ? this.nameTransformer(name) : name;
    }

    /**
     * Gets the compatibility row for a feature name.
     *
     * @param name Feature name.
     *
     * @returns Compatibility row or undefined.
     */
    private getRow(name: string) {
        const normalizedName = this.normalizeName(name);
        return this.data.rows.get(normalizedName);
    }

    /**
     * Checks if a feature exists for any platform.
     *
     * @param name Feature name.
     *
     * @returns True if feature exists.
     */
    public has(name: string): boolean {
        return this.getRow(name) !== undefined;
    }

    /**
     * Backwards-compatible feature existence check.
     *
     * AGTree v4 consumers (e.g. `@adguard/scriptlets` v2.x) call
     * `exists(name, GenericPlatform.X)` with a bitmask platform. AGTree v5
     * exposes {@link Platform} instead, so this method maps legacy bitmask
     * platforms onto equivalent `Platform` queries and delegates to
     * {@link supports}.
     *
     * @param name Feature name.
     * @param platform Platform query, or a legacy `GenericPlatform` /
     *   `SpecificPlatform` bitmask.
     *
     * @returns True if the feature exists for the platform.
     *
     * @throws Error when a numeric platform bitmask cannot be mapped to a v5
     *   platform. Unmapped masks are rejected instead of being approximated by
     *   name existence, so callers get an explicit signal during migration.
     */
    public exists(name: string, platform: Platform | number): boolean {
        if (typeof platform !== 'number') {
            return this.supports(name, platform);
        }

        const mapped = CompatibilityTableBase.mapLegacyPlatform(platform);
        if (mapped.length === 0) {
            throw new Error(`Unsupported legacy platform bitmask: ${platform}`);
        }

        return mapped.some((mappedPlatform) => this.supports(name, mappedPlatform));
    }

    /**
     * Maps a legacy v4 platform bitmask onto equivalent v5 {@link Platform}
     * queries. Combined masks without an exact v5 wildcard are expanded into
     * their concrete members, so the platform restriction is preserved rather
     * than approximated by name existence.
     *
     * @param bitmask Legacy `GenericPlatform` / `SpecificPlatform` value.
     *
     * @returns Equivalent `Platform` queries, or an empty array when no
     *   mapping exists.
     */
    private static mapLegacyPlatform(bitmask: number): Platform[] {
        switch (bitmask) {
            // Specific platforms — map 1:1 onto concrete v5 platforms.
            case SpecificPlatform.AdgOsWindows: return [Platform.AdgOsWindows];
            case SpecificPlatform.AdgOsMac: return [Platform.AdgOsMac];
            case SpecificPlatform.AdgOsAndroid: return [Platform.AdgOsAndroid];
            case SpecificPlatform.AdgExtChrome: return [Platform.AdgExtChrome];
            case SpecificPlatform.AdgExtOpera: return [Platform.AdgExtOpera];
            case SpecificPlatform.AdgExtEdge: return [Platform.AdgExtEdge];
            case SpecificPlatform.AdgExtFirefox: return [Platform.AdgExtFirefox];
            case SpecificPlatform.AdgCbAndroid: return [Platform.AdgCbAndroid];
            case SpecificPlatform.AdgCbIos: return [Platform.AdgCbIos];
            case SpecificPlatform.AdgCbSafari: return [Platform.AdgCbSafari];
            case SpecificPlatform.UboExtChrome: return [Platform.UboExtChrome];
            case SpecificPlatform.UboExtOpera: return [Platform.UboExtOpera];
            case SpecificPlatform.UboExtEdge: return [Platform.UboExtEdge];
            case SpecificPlatform.UboExtFirefox: return [Platform.UboExtFirefox];
            case SpecificPlatform.AbpExtChrome: return [Platform.AbpExtChrome];
            case SpecificPlatform.AbpExtOpera: return [Platform.AbpExtOpera];
            case SpecificPlatform.AbpExtEdge: return [Platform.AbpExtEdge];
            case SpecificPlatform.AbpExtFirefox: return [Platform.AbpExtFirefox];

            // Generic masks with an exact v5 wildcard.
            case GenericPlatform.AdgAny: return [Platform.AdgAny];
            case GenericPlatform.AdgOsAny: return [Platform.AdgOsAny];
            case GenericPlatform.AdgExtAny: return [Platform.AdgExtAny];
            // UboAny === UboExtAny, AbpAny === AbpExtAny in the legacy layout.
            case GenericPlatform.UboAny: return [Platform.UboAny];
            case GenericPlatform.AbpAny: return [Platform.AbpAny];

            // Chromium-only masks have no exact v5 wildcard — expand to members.
            case GenericPlatform.AdgExtChromium:
                return [Platform.AdgExtChrome, Platform.AdgExtOpera, Platform.AdgExtEdge];
            case GenericPlatform.UboExtChromium:
                return [Platform.UboExtChrome, Platform.UboExtOpera, Platform.UboExtEdge];
            case GenericPlatform.AbpExtChromium:
                return [Platform.AbpExtChrome, Platform.AbpExtOpera, Platform.AbpExtEdge];

            // AdgSafariAny combines the Safari/iOS content-blocker platforms;
            // v5 stores those under the `cb` type, not a `safari` wildcard.
            case GenericPlatform.AdgSafariAny:
                return [Platform.AdgCbSafari, Platform.AdgCbIos];

            // Any product — query each product wildcard (the v5 trie has no
            // 'any' path for the single-platform `supports` lookup).
            case GenericPlatform.Any:
                return [Platform.AdgAny, Platform.UboAny, Platform.AbpAny];

            default:
                return [];
        }
    }

    /**
     * Checks if a feature is supported on the specified platform.
     *
     * @param name Feature name.
     * @param platform Platform to check.
     *
     * @returns True if supported on this platform.
     */
    public supports(name: string, platform: Platform): boolean {
        const row = this.getRow(name);
        if (!row) {
            return false;
        }

        // For specific platforms, use flat map (O(1))
        if (!platform.isWildcard) {
            return row.flatMap.has(platform.toString());
        }

        // For wildcards, use trie
        return row.trie.has(platform.toPath());
    }

    /**
     * Gets compatibility data for a specific platform.
     *
     * @param name Feature name.
     * @param platform Platform (must be specific, not wildcard).
     *
     * @returns Compatibility data or null.
     */
    public get(name: string, platform: Platform): T | null {
        const row = this.getRow(name);
        if (!row) {
            return null;
        }

        // Only works with specific platforms
        if (platform.isWildcard) {
            throw new Error('get() requires a specific platform. Use queryAll() for wildcards.');
        }

        return row.flatMap.get(platform.toString()) || null;
    }

    /**
     * Queries all compatibility data matching the platform query.
     * Supports wildcard platforms.
     *
     * @param name Feature name.
     * @param platform Platform query (can be wildcard).
     *
     * @returns Array of matching compatibility data.
     */
    public queryAll(name: string, platform: Platform): T[] {
        const row = this.getRow(name);
        if (!row) {
            return [];
        }

        // For specific platforms, return single result
        if (!platform.isWildcard) {
            const data = row.flatMap.get(platform.toString());
            return data ? [data] : [];
        }

        // Special case: Platform.Any (global wildcard across all products)
        // Query all product paths since there's no 'any' key in the data
        if (platform.toString() === WILDCARD_ANY) {
            const results: T[] = [];
            const seen = new Set<T>();

            // Query each known product path
            for (const code of getValidProductCodes()) {
                const productResults = row.trie.query([code]);
                for (const item of productResults) {
                    if (!seen.has(item)) {
                        seen.add(item);
                        results.push(item);
                    }
                }
            }

            return results;
        }

        // For other wildcards, use trie query and deduplicate by object identity
        const results = row.trie.query(platform.toPath());
        const seen = new Set<T>();
        const deduplicated: T[] = [];

        for (const item of results) {
            if (!seen.has(item)) {
                seen.add(item);
                deduplicated.push(item);
            }
        }

        return deduplicated;
    }

    /**
     * Gets all features supported by the platform.
     *
     * @param platform Platform query.
     *
     * @returns Map of feature names to their compatibility data.
     */
    public getAll(platform: Platform): Map<string, T[]> {
        const results = new Map<string, T[]>();

        for (const [name, row] of this.data.rows.entries()) {
            // For specific platforms
            if (!platform.isWildcard) {
                const data = row.flatMap.get(platform.toString());
                if (data) {
                    results.set(name, [data]);
                }
            } else if (platform.toString() === WILDCARD_ANY) {
                // Special case: Platform.Any (global wildcard across all products)
                const deduplicated: T[] = [];
                const seen = new Set<T>();

                for (const code of getValidProductCodes()) {
                    const productResults = row.trie.query([code]);
                    for (const item of productResults) {
                        if (!seen.has(item)) {
                            seen.add(item);
                            deduplicated.push(item);
                        }
                    }
                }

                if (deduplicated.length > 0) {
                    results.set(name, deduplicated);
                }
            } else {
                // For other wildcards, use trie query and deduplicate
                const matches = row.trie.query(platform.toPath());
                const seen = new Set<T>();
                const deduplicated: T[] = [];

                for (const item of matches) {
                    if (!seen.has(item)) {
                        seen.add(item);
                        deduplicated.push(item);
                    }
                }

                if (deduplicated.length > 0) {
                    results.set(name, deduplicated);
                }
            }
        }

        return results;
    }

    /**
     * Queries the first matching compatibility data for the platform.
     * Supports wildcard platforms.
     *
     * @param name Feature name.
     * @param platform Platform query (can be wildcard).
     *
     * @returns First matching data or null.
     */
    public query(name: string, platform: Platform): T | null {
        const results = this.queryAll(name, platform);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Gets all platform variants of a feature.
     *
     * @param name Feature name.
     *
     * @returns Array of all variants across all platforms.
     */
    public getAllVariants(name: string): T[] {
        const row = this.getRow(name);
        if (!row) {
            return [];
        }

        return row.shared;
    }

    /**
     * Groups all features by adblocker product.
     *
     * @returns Map of products to their feature maps.
     */
    public groupByProduct(): Map<AdblockProduct, Map<string, T[]>> {
        const productMap = new Map<AdblockProduct, Map<string, T[]>>();

        // Initialize maps for each product
        for (const product of getValidAdblockProducts()) {
            productMap.set(product, new Map());
        }

        // Track already-processed rows to avoid duplicates from aliases
        const processedRows = new Set<HybridCompatibilityTableRow<T>>();

        // Iterate through all features
        for (const [, row] of this.data.rows.entries()) {
            // Skip if we've already processed this row object (aliased entry)
            if (processedRows.has(row)) {
                continue;
            }
            processedRows.add(row);

            // Get canonical feature name from first data entry
            const firstData = row.flatMap.values().next().value;
            if (!firstData) {
                continue; // Empty row, skip
            }
            const canonicalName = firstData.name;

            // Group platforms by product
            for (const [platformStr, data] of row.flatMap.entries()) {
                const platform = Platform.parse(platformStr);

                const productEnum = platform.getProductEnum();
                if (productEnum === WILDCARD_ANY) {
                    continue; // Skip wildcard
                }
                const product: AdblockProduct = productEnum;

                const featureMap = productMap.get(product)!;
                if (!featureMap.has(canonicalName)) {
                    featureMap.set(canonicalName, []);
                }
                featureMap.get(canonicalName)!.push(data);
            }
        }

        return productMap;
    }

    /**
     * Validates data against the compatibility table.
     *
     * @param data Data to validate (Node or string).
     * @param ctx Validation context to collect issues into.
     * @param args Additional arguments specific to the implementation.
     */
    public abstract validate(
        data: Node | string,
        ctx: ValidationContext,
        ...args: unknown[]
    ): void;
}
