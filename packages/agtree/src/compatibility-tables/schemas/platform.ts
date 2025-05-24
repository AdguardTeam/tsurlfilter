/* eslint-disable no-bitwise */
/**
 * @file Platform schema.
 */

import zod from 'zod';

import { GENERIC_PLATFORM_MAP, SPECIFIC_PLATFORM_MAP } from '../utils/platform-helpers.js';
import { isUndefined } from '../../utils/type-guards.js';

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
 * Platform schema.
 */
export const platformSchema = zod
    .string()
    .min(1)
    .transform((value) => parseRawPlatforms(value));
