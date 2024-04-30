/* eslint-disable no-bitwise */
import zod from 'zod';

import { GENERIC_PLATFORM_MAP, SPECIFIC_PLATFORM_MAP } from '../utils/platform-helpers';
import { isUndefined } from '../../utils/common';

export const parseRawPlatforms = (rawPlatforms: string): number => {
    // e.g. 'adg_cb_any|adg_os_any'
    const rawPlatformList = rawPlatforms
        .split('|')
        .map((rawPlatform) => rawPlatform.trim());

    let result = 0;

    for (let rawPlatform of rawPlatformList) {
        // negation, e.g. 'adg_any|~adg_cb_any' means any AdGuard platform except content blockers
        let negated = false;

        if (rawPlatform.startsWith('~')) {
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

export const platformSchema = zod
    .string()
    .min(1)
    .transform((value) => parseRawPlatforms(value));
