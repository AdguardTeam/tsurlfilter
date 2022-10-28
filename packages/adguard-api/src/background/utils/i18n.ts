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

/**
 * Helper class for working with i18n locales
 */
export class I18n {
    /**
     * Gets matched locale from locales list
     *
     * @param locales - list of i18n locales
     * @param locale - target locale
     * @returns matched locale or null, if locale is not found
     */
    public static find(locales: string[], locale: string): string | null {
        const lang = locale.replace("-", "_");

        if (locales.includes(lang)) {
            return lang;
        }

        const langParts = lang.split("_");

        if (locales.includes(langParts[0])) {
            return langParts[0];
        }

        return null;
    }
}
