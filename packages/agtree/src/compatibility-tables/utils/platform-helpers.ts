/* eslint-disable no-bitwise */
/**
 * @file Provides platform mapping and helper functions.
 */

import { type AnyPlatform, GenericPlatform, SpecificPlatform } from '../platforms';
import { AdblockProduct } from '../../utils/adblockers';
import { getBitCount } from '../../utils/bit-count';
import { type ReadonlyRecord } from '../../utils/types';

/**
 * Map of specific platforms string names to their corresponding enum values.
 */
export const SPECIFIC_PLATFORM_MAP: Map<string, SpecificPlatform> = new Map([
    ['adg_os_windows', SpecificPlatform.AdgOsWindows],
    ['adg_os_mac', SpecificPlatform.AdgOsMac],
    ['adg_os_android', SpecificPlatform.AdgOsAndroid],

    ['adg_ext_chrome', SpecificPlatform.AdgExtChrome],
    ['adg_ext_opera', SpecificPlatform.AdgExtOpera],
    ['adg_ext_edge', SpecificPlatform.AdgExtEdge],
    ['adg_ext_firefox', SpecificPlatform.AdgExtFirefox],

    ['adg_cb_android', SpecificPlatform.AdgCbAndroid],
    ['adg_cb_ios', SpecificPlatform.AdgCbIos],
    ['adg_cb_safari', SpecificPlatform.AdgCbSafari],

    ['ubo_ext_chrome', SpecificPlatform.UboExtChrome],
    ['ubo_ext_opera', SpecificPlatform.UboExtOpera],
    ['ubo_ext_edge', SpecificPlatform.UboExtEdge],
    ['ubo_ext_firefox', SpecificPlatform.UboExtFirefox],

    ['abp_ext_chrome', SpecificPlatform.AbpExtChrome],
    ['abp_ext_opera', SpecificPlatform.AbpExtOpera],
    ['abp_ext_edge', SpecificPlatform.AbpExtEdge],
    ['abp_ext_firefox', SpecificPlatform.AbpExtFirefox],
]);

/**
 * Map of specific platforms enum values to their corresponding string names.
 *
 * @note Reverse of {@link SPECIFIC_PLATFORM_MAP}.
 */
export const SPECIFIC_PLATFORM_MAP_REVERSE: Map<SpecificPlatform, string> = new Map(
    [...SPECIFIC_PLATFORM_MAP].map(([key, value]) => [value, key]),
);

/**
 * Map of generic platforms string names to their corresponding enum values.
 */
export const GENERIC_PLATFORM_MAP: Map<string, GenericPlatform> = new Map([
    ['adg_os_any', GenericPlatform.AdgOsAny],
    ['adg_safari_any', GenericPlatform.AdgSafariAny],
    ['adg_ext_chromium', GenericPlatform.AdgExtChromium],
    ['adg_ext_any', GenericPlatform.AdgExtAny],
    ['adg_any', GenericPlatform.AdgAny],

    ['ubo_ext_chromium', GenericPlatform.UboExtChromium],
    ['ubo_ext_any', GenericPlatform.UboExtAny],
    ['ubo_any', GenericPlatform.UboAny],

    ['abp_ext_chromium', GenericPlatform.AbpExtChromium],
    ['abp_ext_any', GenericPlatform.AbpExtAny],
    ['abp_any', GenericPlatform.AbpAny],

    ['any', GenericPlatform.Any],
]);

/**
 * Map of products to their platform name prefixes.
 * Used for filtering generic platforms by product.
 */
const PRODUCT_PREFIX_MAP: Record<AdblockProduct, string> = {
    [AdblockProduct.Adg]: 'Adg',
    [AdblockProduct.Ubo]: 'Ubo',
    [AdblockProduct.Abp]: 'Abp',
};

