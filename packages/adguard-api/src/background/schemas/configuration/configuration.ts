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
 * {@link AdguardApi} configuration runtime validator
 */
export const configurationValidator = zod.object({
    /**
     * An array of filters identifiers.
     *
     * You can look for possible filters identifiers in the filters metadata file.
     *
     * @see https://filters.adtidy.org/extension/chromium/filters.json
     */
    filters: zod.number().array(),

    /**
     * Enables filtering if true.
     */
    filteringEnabled: zod.boolean(),

    /**
     * An array of domains, for which AdGuard won't work.
     */
    allowlist: zod.string().array().optional(),

    /**
     * This property completely changes AdGuard behavior.
     *
     * If it is defined, Adguard will work for domains from the {@link blocklist} only.
     *
     * All other domains will be ignored. If {@link blocklist} is defined, {@link allowlist} will be ignored.
     */
    blocklist: zod.string().array().optional(),

    /**
     * An array of custom filtering rules.
     *
     * These custom rules might be created by a user via AdGuard Assistant UI.
     *
     * @see https://adguard.com/en/filterrules.html
     */
    rules: zod.string().array().optional(),

    /**
     * An absolute path to a file, containing filters metadata.
     *
     * Once started, AdGuard will periodically check filters updates by downloading this file.
     *
     * Example: `https://filters.adtidy.org/extension/chromium/filters.json`.
     */
    filtersMetadataUrl: zod.string(),

    /**
     * URL mask used for fetching filters rules.
     * `{filter_id}` parameter will be replaced with an actual filter identifier.
     *
     * Example: `https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt`
     *
     * English filter (filter id = 2) will be loaded from: `https://filters.adtidy.org/extension/chromium/2.txt`.
     */
    filterRulesUrl: zod.string(),

    /**
     * Redirect url for $document rules. Optional.
     * If not specified, default browser page will be shown.
     */
    documentBlockingPageUrl: zod.string().optional(),
});

export type Configuration = zod.infer<typeof configurationValidator>;
