/**
 * @file
 * This file is part of Adguard API MV3 library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api-mv3).
 *
 * Adguard API MV3 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API MV3 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API MV3. If not, see <http://www.gnu.org/licenses/>.
 */

import zod from 'zod';

/**
 * {@link AdguardApi} configuration runtime validator.
 */
export const configurationValidator = zod.object({
    /**
     * An array of filter identifiers.
     *
     * You can find possible filter identifiers in the @adguard/dnr-rulesets README file.
     *
     * @see https://www.npmjs.com/package/@adguard/dnr-rulesets#included-filter-lists
     */
    filters: zod.number().array(),

    /**
     * Indicates whether filtering is enabled.
     */
    filteringEnabled: zod.boolean(),

    /**
     * Path to the directory with filters.
     */
    assetsPath: zod.string(),

    /**
     * An array of domains for which AdGuard won't work.
     */
    allowlist: zod.string().array().optional(),

    /**
     * This property completely changes AdGuard's behavior.
     *
     * If defined, AdGuard will work only for domains in the {@link blocklist}.
     *
     * All other domains will be ignored. If {@link blocklist} is defined, {@link allowlist} will be ignored.
     */
    blocklist: zod.string().array().optional(),

    /**
     * An array of custom filtering rules.
     *
     * These custom rules might be created by a user via the AdGuard Assistant UI.
     *
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/
     */
    rules: zod.string().array().optional(),

    /**
     * Optional redirect url for blocking rules with `$document` modifier.
     * If not specified, default browser page will be shown.
     *
     * Page will receive following query parameters:
     * - url - blocked url;
     * - rule - blocking rule, that triggered on this url;
     * - filterId - id of the filter, that contains this rule (0 for user rules).
     *
     * @example
     * // Address format:
     * `chrome-extension://<extension_id>/blocking-page.html`
     *
     * @example
     * // Full URL example after redirect:
     * `chrome-extension://<extension_id>/blocking-page.html?url=https%3A%2F%2Fexample.net%2F&rule=example.net%24document&filterId=0`
     */
    documentBlockingPageUrl: zod.string().optional(),
});

export type Configuration = zod.infer<typeof configurationValidator>;
