/* eslint-disable no-bitwise */
/**
 * @file Backwards-compatible platform enums.
 *
 * AGTree v4 exposed `SpecificPlatform` / `GenericPlatform` bitmask enums that
 * external consumers (notably `@adguard/scriptlets` v2.x) still import. AGTree
 * v5 replaced them with the `Platform` class and `ProductCode` / `PlatformType`
 * enums, so these constants exist purely for API compatibility. Values mirror
 * the v4 layout.
 */

/**
 * List of specific platforms (v4-compatible bitmask values).
 *
 * @deprecated Legacy bitmask enum kept for API compatibility with
 *   `@adguard/scriptlets` v2.x. Use the {@link Platform} class /
 *   `ProductCode` + `PlatformType` instead.
 */
export const SpecificPlatform = {
    AdgOsWindows: 1,
    AdgOsMac: 1 << 1,
    AdgOsAndroid: 1 << 2,

    AdgExtChrome: 1 << 3,
    AdgExtOpera: 1 << 4,
    AdgExtEdge: 1 << 5,
    AdgExtFirefox: 1 << 6,

    AdgCbAndroid: 1 << 7,
    AdgCbIos: 1 << 8,
    AdgCbSafari: 1 << 9,

    UboExtChrome: 1 << 10,
    UboExtOpera: 1 << 11,
    UboExtEdge: 1 << 12,
    UboExtFirefox: 1 << 13,

    AbpExtChrome: 1 << 14,
    AbpExtOpera: 1 << 15,
    AbpExtEdge: 1 << 16,
    AbpExtFirefox: 1 << 17,
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SpecificPlatform = typeof SpecificPlatform[keyof typeof SpecificPlatform];

const AdgOsAny = SpecificPlatform.AdgOsWindows
    | SpecificPlatform.AdgOsMac
    | SpecificPlatform.AdgOsAndroid;

const AdgSafariAny = SpecificPlatform.AdgCbSafari | SpecificPlatform.AdgCbIos;

const AdgExtChromium = SpecificPlatform.AdgExtChrome
    | SpecificPlatform.AdgExtOpera
    | SpecificPlatform.AdgExtEdge;

const AdgExtAny = AdgExtChromium | SpecificPlatform.AdgExtFirefox;

const AdgAny = AdgExtAny | AdgOsAny | AdgSafariAny | SpecificPlatform.AdgCbAndroid;

const UboExtChromium = SpecificPlatform.UboExtChrome
    | SpecificPlatform.UboExtOpera
    | SpecificPlatform.UboExtEdge;

const UboExtAny = UboExtChromium | SpecificPlatform.UboExtFirefox;

const UboAny = UboExtAny;

const AbpExtChromium = SpecificPlatform.AbpExtChrome
    | SpecificPlatform.AbpExtOpera
    | SpecificPlatform.AbpExtEdge;

const AbpExtAny = AbpExtChromium | SpecificPlatform.AbpExtFirefox;

const AbpAny = AbpExtAny;

const Any = AdgAny | UboAny | AbpAny;

/**
 * List of generic platforms (combinations of specific platforms), v4-compatible
 * bitmask values.
 *
 * @deprecated Legacy bitmask enum kept for API compatibility with
 *   `@adguard/scriptlets` v2.x. Use the {@link Platform} class /
 *   `ProductCode` + `PlatformType` instead.
 */
export const GenericPlatform = {
    AdgOsAny,
    AdgSafariAny,
    AdgExtChromium,
    AdgExtAny,
    AdgAny,
    UboExtChromium,
    UboExtAny,
    UboAny,
    AbpExtChromium,
    AbpExtAny,
    AbpAny,
    Any,
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type GenericPlatform = typeof GenericPlatform[keyof typeof GenericPlatform];