const SPECIFIC_PLATFORM_HUMAN_READABLE_NAME_MAP: Map<SpecificPlatform, string> = new Map([
    [SpecificPlatform.AdgOsWindows, 'AdGuard App for Windows'],
    [SpecificPlatform.AdgOsMac, 'AdGuard App for Mac'],
    [SpecificPlatform.AdgOsAndroid, 'AdGuard App for Android'],

    [SpecificPlatform.AdgExtChrome, 'AdGuard Browser Extension for Chrome'],
    [SpecificPlatform.AdgExtOpera, 'AdGuard Browser Extension for Opera'],
    [SpecificPlatform.AdgExtEdge, 'AdGuard Browser Extension for Edge'],
    [SpecificPlatform.AdgExtFirefox, 'AdGuard Browser Extension for Firefox'],

    [SpecificPlatform.AdgCbAndroid, 'AdGuard Content Blocker for Android'],
    [SpecificPlatform.AdgCbIos, 'AdGuard Content Blocker for iOS'],
    [SpecificPlatform.AdgCbSafari, 'AdGuard Content Blocker for Safari'],

    [SpecificPlatform.UboExtChrome, 'uBlock Origin Browser Extension for Chrome'],
    [SpecificPlatform.UboExtOpera, 'uBlock Origin Browser Extension for Opera'],
    [SpecificPlatform.UboExtEdge, 'uBlock Origin Browser Extension for Edge'],
    [SpecificPlatform.UboExtFirefox, 'uBlock Origin Browser Extension for Firefox'],

    [SpecificPlatform.AbpExtChrome, 'AdBlock / Adblock Plus Browser Extension for Chrome'],
    [SpecificPlatform.AbpExtOpera, 'AdBlock / Adblock Plus Browser Extension for Opera'],
    [SpecificPlatform.AbpExtEdge, 'AdBlock / Adblock Plus Browser Extension for Edge'],
    [SpecificPlatform.AbpExtFirefox, 'AdBlock / Adblock Plus Browser Extension for Firefox'],
]);

const GENERIC_PLATFORM_HUMAN_READABLE_NAME_MAP: Map<GenericPlatform, string> = new Map([
    [GenericPlatform.AdgOsAny, 'Any System-level AdGuard App'],
    [GenericPlatform.AdgSafariAny, 'Any AdGuard Content Blocker for Safari'],
    [GenericPlatform.AdgExtChromium, 'Any AdGuard Browser Extension for Chromium'],
    [GenericPlatform.AdgExtAny, 'Any AdGuard Browser Extension'],
    [GenericPlatform.AdgAny, 'Any AdGuard product'],

    [GenericPlatform.UboExtChromium, 'Any uBlock Origin Browser Extension for Chromium'],
    [GenericPlatform.UboExtAny, 'Any uBlock Origin Browser Extension'],
    [GenericPlatform.UboAny, 'Any uBlock Origin product'],

    [GenericPlatform.AbpExtChromium, 'Any AdBlock / Adblock Plus Browser Extension for Chromium'],
    [GenericPlatform.AbpExtAny, 'Any AdBlock / Adblock Plus Browser Extension'],
    [GenericPlatform.AbpAny, 'Any AdBlock / Adblock Plus product'],

    [GenericPlatform.Any, 'Any product'],
]);

/**
 * Generic platforms for each product, ordered from most specific to least specific.
 * Computed lazily on first access.
 */
let PRODUCT_GENERIC_PLATFORMS: ReadonlyRecord<AdblockProduct, readonly GenericPlatform[]> | null = null;

/**
 * Map of products to their specific platforms.
 * Cached after first call to avoid recomputing.
 */
let PRODUCT_SPECIFIC_PLATFORMS: ReadonlyRecord<AdblockProduct, readonly SpecificPlatform[]> | null = null;

/**
 * Initializes and returns the product generic platforms map.
 * Filters all generic platforms by product prefix and sorts by specificity (fewer bits = more specific).
 *
 * @returns Map of products to their generic platforms, ordered from most to least specific.
 */
