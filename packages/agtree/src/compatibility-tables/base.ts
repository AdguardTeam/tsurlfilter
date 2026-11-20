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
     *   platform, i.e. it is empty or has a bit that is not a known platform.
     *   Unmapped masks are rejected instead of being approximated by name
     *   existence, so callers get an explicit signal during migration.
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
     * queries. Combined masks without an exact v5 wildcard, such as
     * `AdgOsWindows | AdgOsMac`, are expanded into their concrete members, so
     * the platform restriction is preserved rather than approximated by name
     * existence. A feature exists for a combined mask when it exists for any
     * of its members, as in 4.x.
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
                return CompatibilityTableBase.expandLegacyBitmask(bitmask);
        }
    }

    /**
     * Expands a combination of legacy specific platform bits, e.g.
     * `SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgOsMac`, into the
     * concrete platforms of the set bits. A bit that is not a known specific
     * platform makes the whole mask unmappable.
     *
     * @param bitmask Legacy bitmask.
     *
     * @returns Concrete platforms of the set bits, or an empty array when the
     *   mask is empty or has an unknown bit.
     */
    private static expandLegacyBitmask(bitmask: number): Platform[] {
        // eslint-disable-next-line no-bitwise
        if (!Number.isInteger(bitmask) || bitmask <= 0 || (bitmask & ~GenericPlatform.Any) !== 0) {
            return [];
        }

        return Object.values(SpecificPlatform)
            // eslint-disable-next-line no-bitwise
            .filter((bit) => (bitmask & bit) !== 0)
            .flatMap((bit) => CompatibilityTableBase.mapLegacyPlatform(bit));
    }

    /**
     * Checks whether the compatibility data declares the given name, i.e. the
     * name is either its canonical name or one of its aliases.
     *
     * A row is shared by every name and alias of the feature across all
     * products, so a name declared only for one product resolves to the whole
     * row. This check pins the name to the entry of the platform being asked.
     *
     * @param data Compatibility data of a single platform entry.
     * @param name Normalized feature name.
     *
     * @returns True if the entry declares the name.
     */
    private static declaresName(data: BaseCompatibilityDataSchema, name: string): boolean {
        return data.name === name || (data.aliases?.includes(name) ?? false);
    }

    /**
     * Collects the unique compatibility data of a row that match the platform
     * query. Does not look at names.
     *
     * Handles specific platforms (flat map), the global wildcard
     * {@link Platform.Any} (there is no `any` key in the data, so every
     * product path is queried) and the other wildcards (trie).
     *
     * @param row Compatibility row.
     * @param platform Platform query (can be wildcard).
     *
     * @returns Unique matching data in the order they are found.
     */
    private static collect<D>(row: HybridCompatibilityTableRow<D>, platform: Platform): D[] {
        if (!platform.isWildcard) {
            const data = row.flatMap.get(platform.toString());
            return data ? [data] : [];
        }

        const matches: D[] = [];

        if (platform.toString() === WILDCARD_ANY) {
            for (const code of getValidProductCodes()) {
                matches.push(...row.trie.query([code]));
            }
        } else {
            matches.push(...row.trie.query(platform.toPath()));
        }

        // Deduplicate by object identity: one entry is stored once per
        // concrete platform it expands to.
        return Array.from(new Set(matches));
    }

    /**
     * Collects the unique compatibility data of a row that match the platform
     * query and declare the given name in their own entry.
     *
     * @param row Compatibility row.
     * @param name Normalized feature name.
     * @param platform Platform query (can be wildcard).
     *
     * @returns Unique matching data whose entry declares the name.
     */
    private static collectDeclared<D extends BaseCompatibilityDataSchema>(
        row: HybridCompatibilityTableRow<D>,
        name: string,
        platform: Platform,
    ): D[] {
        return CompatibilityTableBase.collect(row, platform)
            .filter((data) => CompatibilityTableBase.declaresName(data, name));
    }

    /**
     * Checks if a feature is supported on the specified platform.
     *
     * The name must be declared (as a name or an alias) by the entry of the
     * platform itself: a name that exists only for another product is not
     * supported here. Use {@link translate} to resolve a name of another
     * product.
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

        return CompatibilityTableBase.collectDeclared(row, this.normalizeName(name), platform).length > 0;
    }

    /**
     * Gets compatibility data for a specific platform.
     *
     * The name must be declared by the entry of the platform itself, see
     * {@link supports}.
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

        return CompatibilityTableBase.collectDeclared(row, this.normalizeName(name), platform)[0] ?? null;
    }

    /**
     * Queries all compatibility data matching the platform query.
     * Supports wildcard platforms.
     *
     * The name must be declared by the entry of each returned platform, see
     * {@link supports}.
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

        return CompatibilityTableBase.collectDeclared(row, this.normalizeName(name), platform);
    }

    /**
     * Gets all features supported by the platform.
     *
     * A feature is listed under every name and alias that the entry of the
     * platform declares.
     *
     * @param platform Platform query.
     *
     * @returns Map of feature names to their compatibility data.
     */
    public getAll(platform: Platform): Map<string, T[]> {
        const results = new Map<string, T[]>();

        for (const [name, row] of this.data.rows.entries()) {
            const matches = CompatibilityTableBase.collectDeclared(row, name, platform);

            if (matches.length > 0) {
                results.set(name, matches);
            }
        }

        return results;
    }

    /**
     * Translates a feature name that may belong to any product into the entry
     * of the given platform.
     *
     * Unlike {@link query}, the name is not required to be declared by the
     * platform's own entry: the row of the feature is found by any of its
     * names or aliases (for example, an AdGuard scriptlet name or a uBO alias)
     * and the data of the requested platform is returned. This is what
     * converters need to map a name of one product onto another.
     *
     * @param name Feature name of any product.
     * @param platform Platform whose entry is wanted (can be wildcard).
     *
     * @returns First matching data of the platform or null.
     */
    public translate(name: string, platform: Platform): T | null {
        const row = this.getRow(name);
        if (!row) {
            return null;
        }

        return CompatibilityTableBase.collect(row, platform)[0] ?? null;
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

                // An entry is stored once per concrete platform it expands to,
                // so the same object shows up for each of them. List it once.
                const variants = featureMap.get(canonicalName)!;
                if (!variants.includes(data)) {
                    variants.push(data);
                }
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
