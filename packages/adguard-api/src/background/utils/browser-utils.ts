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

import { Version } from "./version";

/**
 * Helper class for working with browser extension context
 */
export class BrowserUtils {
    /**
     * Retrieves locales from navigator
     *
     * @param limit - limit of returned locales
     * @returns array of locales
     */
    public static getNavigatorLanguages(limit?: number): string[] {
        let languages: string[] = [];
        // https://developer.mozilla.org/ru/docs/Web/API/NavigatorLanguage/languages
        if (Array.isArray(navigator.languages)) {
            // get all languages if 'limit' is not specified
            const langLimit = limit || navigator.languages.length;
            languages = navigator.languages.slice(0, langLimit);
        } else if (navigator.language) {
            languages.push(navigator.language); // .language is first in .languages
        }
        return languages;
    }

    /**
     * Checks if version matches simple (without labels) semantic versioning scheme
     * https://semver.org/
     *
     * @param version - version string
     * @returns true, if string matches simple (without labels) semantic versioning scheme, else returns false
     */
    public static isSemver(version: string): boolean {
        const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
        return semverRegex.test(version);
    }

    /**
     * Checks if left version is greater than the right version
     *
     * @param leftVersion - semver string
     * @param rightVersion - semver string
     * @returns true, if left version is greater than the right version, else returns false
     */
    public static isGreaterVersion(leftVersion: string, rightVersion: string): boolean {
        const left = new Version(leftVersion);
        const right = new Version(rightVersion);
        return left.compare(right) > 0;
    }

    /**
     * Checks if left version is greater than the right version or equals
     *
     * @param leftVersion - semver string
     * @param rightVersion - semver string
     * @returns true, if left version is greater than the right version or equals, else returns false
     */
    public static isGreaterOrEqualsVersion(leftVersion: string, rightVersion: string): boolean {
        const left = new Version(leftVersion);
        const right = new Version(rightVersion);
        return left.compare(right) >= 0;
    }

    /**
     * Gets major number of version
     *
     * @param version - semver string
     * @returns major part of semver
     */
    public static getMajorVersionNumber(version: string): number {
        const v = new Version(version);
        return v.data[0];
    }

    /**
     * Gets minor number of version
     *
     * @param version - semver string
     * @returns minor part of semver
     */
    public static getMinorVersionNumber(version: string): number {
        const v = new Version(version);
        return v.data[1];
    }
}