export const getProductGenericPlatforms = (): ReadonlyRecord<AdblockProduct, readonly GenericPlatform[]> => {
    if (PRODUCT_GENERIC_PLATFORMS !== null) {
        return PRODUCT_GENERIC_PLATFORMS;
    }

    const result: Record<AdblockProduct, GenericPlatform[]> = {
        [AdblockProduct.Adg]: [],
        [AdblockProduct.Ubo]: [],
        [AdblockProduct.Abp]: [],
    };

    // Iterate over all generic platforms and group by product prefix
    const genericPlatformEntries = Object.entries(GenericPlatform) as [string, GenericPlatform][];

    for (const [name, platform] of genericPlatformEntries) {
        // Check which product this platform belongs to
        for (const [product, prefix] of Object.entries(PRODUCT_PREFIX_MAP)) {
            if (name.startsWith(prefix)) {
                result[product as AdblockProduct].push(platform);
                break;
            }
        }
    }

    // Sort each product's platforms by specificity (fewer bits set = more specific)
    for (const product of Object.keys(result) as AdblockProduct[]) {
        result[product].sort((a, b) => {
            const bitsA = getBitCount(a as unknown as number);
            const bitsB = getBitCount(b as unknown as number);
            return bitsA - bitsB; // Ascending: fewer bits first (more specific)
        });
    }

    // Cache the result as readonly
    PRODUCT_GENERIC_PLATFORMS = result as ReadonlyRecord<AdblockProduct, readonly GenericPlatform[]>;
    return PRODUCT_GENERIC_PLATFORMS;
};

/**
 * Check if the platform is a generic platform (or a combination of platforms).
 *
 * @param platform Platform to check.
 *
 * @returns True if the platform is a generic platform or combined platforms, false if it's a specific platform.
 */
export const isGenericPlatform = (platform: AnyPlatform): platform is GenericPlatform | number => {
    // if more than one bit is set, it's a generic platform or combined platforms
    // Cast to number for bitwise operations
    const num = platform as unknown as number;
    return !!(num & (num - 1));
};

/**
 * Check if the platform has multiple products specified.
 * Multiple products means at least 2 of: AdgAny, AbpAny, UboAny.
 *
 * @param platform Platform to check.
 *
 * @returns True if at least 2 products are specified, false otherwise.
 */
export const hasPlatformMultipleProducts = (platform: AnyPlatform): boolean => {
    const hasAdg = !!(platform & GenericPlatform.AdgAny);
    const hasAbp = !!(platform & GenericPlatform.AbpAny);
    const hasUbo = !!(platform & GenericPlatform.UboAny);

    return (
        (hasAdg && hasAbp)
        || (hasAdg && hasUbo)
        || (hasAbp && hasUbo)
    );
};

/**
 * Converts a platform to its corresponding adblock products.
 *
 * Note: This conversion is less specific than the platform itself, as it only returns
 * which products (AdGuard/uBlock/Abp) are present, dropping specific platform information
 * (e.g., Windows vs Chrome extension).
 *
 * @param platform Platform to convert.
 *
 * @returns Array of AdblockProduct values:
 * - Empty array `[]` if platform is 0 or no products are found
 * - Array of specific products based on which products are present
 *   (e.g., `['AdGuard', 'UblockOrigin']` if both AdGuard and uBlock Origin are specified)
 * - `['AdGuard', 'UblockOrigin', 'AdblockPlus']` for GenericPlatform.Any
 */
export const platformToAdblockProduct = (platform: AnyPlatform): AdblockProduct[] => {
    const products: AdblockProduct[] = [];

    if (platform & GenericPlatform.AdgAny) {
        products.push(AdblockProduct.Adg);
    }

    if (platform & GenericPlatform.UboAny) {
        products.push(AdblockProduct.Ubo);
    }

    if (platform & GenericPlatform.AbpAny) {
        products.push(AdblockProduct.Abp);
    }

    return products;
};

/**
 * Platforms grouped by product.
 * Maps each product to an array of its platform values.
 */
export type PlatformsByProduct = Partial<Record<AdblockProduct, AnyPlatform[]>>;

/**
 * Optimizes platform representation by combining specific platforms into generic ones.
 * Returns the minimal set of platforms needed to represent the input.
 *
 * @param extractedPlatforms Platform bits for a single product.
 * @param productGenericPlatforms Array of generic platforms for this product, ordered by specificity.
 *
 * @returns Optimized array of platforms.
 */
