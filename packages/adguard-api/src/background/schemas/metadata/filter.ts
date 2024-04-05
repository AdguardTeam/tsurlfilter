/**
 * @file
 * This file is part of Adguard API library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api).
 *
 * Adguard API is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API. If not, see <http://www.gnu.org/licenses/>.
 */

import zod, { z } from 'zod';

/**
 * Filter metadata item runtime validator
 *
 * @see https://filters.adtidy.org/extension/chromium/filters.json
 */
export const filterMetadataValidator = zod.object({
    description: zod.string(),
    displayNumber: zod.number(),
    expires: zod.number(),
    filterId: zod.number(),
    groupId: zod.number(),
    homepage: zod.string(),
    languages: zod.string().array(),
    name: zod.string(),
    subscriptionUrl: zod.string(),
    tags: zod.number().array(),
    timeAdded: zod.string(),
    timeUpdated: zod.string(),
    trustLevel: zod.string(),
    version: zod.string(),
});

export type FilterMetadata = z.infer<typeof filterMetadataValidator>;
