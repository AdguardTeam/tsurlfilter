/* eslint-disable no-bitwise */
/**
 * @file Platform schema.
 */

import zod from 'zod';

import { GENERIC_PLATFORM_MAP, SPECIFIC_PLATFORM_MAP, SPECIFIC_PLATFORM_MAP_REVERSE } from '../utils/platform-helpers';
import { isUndefined } from '../../utils/type-guards';

/**
 * Platform separator, e.g. 'adg_os_any|adg_safari_any' means any AdGuard OS platform and
 * any AdGuard Safari content blocker platform.
 */
const PLATFORM_SEPARATOR = '|';

/**
 * Platform negation character, e.g. 'adg_any|~adg_safari_any' means any AdGuard product except
 * Safari content blockers.
 */
const PLATFORM_NEGATION = '~';

/**
 * Parses a raw platform string into a platform bitmask.
 *
 * @param rawPlatforms Raw platform string, e.g. 'adg_safari_any|adg_os_any'.
 *
 * @returns Platform bitmask.
 */
export const parseRawPlatforms = (rawPlatforms: string): number => {
    // e.g. 'adg_safari_any|adg_os_any'
    const rawPlatformList = rawPlatforms
        .split(PLATFORM_SEPARATOR)
        .map((rawPlatform) => rawPlatform.trim());

    let result = 0;

    for (let rawPlatform of rawPlatformList) {
        // negation, e.g. 'adg_any|~adg_safari_any' means any AdGuard product except Safari content blockers
        let negated = false;

        if (rawPlatform.startsWith(PLATFORM_NEGATION)) {
            negated = true;
            rawPlatform = rawPlatform.slice(1).trim();
        }

        const platform = SPECIFIC_PLATFORM_MAP.get(rawPlatform) ?? GENERIC_PLATFORM_MAP.get(rawPlatform);

        if (isUndefined(platform)) {
            throw new Error(`Unknown platform: ${rawPlatform}`);
        }

        if (negated) {
            result &= ~platform;
        } else {
            result |= platform;
        }
    }

    if (result === 0) {
        throw new Error('No platforms specified');
    }

    return result;
};

/**
 * Converts a platform bitmask back to a string representation.
 * Prefers generic platforms over specific platforms where possible.
 *
 * @param bitmask Platform bitmask.
 *
 * @returns Platform string, e.g. 'adg_safari_any|adg_os_any' or 'adg_os_windows|adg_ext_chrome'.
 * @throws Error if the bitmask is 0 or contains unknown platforms.
 */
export const stringifyPlatforms = (bitmask: number): string => {
    if (bitmask === 0) {
        throw new Error('Invalid bitmask: 0');
    }

    // First, try to find an exact match in generic platforms
    for (const [name, value] of GENERIC_PLATFORM_MAP.entries()) {
        if (value === bitmask) {
            return name;
        }
    }

    // Check if the bitmask can be represented as a combination of generic platforms
    // Try to find the largest generic platforms that fit
    const platforms: string[] = [];
    let remaining = bitmask;

    // Sort generic platforms by value (descending) to prefer larger combinations
    const sortedGenericPlatforms = [...GENERIC_PLATFORM_MAP.entries()].sort((a, b) => b[1] - a[1]);

    for (const [name, value] of sortedGenericPlatforms) {
        // Check if this generic platform is fully contained in the remaining bitmask
        if ((remaining & value) === value) {
            platforms.push(name);
            remaining &= ~value;

            if (remaining === 0) {
                break;
            }
        }
    }

    // If we still have remaining bits, add specific platforms
    if (remaining !== 0) {
        for (const [value, name] of SPECIFIC_PLATFORM_MAP_REVERSE.entries()) {
            if (remaining & value) {
                platforms.push(name);
                remaining &= ~value;

                if (remaining === 0) {
                    break;
                }
            }
        }
    }

    // If there are still remaining bits, the bitmask contains unknown platforms
    if (remaining !== 0) {
        throw new Error(`Unknown platform bits in bitmask: ${remaining}`);
    }

    return platforms.join(PLATFORM_SEPARATOR);
};

/**
 * Platform schema.
 */
export const platformSchema = zod
    .string()
    .min(1)
    .transform((value) => parseRawPlatforms(value));