const optimizePlatformRepresentation = (
    extractedPlatforms: number,
    productGenericPlatforms: readonly GenericPlatform[],
): AnyPlatform[] => {
    if (extractedPlatforms === 0) {
        return [];
    }

    // Check if the input exactly matches any single generic platform (already optimal)
    for (const genericPlatform of productGenericPlatforms) {
        if (extractedPlatforms === (genericPlatform as unknown as number)) {
            return [genericPlatform];
        }
    }

    const result: AnyPlatform[] = [];
    let remainingBits = extractedPlatforms;

    // Try to match generic platforms from most specific to least specific
    for (const genericPlatform of productGenericPlatforms) {
        const genericBits = genericPlatform as unknown as number;

        // Check if all bits of this generic platform are present in remaining bits
        if ((remainingBits & genericBits) === genericBits) {
            result.push(genericPlatform);
            // Remove the matched bits from remaining
            remainingBits &= ~genericBits;

            // If no bits remain, we're done
            if (remainingBits === 0) {
                break;
            }
        }
    }

    // If there are remaining bits, we need to add them as specific platforms
    // This shouldn't normally happen if our generic platforms cover all combinations,
    // but we handle it for safety
    if (remainingBits !== 0) {
        result.push(remainingBits as AnyPlatform);
    }

    return result;
};

/**
 * Splits a platform by products, returning a record mapping each product to its platforms.
 * This is useful for iterating over each product separately when validating or processing.
 *
 * The function optimizes the platform representation by combining specific platforms
 * into generic ones when possible, returning the minimal set needed.
 *
 * @param platform Platform to split (can be single or multi-product).
 *
 * @returns Record mapping products to optimized platform arrays:
 * - Empty object `{}` if platform is 0 or no products are found
 * - Object with single product key for single-product platforms
 * - Object with multiple product keys for multi-product platforms
 * - Each array contains the minimal representation using generic platforms where possible
 *
 * @example
 * ```typescript
 * // Multi-product platform
 * const platforms = getPlatformsByProduct(GenericPlatform.AdgAny | GenericPlatform.UboAny);
 * // Returns: {
 * //   'AdGuard': [GenericPlatform.AdgAny],
 * //   'UblockOrigin': [GenericPlatform.UboAny]
 * // }
 *
 * // Mixed specific and generic
 * const mixed = SpecificPlatform.AdgExtChrome | SpecificPlatform.AdgExtFirefox | SpecificPlatform.AdgOsWindows;
 * const result = getPlatformsByProduct(mixed);
 * // Might return: { 'AdGuard': [GenericPlatform.AdgExtChromium, SpecificPlatform.AdgOsWindows] }
 *
 * // Iterate and validate for each product
 * for (const [product, platformList] of Object.entries(platforms)) {
 *     for (const p of platformList) {
 *         const result = modifierValidator.validate(p, modifier);
 *         console.log(`${product}: ${result.valid}`);
 *     }
 * }
 * ```
 */
export const getPlatformsByProduct = (platform: AnyPlatform): PlatformsByProduct => {
    const result: PlatformsByProduct = {};
    const productPlatforms = getProductGenericPlatforms();

    if (platform & GenericPlatform.AdgAny) {
        const extracted = (platform & GenericPlatform.AdgAny) as unknown as number;
        result[AdblockProduct.Adg] = optimizePlatformRepresentation(
            extracted,
            productPlatforms[AdblockProduct.Adg],
        );
    }

    if (platform & GenericPlatform.UboAny) {
        const extracted = (platform & GenericPlatform.UboAny) as unknown as number;
        result[AdblockProduct.Ubo] = optimizePlatformRepresentation(
            extracted,
            productPlatforms[AdblockProduct.Ubo],
        );
    }

    if (platform & GenericPlatform.AbpAny) {
        const extracted = (platform & GenericPlatform.AbpAny) as unknown as number;
        result[AdblockProduct.Abp] = optimizePlatformRepresentation(
            extracted,
            productPlatforms[AdblockProduct.Abp],
        );
    }

    return result;
};

/**
 * Returns the platform enum value for the given platform string name.
 *
 * @param platform Platform string name, e.g., 'adg_os_windows'.
 *
 * @returns Specific or generic platform enum value.
 * @throws Error if the platform is unknown.
 */
