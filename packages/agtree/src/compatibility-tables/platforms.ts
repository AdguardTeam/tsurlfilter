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
    AdgOsCli: 1 << 2,
    AdgOsAndroid: 1 << 3,

    AdgExtChrome: 1 << 4,
    AdgExtOpera: 1 << 5,
    AdgExtEdge: 1 << 6,
    AdgExtFirefox: 1 << 7,

    AdgCbAndroid: 1 << 8,
    AdgCbIos: 1 << 9,
    AdgCbSafari: 1 << 10,

    UboExtChrome: 1 << 11,
    UboExtOpera: 1 << 12,
    UboExtEdge: 1 << 13,
    UboExtFirefox: 1 << 14,

    AbpExtChrome: 1 << 15,
    AbpExtOpera: 1 << 16,
    AbpExtEdge: 1 << 17,
    AbpExtFirefox: 1 << 18,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SpecificPlatform = typeof SpecificPlatform[keyof typeof SpecificPlatform];

const AdgOsAny = SpecificPlatform.AdgOsWindows
    | SpecificPlatform.AdgOsMac
    | SpecificPlatform.AdgOsCli
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
