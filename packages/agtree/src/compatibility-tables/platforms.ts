/* eslint-disable no-bitwise */
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

export enum GenericPlatform {
    AdgOsAny = SpecificPlatform.AdgOsWindows | SpecificPlatform.AdgOsMac | SpecificPlatform.AdgOsAndroid,
    AdgCbAny = SpecificPlatform.AdgCbAndroid | SpecificPlatform.AdgCbSafari | SpecificPlatform.AdgCbIos,
    AdgExtChromium = SpecificPlatform.AdgExtChrome | SpecificPlatform.AdgExtOpera | SpecificPlatform.AdgExtEdge,
    AdgExtAny = AdgExtChromium | SpecificPlatform.AdgExtFirefox,
    AdgAny = AdgExtAny | AdgOsAny | AdgCbAny,

    UboExtChromium = SpecificPlatform.UboExtChrome | SpecificPlatform.UboExtOpera | SpecificPlatform.UboExtEdge,
    UboExtAny = UboExtChromium | SpecificPlatform.UboExtFirefox,
    UboAny = UboExtAny,

    AbpExtChromium = SpecificPlatform.AbpExtChrome | SpecificPlatform.AbpExtOpera | SpecificPlatform.AbpExtEdge,
    AbpExtAny = AbpExtChromium | SpecificPlatform.AbpExtFirefox,
    AbpAny = AbpExtAny,

    Any = AdgAny | UboAny | AbpAny,
}