export const getPlatformId = (platform: string): SpecificPlatform | GenericPlatform => {
    const specificPlatform = SPECIFIC_PLATFORM_MAP.get(platform);

    if (specificPlatform) {
        return specificPlatform;
    }

    const genericPlatform = GENERIC_PLATFORM_MAP.get(platform);

    if (genericPlatform) {
        return genericPlatform;
    }

    throw new Error(`Unknown platform: ${platform}`);
};

/**
 * Returns the specific platform string name for the given platform enum value.
 *
 * @param platform Specific platform enum value.
 *
 * @returns Specific platform string name, e.g., 'adg_os_windows'.
 * @throws Error if the platform is unknown.
 */
export const getSpecificPlatformName = (platform: SpecificPlatform): string => {
    const specificPlatform = SPECIFIC_PLATFORM_MAP_REVERSE.get(platform);

    if (!specificPlatform) {
        throw new Error(`Unknown platform: ${platform}`);
    }

    return specificPlatform;
};

/**
 * Returns the human-readable platform name for the given platform enum value.
 *
 * @param platform Platform enum value.
 *
 * @returns Human-readable platform name, e.g., 'AdGuard for Windows'.
 *
 * @throws Error if the platform is unknown.
 */
export const getHumanReadablePlatformName = (platform: AnyPlatform): string => {
    // Try specific platform first
    const specificPlatform = SPECIFIC_PLATFORM_HUMAN_READABLE_NAME_MAP.get(platform as SpecificPlatform);

    if (specificPlatform) {
        return specificPlatform;
    }

    // Then try generic platform
    const genericPlatform = GENERIC_PLATFORM_HUMAN_READABLE_NAME_MAP.get(platform as GenericPlatform);

    if (genericPlatform) {
        return genericPlatform;
    }

    throw new Error(`Unknown platform: ${platform}`);
};

/**
 * Gets all specific platforms for a given AdblockProduct.
 * Results are cached after the first call.
 *
 * @param product AdblockProduct to get specific platforms for.
 *
 * @returns Array of all specific platforms for the given product.
 *
 * @example
 * ```typescript
 * const adgPlatforms = getProductSpecificPlatforms(AdblockProduct.Adg);
 * // Returns: [AdgOsWindows, AdgOsMac, AdgOsAndroid, AdgExtChrome, ...]
 * ```
 */
export const getProductSpecificPlatforms = (product: AdblockProduct): readonly SpecificPlatform[] => {
    // Initialize cache if needed
    if (PRODUCT_SPECIFIC_PLATFORMS === null) {
        const result: Record<AdblockProduct, SpecificPlatform[]> = {
            [AdblockProduct.Adg]: [],
            [AdblockProduct.Ubo]: [],
            [AdblockProduct.Abp]: [],
        };

        // Iterate over all specific platforms and group by product prefix
        const specificPlatformEntries = Object.entries(SpecificPlatform) as [string, SpecificPlatform][];

        for (const [name, platform] of specificPlatformEntries) {
            // Check which product this platform belongs to
            for (const [prod, prefix] of Object.entries(PRODUCT_PREFIX_MAP)) {
                if (name.startsWith(prefix)) {
                    result[prod as AdblockProduct].push(platform);
                    break;
                }
            }
        }

        // Cache the result as readonly
        PRODUCT_SPECIFIC_PLATFORMS = result as ReadonlyRecord<AdblockProduct, readonly SpecificPlatform[]>;
    }

    return PRODUCT_SPECIFIC_PLATFORMS[product];
};

/**
 * Gets all available platform names from the platform maps.
 *
 * @returns Object containing arrays of all specific and generic platform names.
 *
 * @example
 * ```typescript
 * const { specificPlatformNames, genericPlatformNames } = getAllPlatformNames();
 * // specificPlatformNames: ['adg_os_windows', 'adg_os_mac', 'adg_os_android', ...]
 * // genericPlatformNames: ['adg_os_any', 'adg_safari_any', 'adg_ext_chromium', ...]
 * ```
 */
export const getAllPlatformNames = (): {
    specificPlatformNames: readonly string[];
    genericPlatformNames: readonly string[];
} => {
    return {
        specificPlatformNames: Array.from(SPECIFIC_PLATFORM_MAP.keys()),
        genericPlatformNames: Array.from(GENERIC_PLATFORM_MAP.keys()),
    };
};
