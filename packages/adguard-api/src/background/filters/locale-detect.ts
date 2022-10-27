import browser, { Tabs } from "webextension-polyfill";
import { isHttpRequest, getDomain } from "@adguard/tswebextension";

import { UserAgent } from "../utils";
import { Configuration } from "../schemas";
import { FiltersApi } from "./api";
import { notifier, NotifierEventType } from "../notifier";

export type BrowsingLanguage = {
    language: string;
    time: number;
};

/**
 *
 * This api is used to auto-enable language-specific filters.
 */
export class LocaleDetectService {
    private static SUCCESS_HIT_COUNT = 3;

    private static MAX_HISTORY_LENGTH = 10;

    private static domainToLanguagesMap: Record<string, string> = {
        // Russian
        ru: "ru",
        ua: "ru",
        by: "ru",
        kz: "ru",
        // English
        com: "en",
        au: "en",
        uk: "en",
        nz: "en",
        // German
        de: "de",
        at: "de",
        // Japanese
        jp: "ja",
        // Dutch
        nl: "nl",
        // French
        fr: "fr",
        // Spanish
        es: "es",
        // Italian
        it: "it",
        // Portuguese
        pt: "pt",
        // Polish
        pl: "pl",
        // Czech
        cz: "cs",
        // Bulgarian
        bg: "bg",
        // Lithuanian
        lt: "lt",
        // Latvian
        lv: "lv",
        // Arabic
        eg: "ar",
        dz: "ar",
        kw: "ar",
        ae: "ar",
        // Slovakian
        sk: "sk",
        // Romanian
        ro: "ro",
        // Suomi
        fi: "fi",
        // Icelandic
        is: "is",
        // Norwegian
        no: "no",
        // Greek
        gr: "el",
        // Hungarian
        hu: "hu",
        // Hebrew
        il: "he",
        // Chinese
        cn: "zh",
        // Indonesian
        id: "id",
        // Turkish
        tr: "tr",
    };

    private browsingLanguages: BrowsingLanguage[] = [];

    private filtersApi: FiltersApi;

    private enabledFilters: number[] = [];

    constructor(filtersApi: FiltersApi) {
        this.filtersApi = filtersApi;
        this.onTabUpdated = this.onTabUpdated.bind(this);
    }

    public start() {
        browser.tabs.onUpdated.addListener(this.onTabUpdated);
    }

    public stop() {
        browser.tabs.onUpdated.removeListener(this.onTabUpdated);
    }

    public configure(configuration: Configuration) {
        this.enabledFilters = configuration.filters;
    }

    private onTabUpdated(_tabId: number, _changeInfo: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab) {
        if (tab.status === "complete") {
            this.detectTabLanguage(tab);
        }
    }

    /**
     * Detects language for the specified tab
     *
     * @param tab - {@link Tabs.Tab} data
     */
    private async detectTabLanguage(tab: Tabs.Tab) {
        if (
            !tab.url ||
            // Check language only for http://... tabs
            !isHttpRequest(tab.url)
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
            const parts = host ? host.split(".") : [];
            const tld = parts[parts.length - 1];
            const lang = LocaleDetectService.domainToLanguagesMap[tld];
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
    private detectLanguage(language: string) {
        /**
         * For an unknown language "und" will be returned
         * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/detectLanguage
         */
        if (!language || language === "und") {
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
    private async onFilterDetectedByLocale(filterIds: number[]) {
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
