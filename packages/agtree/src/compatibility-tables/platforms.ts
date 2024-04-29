/* eslint-disable no-bitwise */
import zod from 'zod';

import { isUndefined } from '../utils/common';
import { getErrorMessage } from '../utils/error';

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
    AdgCbAny = SpecificPlatform.AdgCbAndroid | SpecificPlatform.AdgCbSafari,
    AdgExtChromium = SpecificPlatform.AdgExtChrome | SpecificPlatform.AdgExtOpera | SpecificPlatform.AdgExtEdge,
    AdgExtAny = AdgExtChromium | SpecificPlatform.AdgExtFirefox,
    AdgAnyNotCb = AdgExtAny | AdgOsAny,
    AdgAny = AdgExtAny | AdgOsAny | AdgCbAny,

    UboExtChromium = SpecificPlatform.UboExtChrome | SpecificPlatform.UboExtOpera | SpecificPlatform.UboExtEdge,
    UboExtAny = UboExtChromium | SpecificPlatform.UboExtFirefox,
    UboAny = UboExtAny,

    AbpExtChromium = SpecificPlatform.AbpExtChrome | SpecificPlatform.AbpExtOpera | SpecificPlatform.AbpExtEdge,
    AbpExtAny = AbpExtChromium | SpecificPlatform.AbpExtFirefox,
    AbpAny = AbpExtAny,

    Any = AdgAny | UboAny | AbpAny,
}

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

export const GENERIC_PLATFORM_MAP: Map<string, GenericPlatform> = new Map([
    ['adg_os_any', GenericPlatform.AdgOsAny],
    ['adg_cb_any', GenericPlatform.AdgCbAny],
    ['adg_ext_chromium', GenericPlatform.AdgExtChromium],
    ['adg_ext_any', GenericPlatform.AdgExtAny],
    ['adg_any_not_cb', GenericPlatform.AdgAnyNotCb],
    ['adg_any', GenericPlatform.AdgAny],

    ['ubo_ext_chromium', GenericPlatform.UboExtChromium],
    ['ubo_ext_any', GenericPlatform.UboExtAny],
    ['ubo_any', GenericPlatform.UboAny],

    ['abp_ext_chromium', GenericPlatform.AbpExtChromium],
    ['abp_ext_any', GenericPlatform.AbpExtAny],
    ['abp_any', GenericPlatform.AbpAny],

    ['any', GenericPlatform.Any],
]);

export const parseRawPlatforms = (rawPlatforms: string): number => {
    // e.g. 'adg_cb_any|adg_os_any'
    const rawPlatformList = rawPlatforms
        .split('|')
        .map((rawPlatform) => rawPlatform.trim());

    let result = 0;

    // FIXME: add support for negation, like:
    // instead of 'adg_any_not_cb', use 'adg_any|~adg_cb_any'

    for (const rawPlatform of rawPlatformList) {
        const platform = SPECIFIC_PLATFORM_MAP.get(rawPlatform) ?? GENERIC_PLATFORM_MAP.get(rawPlatform);

        if (isUndefined(platform)) {
            throw new Error(`Unknown platform: ${rawPlatform}`);
        }

        result |= platform;
    }

    if (result === 0) {
        throw new Error('No platforms specified');
    }

    return result;
};

export const isGenericPlatform = (platform: number): boolean => {
    // if more than one bit is set, it's a generic platform
    return !!(platform & (platform - 1));
};

export const platformSchema = zod.string().min(1).superRefine((value, ctx) => {
    try {
        parseRawPlatforms(value);
    } catch (error) {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: getErrorMessage(error),
        });
    }
});
