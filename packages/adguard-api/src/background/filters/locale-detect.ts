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

import browser, { Tabs } from 'webextension-polyfill';
import { isHttpRequest, getDomain } from '@adguard/tswebextension';

import { UserAgent } from '../utils';
import { Configuration } from '../schemas';
import { FiltersApi } from './api';
import { notifier, NotifierEventType } from '../notifier';

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
export class LocaleDetectService {
    // Language hits threshold
    private static SUCCESS_HIT_COUNT = 3;

    // Max count of hits, stored in memory
    private static MAX_HISTORY_LENGTH = 10;

    // Page locale to filter language data mapping
    private static domainToLanguagesMap: Record<string, string> = {
        // Russian
        ru: 'ru',
        ua: 'ru',
        by: 'ru',
        kz: 'ru',
        // English
        com: 'en',
        au: 'en',
        uk: 'en',
        nz: 'en',
        // German
        de: 'de',
        at: 'de',
        // Japanese
        jp: 'ja',
        // Dutch
        nl: 'nl',
        // French
        fr: 'fr',
        // Spanish
        es: 'es',
        // Italian
        it: 'it',
        // Portuguese
        pt: 'pt',
        // Polish
        pl: 'pl',
        // Czech
        cz: 'cs',
        // Bulgarian
        bg: 'bg',
        // Lithuanian
        lt: 'lt',
        // Latvian
        lv: 'lv',
        // Arabic
        eg: 'ar',
        dz: 'ar',
        kw: 'ar',
        ae: 'ar',
        // Slovakian
        sk: 'sk',
        // Romanian
        ro: 'ro',
        // Suomi
        fi: 'fi',
        // Icelandic
        is: 'is',
        // Norwegian
        no: 'no',
        // Greek
        gr: 'el',
        // Hungarian
        hu: 'hu',
        // Hebrew
        il: 'he',
        // Chinese
        cn: 'zh',
        // Indonesian
        id: 'id',
        // Turkish
        tr: 'tr',
    };

    // Memory storage for language hits
    private browsingLanguages: BrowsingLanguage[] = [];

    // Api for managing filters data
    private filtersApi: FiltersApi;

    // list of enabled filters ids
    private enabledFilters: number[] = [];

    constructor(filtersApi: FiltersApi) {
        this.filtersApi = filtersApi;
        this.onTabUpdated = this.onTabUpdated.bind(this);
    }

    /**
     * Add tab updates listener
     */
    public start(): void {
        browser.tabs.onUpdated.addListener(this.onTabUpdated);
    }

    /**
     * Remove tab updates listener
     */
    public stop(): void {
        browser.tabs.onUpdated.removeListener(this.onTabUpdated);
    }

    /**
     * Set enabled filters ids on {@link Configuration} load
     *
     * @param configuration - loaded {@link Configuration}
     */
    public configure(configuration: Configuration): void {
        this.enabledFilters = configuration.filters;
    }

    /**
     * Handles tab data on update
     *
     * @param _tabId - Tab id
     * @param _changeInfo - Tab change info
     * @param tab - Tab details record
     */
    private onTabUpdated(_tabId: number, _changeInfo: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab): void {
        if (tab.status === 'complete') {
            this.detectTabLanguage(tab);
        }
    }

    /**
     * Detects language for the specified tab
     *
     * @param tab - {@link Tabs.Tab} data
     */
    private async detectTabLanguage(tab: Tabs.Tab): Promise<void> {
        if (
            !tab.url
            // Check language only for http://... tabs
            || !isHttpRequest(tab.url)
        ) {
            return;
        }

        // tabs.detectLanguage doesn't work in Opera
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/997
        if (!UserAgent.isOpera) {
            if (tab.id && browser.tabs && browser.tabs.detectLanguage) {
                // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/detectLanguage
                try {
                    const language = await browser.tabs.detectLanguage(tab.id);
                    this.detectLanguage(language);
                } catch (e) {
                    // do nothing
                }
                return;
            }
        }

        // Detecting language by top-level domain if extension API language detection is unavailable
        // Ignore hostnames which length is less or equal to 8
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1354
        const host = getDomain(tab.url);
        if (host && host.length > 8) {
            const parts = host.split('.');
            const tld = parts.at(-1);

            if (!tld) {
                return;
            }

            const lang = LocaleDetectService.domainToLanguagesMap[tld];

            if (!lang) {
                return;
            }

            this.detectLanguage(lang);
        }
    }

    /**
     * Stores language in the special array containing languages of the last visited pages.
     * If user has visited enough pages with a specified language we call special callback
     * to auto-enable filter for this language
     *
     * @param language - Page language
     */
    private detectLanguage(language: string): void {
        /**
         * For an unknown language "und" will be returned
         * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/detectLanguage
         */
        if (!language || language === 'und') {
            return;
        }

        this.browsingLanguages.push({
            language,
            time: Date.now(),
        });

        if (this.browsingLanguages.length > LocaleDetectService.MAX_HISTORY_LENGTH) {
            this.browsingLanguages.shift();
        }

        const history = this.browsingLanguages.filter((h) => {
            return h.language === language;
        });

        if (history.length >= LocaleDetectService.SUCCESS_HIT_COUNT) {
            const filterIds = this.filtersApi.getFilterIdsForLanguage(language);
            this.onFilterDetectedByLocale(filterIds);
        }
    }

    /**
     * Called when LocaleDetector has detected language-specific filters we can enable.
     *
     * @param filterIds - list of detected language-specific filters identifiers
     */
    private onFilterDetectedByLocale(filterIds: number[]): void {
        if (!filterIds || filterIds.length === 0) {
            return;
        }

        const filtersIds = filterIds.filter((filterId) => !this.enabledFilters.includes(filterId));

        notifier.publishEvent({
            type: NotifierEventType.DetectFilters,
            data: {
                filtersIds,
            },
        });
    }
}
