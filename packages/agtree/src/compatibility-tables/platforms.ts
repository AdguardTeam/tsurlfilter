/* eslint-disable no-bitwise */
/**
 * @file Provides platform enums.
 * The difference between specific and generic platforms is that specific platforms are individual platforms
 * (e.g. AdGuard for Windows, AdGuard for Android, etc.),
 * while generic platforms are groups of specific platforms
 * (e.g. AdGuard for any OS, AdGuard for any Chromium-based extension, etc.).
 */

/**
 * List of specific platforms.
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

// intentionally naming the variable the same as the type
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
 * List of generic platforms (combinations of specific platforms).
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

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type GenericPlatform = typeof GenericPlatform[keyof typeof GenericPlatform];

export type AnyPlatform = SpecificPlatform | GenericPlatform;
