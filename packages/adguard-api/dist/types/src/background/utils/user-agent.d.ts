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
declare global {
    interface Navigator {
        readonly userAgentData?: NavigatorUAData;
    }
}
interface NavigatorUABrandVersion {
    readonly brand: string;
    readonly version: string;
}
interface UADataValues {
    readonly brands?: NavigatorUABrandVersion[];
    readonly mobile?: boolean;
    readonly platform?: string;
    readonly architecture?: string;
    readonly bitness?: string;
    readonly model?: string;
    readonly platformVersion?: string;
    /** @deprecated in favour of fullVersionList */
    readonly uaFullVersion?: string;
    readonly fullVersionList?: NavigatorUABrandVersion[];
    readonly wow64?: boolean;
}
interface UALowEntropyJSON {
    readonly brands: NavigatorUABrandVersion[];
    readonly mobile: boolean;
    readonly platform: string;
}
interface NavigatorUAData extends UALowEntropyJSON {
    getHighEntropyValues(hints: string[]): Promise<UADataValues>;
    toJSON(): UALowEntropyJSON;
}
/**
 * Helper class for user agent data
 */
export declare class UserAgent {
    private static browserDataMap;
    static isChrome: boolean;
    static isFirefox: boolean;
    static isOpera: boolean;
    static isEdge: boolean;
    /**
     * Check if current browser is as given
     *
     * @param browserName - Browser Name
     * @returns true, if current browser has specified name
     */
    private static isTargetBrowser;
}
export {};
