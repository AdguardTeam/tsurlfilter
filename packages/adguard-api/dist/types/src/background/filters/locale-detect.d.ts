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
import { Configuration } from "../schemas";
import { FiltersApi } from "./api";
export type BrowsingLanguage = {
    language: string;
    time: number;
};
/**
 *
 * This service is used to auto-enable language-specific filters.
 *
 * Tracks page language, reading data on browser tab update.
 *
 * If language hits some times, checks if language filter
 * is disabled and dispatches {@link NotifierEventType.DetectFilters} event with detected filter ids.
 */
export declare class LocaleDetectService {
    private static SUCCESS_HIT_COUNT;
    private static MAX_HISTORY_LENGTH;
    private static domainToLanguagesMap;
    private browsingLanguages;
    private filtersApi;
    private enabledFilters;
    constructor(filtersApi: FiltersApi);
    /**
     * Add tab updates listener
     */
    start(): void;
    /**
     * Remove tab updates listener
     */
    stop(): void;
    /**
     * Set enabled filters ids on {@link Configuration} load
     *
     * @param configuration - loaded {@link Configuration}
     */
    configure(configuration: Configuration): void;
    /**
     * Handles tab data on update
     *
     * @param _tabId - Tab id
     * @param _changeInfo - Tab change info
     * @param tab - Tab details record
     */
    private onTabUpdated;
    /**
     * Detects language for the specified tab
     *
     * @param tab - {@link Tabs.Tab} data
     */
    private detectTabLanguage;
    /**
     * Stores language in the special array containing languages of the last visited pages.
     * If user has visited enough pages with a specified language we call special callback
     * to auto-enable filter for this language
     *
     * @param language - Page language
     */
    private detectLanguage;
    /**
     * Called when LocaleDetector has detected language-specific filters we can enable.
     *
     * @param filterIds - list of detected language-specific filters identifiers
     */
    private onFilterDetectedByLocale;
}
