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
 * @throws error, if passed string cannot be parsed
 */
export class Version {
    // splitted semver
    public data: number[] = [];

    constructor(version: string) {
        const parts = String(version || "").split(".");

        for (let i = 3; i >= 0; i -= 1) {
            const part = parts[i];

            if (typeof part !== "string") {
                throw new Error("Can not parse version string");
            }

            this.data[i] = Version.parseVersionPart(part);
        }
    }

    /**
     * Compare current semver with passed
     *
     * @param version - {@link Version} instance
     * @returns number, indicates the result of the comparison (1 - greater, -1 - less, 0 - equals).
     * @throws error, if some version data is invalid
     */
    public compare(version: Version): number {
        for (let i = 0; i < 4; i += 1) {
            const leftPart = this.data[i];
            const rightPart = version.data[i];

            if (typeof leftPart !== "number" || typeof rightPart !== "number") {
                throw new Error("Can not compare versions");
            }

            if (leftPart > rightPart) {
                return 1;
            }
            if (leftPart < rightPart) {
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
