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
 * Helper class for work with semver
 *
 * Parsed semver string saves in {@link data} property.
 * We save first {@link MAX_LENGTH} parts of parsed string.
 * If there are less than {@link MAX_LENGTH} parts in the version, the missing ones are filled with zeros
 * For example, entry string `1.1` will be parsed as `[1, 1, 0, 0]`.
 *
 * @param version - semver string
 * @class
 * @throws error, if passed string cannot be parsed
 */
export declare class Version {
    private static MAX_LENGTH;
    data: number[];
    constructor(version: string);
    /**
     * Compare current semver with passed
     *
     * @param version - {@link Version} instance
     * @returns number, indicates the result of the comparison (1 - greater, -1 - less, 0 - equals).
     * @throws error, if some version data is invalid
     */
    compare(version: Version): number;
}
