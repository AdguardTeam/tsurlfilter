/**
 * @file Possible adblock syntaxes are listed here.
 */

/**
 * Adblock products (specific adblockers, excludes 'Common').
 */
export const AdblockProduct = {
    /**
     * Adblock Plus.
     *
     * @see {@link https://adblockplus.org/}
     */
    Abp: 'AdblockPlus',

    /**
     * uBlock Origin.
     *
     * @see {@link https://github.com/gorhill/uBlock}
     */
    Ubo: 'UblockOrigin',

    /**
     * AdGuard.
     *
     * @see {@link https://adguard.com/}
     */
    Adg: 'AdGuard',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type AdblockProduct = typeof AdblockProduct[keyof typeof AdblockProduct];

/**
 * Possible adblock syntaxes (supported by this library)
 */
export const AdblockSyntax = {
    /**
     * Common syntax, which is supported by more than one adblocker (or by all adblockers).
     *
     * We typically use this syntax when we cannot determine the concrete syntax of the rule,
     * because the syntax is used by more than one adblocker natively.
     *
     * @example
     * - `||example.org^$important` is a common syntax, since it is used by all adblockers natively, and
     * we cannot determine at parsing level whether `important` is a valid option or not, and if it is valid,
     * then which adblocker supports it.
     */
    Common: 'Common',

    /**
     * Adblock Plus syntax.
     *
     * @example
     * - `example.org#$#abort-on-property-read alert` is an Adblock Plus syntax, since it is not used by any other
     * adblockers directly (probably supported by some on-the-fly conversion, but this is not the native syntax).
     * @see {@link https://adblockplus.org/}
     */
    Abp: AdblockProduct.Abp,

    /**
     * uBlock Origin syntax.
     *
     * @example
     * - `example.com##+js(set, atob, noopFunc)` is an uBlock Origin syntax, since it is not used by any other
     * adblockers directly (probably supported by some on-the-fly conversion, but this is not the native syntax).
     * @see {@link https://github.com/gorhill/uBlock}
     */
    Ubo: AdblockProduct.Ubo,

    /**
     * AdGuard syntax.
     *
     * @example
     * - `example.org#%#//scriptlet("abort-on-property-read", "alert")` is an AdGuard syntax, since it is not used
     * by any other adblockers directly (probably supported by some on-the-fly conversion, but this is not the native
     * syntax).
     * @see {@link https://adguard.com/}
     */
    Adg: AdblockProduct.Adg,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type AdblockSyntax = typeof AdblockSyntax[keyof typeof AdblockSyntax];

/**
 * @deprecated Use AdblockProduct instead.
 */
export type StrictAdblockSyntax = AdblockProduct;

/**
 * Map of adblock products to their human-readable names.
 */
const PRODUCT_HUMAN_READABLE_NAME_MAP: ReadonlyMap<AdblockProduct, string> = new Map([
    [AdblockProduct.Abp, 'AdBlock / Adblock Plus'],
    [AdblockProduct.Ubo, 'uBlock Origin'],
    [AdblockProduct.Adg, 'AdGuard'],
]);

/**
 * Returns the human-readable name for the given adblock product.
 *
 * @param product Adblock product.
 *
 * @returns Human-readable product name, e.g., 'Adblock Plus', 'uBlock Origin', 'AdGuard'.
 *
 * @throws Error if the product is unknown.
 *
 * @example
 * ```typescript
 * getHumanReadableProductName(AdblockProduct.Abp); // 'Adblock Plus'
 * getHumanReadableProductName(AdblockProduct.Ubo); // 'uBlock Origin'
 * getHumanReadableProductName(AdblockProduct.Adg); // 'AdGuard'
 * ```
 */
export const getHumanReadableProductName = (product: AdblockProduct): string => {
    const name = PRODUCT_HUMAN_READABLE_NAME_MAP.get(product);

    if (!name) {
        throw new Error(`Unknown product: ${product}`);
    }

    return name;
};
