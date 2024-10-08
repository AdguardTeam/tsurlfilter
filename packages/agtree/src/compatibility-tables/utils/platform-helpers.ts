/* eslint-disable no-bitwise */
/**
 * @file Provides platform mapping and helper functions.
 */

import { GenericPlatform, SpecificPlatform } from '../platforms';

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
 * Check if the platform is a generic platform.
 *
 * @param platform Platform to check.
 *
 * @returns True if the platform is a generic platform, false otherwise.
 */
export const isGenericPlatform = (platform: number): boolean => {
    // if more than one bit is set, it's a generic platform
    return !!(platform & (platform - 1));
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
