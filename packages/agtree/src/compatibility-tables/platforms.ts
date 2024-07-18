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
export enum SpecificPlatform {
    AdgOsWindows = 1,
    AdgOsMac = 1 << 1,
    AdgOsAndroid = 1 << 2,

    AdgExtChrome = 1 << 3,
    AdgExtOpera = 1 << 4,
    AdgExtEdge = 1 << 5,
    AdgExtFirefox = 1 << 6,

    AdgCbAndroid = 1 << 7,
    AdgCbIos = 1 << 8,
    AdgCbSafari = 1 << 9,

    UboExtChrome = 1 << 10,
    UboExtOpera = 1 << 11,
    UboExtEdge = 1 << 12,
    UboExtFirefox = 1 << 13,

    AbpExtChrome = 1 << 14,
    AbpExtOpera = 1 << 15,
    AbpExtEdge = 1 << 16,
    AbpExtFirefox = 1 << 17,
}

/**
 * List of generic platforms (combinations of specific platforms).
 */
export enum GenericPlatform {
    AdgOsAny = SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgOsMac | SpecificPlatform.AdgOsAndroid,
    AdgSafariAny = SpecificPlatform.AdgCbSafari | SpecificPlatform.AdgCbIos,
    AdgExtChromium = SpecificPlatform.AdgExtChrome | SpecificPlatform.AdgExtOpera | SpecificPlatform.AdgExtEdge,
    AdgExtAny = AdgExtChromium | SpecificPlatform.AdgExtFirefox,
    AdgAny = AdgExtAny | AdgOsAny | AdgSafariAny | SpecificPlatform.AdgCbAndroid,

    UboExtChromium = SpecificPlatform.UboExtChrome | SpecificPlatform.UboExtOpera | SpecificPlatform.UboExtEdge,
    UboExtAny = UboExtChromium | SpecificPlatform.UboExtFirefox,
    UboAny = UboExtAny,

    AbpExtChromium = SpecificPlatform.AbpExtChrome | SpecificPlatform.AbpExtOpera | SpecificPlatform.AbpExtEdge,
    AbpExtAny = AbpExtChromium | SpecificPlatform.AbpExtFirefox,
    AbpAny = AbpExtAny,

    Any = AdgAny | UboAny | AbpAny,
}
