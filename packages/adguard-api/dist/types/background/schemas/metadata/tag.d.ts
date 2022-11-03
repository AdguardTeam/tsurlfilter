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
import zod from "zod";
/**
 * Filter tag metadata item runtime validator
 *
 * @see https://filters.adtidy.org/extension/chromium/filters.json
 */
export declare const tagMetadataValidator: zod.ZodObject<{
    tagId: zod.ZodNumber;
    keyword: zod.ZodString;
    description: zod.ZodOptional<zod.ZodString>;
    name: zod.ZodOptional<zod.ZodString>;
}, "strip", zod.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    tagId: number;
    keyword: string;
}, {
    name?: string | undefined;
    description?: string | undefined;
    tagId: number;
    keyword: string;
}>;
export declare type TagMetadata = zod.infer<typeof tagMetadataValidator>;
