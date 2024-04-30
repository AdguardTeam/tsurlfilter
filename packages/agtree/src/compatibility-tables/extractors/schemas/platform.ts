/* eslint-disable no-bitwise */
import zod from 'zod';

import { GENERIC_PLATFORM_MAP, SPECIFIC_PLATFORM_MAP } from '../../platforms';
import { isUndefined } from '../../../utils/common';

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

export const platformSchema = zod
    .string()
    .min(1)
    .transform((value) => parseRawPlatforms(value));
