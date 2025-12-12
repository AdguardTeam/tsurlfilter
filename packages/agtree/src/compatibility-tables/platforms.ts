/* eslint-disable no-bitwise */
/**
 * @file Provides platform enums.
 * The difference between specific and generic platforms is that specific platforms are individual platforms
 * (e.g. AdGuard for Windows, AdGuard for Android, etc.),
 * while generic platforms are groups of specific platforms
 * (e.g. AdGuard for any OS, AdGuard for any Chromium-based extension, etc.).
 */

/**
 * Unique symbol to brand SpecificPlatform type.
 */
declare const SpecificPlatformBrand: unique symbol;

/**
 * Unique symbol to brand GenericPlatform type.
 */
declare const GenericPlatformBrand: unique symbol;

/**
 * Branded type for specific platform values.
 */
export type SpecificPlatform = number & {
    readonly [SpecificPlatformBrand]: true;
};

/**
 * List of specific platforms.
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const SpecificPlatform = {
    AdgOsWindows: 1 as SpecificPlatform,
    AdgOsMac: (1 << 1) as SpecificPlatform,
    AdgOsAndroid: (1 << 2) as SpecificPlatform,

    AdgExtChrome: (1 << 3) as SpecificPlatform,
    AdgExtOpera: (1 << 4) as SpecificPlatform,
    AdgExtEdge: (1 << 5) as SpecificPlatform,
    AdgExtFirefox: (1 << 6) as SpecificPlatform,

    AdgCbAndroid: (1 << 7) as SpecificPlatform,
    AdgCbIos: (1 << 8) as SpecificPlatform,
    AdgCbSafari: (1 << 9) as SpecificPlatform,

    UboExtChrome: (1 << 10) as SpecificPlatform,
    UboExtOpera: (1 << 11) as SpecificPlatform,
    UboExtEdge: (1 << 12) as SpecificPlatform,
    UboExtFirefox: (1 << 13) as SpecificPlatform,

    AbpExtChrome: (1 << 14) as SpecificPlatform,
    AbpExtOpera: (1 << 15) as SpecificPlatform,
    AbpExtEdge: (1 << 16) as SpecificPlatform,
    AbpExtFirefox: (1 << 17) as SpecificPlatform,
};

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
 * Branded type for generic platform values.
 */
export type GenericPlatform = number & {
    readonly [GenericPlatformBrand]: true;
};

/**
 * List of generic platforms (combinations of specific platforms).
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const GenericPlatform = {
    AdgOsAny: AdgOsAny as GenericPlatform,
    AdgSafariAny: AdgSafariAny as GenericPlatform,
    AdgExtChromium: AdgExtChromium as GenericPlatform,
    AdgExtAny: AdgExtAny as GenericPlatform,
    AdgAny: AdgAny as GenericPlatform,
    UboExtChromium: UboExtChromium as GenericPlatform,
    UboExtAny: UboExtAny as GenericPlatform,
    UboAny: UboAny as GenericPlatform,
    AbpExtChromium: AbpExtChromium as GenericPlatform,
    AbpExtAny: AbpExtAny as GenericPlatform,
    AbpAny: AbpAny as GenericPlatform,
    Any: Any as GenericPlatform,
};

/**
 * Represents any platform: specific, generic, or a combination of platforms.
 *
 * The `number` type is included to support combined platforms created via bitwise OR operations.
 * For example: `GenericPlatform.AdgAny | GenericPlatform.UboAny` results in a `number` at the type level.
 *
 * @example
 * ```typescript
 * // Single platform
 * const singlePlatform: AnyPlatform = SpecificPlatform.AdgOsWindows;
 *
 * // Combined platforms (result is number)
 * const combinedPlatforms: AnyPlatform = GenericPlatform.AdgAny | GenericPlatform.UboAny;
 * ```
 */
export type AnyPlatform = SpecificPlatform | GenericPlatform | number;
