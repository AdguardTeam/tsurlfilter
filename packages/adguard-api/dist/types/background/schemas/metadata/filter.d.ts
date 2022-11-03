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
import zod, { z } from "zod";
/**
 * Filter metadata item runtime validator
 *
 * @see https://filters.adtidy.org/extension/chromium/filters.json
 */
export declare const filterMetadataValidator: zod.ZodObject<{
    description: zod.ZodString;
    displayNumber: zod.ZodNumber;
    expires: zod.ZodNumber;
    filterId: zod.ZodNumber;
    groupId: zod.ZodNumber;
    homepage: zod.ZodString;
    languages: zod.ZodArray<zod.ZodString, "many">;
    name: zod.ZodString;
    subscriptionUrl: zod.ZodString;
    tags: zod.ZodArray<zod.ZodNumber, "many">;
    timeAdded: zod.ZodString;
    timeUpdated: zod.ZodString;
    trustLevel: zod.ZodString;
    version: zod.ZodString;
}, "strip", zod.ZodTypeAny, {
    name: string;
    description: string;
    displayNumber: number;
    expires: number;
    filterId: number;
    groupId: number;
    homepage: string;
    languages: string[];
    subscriptionUrl: string;
    tags: number[];
    timeAdded: string;
    timeUpdated: string;
    trustLevel: string;
    version: string;
}, {
    name: string;
    description: string;
    displayNumber: number;
    expires: number;
    filterId: number;
    groupId: number;
    homepage: string;
    languages: string[];
    subscriptionUrl: string;
    tags: number[];
    timeAdded: string;
    timeUpdated: string;
    trustLevel: string;
    version: string;
}>;
export declare type FilterMetadata = z.infer<typeof filterMetadataValidator>;
