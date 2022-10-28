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
 * Helper class for work with semver (x.x.x)
 *
 * @param version - semver string
 * @class
 */
export class Version {
    // splitted semver
    public data: number[] = [];

    constructor(version: string) {
        const parts = String(version || "").split(".");

        for (let i = 3; i >= 0; i -= 1) {
            this.data[i] = Version.parseVersionPart(parts[i]);
        }
    }

    /**
     * Compare current semver with passed
     *
     * @param version - {@link Version} instance
     * @returns number, indicates the result of the comparison
     * (1 - greater, -1 - less, 0 - equals).
     */
    public compare(version: Version): number {
        for (let i = 0; i < 4; i += 1) {
            if (this.data[i] > version.data[i]) {
                return 1;
            }
            if (this.data[i] < version.data[i]) {
                return -1;
            }
        }
        return 0;
    }

    /**
     * Cast semver part to number
     *
     * @param part - splitted semver part
     * @returns semver part number
     */
    private static parseVersionPart(part: string): number {
        if (Number.isNaN(part)) {
            return 0;
        }

        return Math.max(Number(part) - 0, 0);
    }
}
