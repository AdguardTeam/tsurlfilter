import { RequestType } from '@adguard/tsurlfilter';

import { findHeaderByName, removeHeader } from '../utils/headers';
import {
    FilteringEventType,
    FilteringLogInterface,
    StealthHelper,
    StealthConfig,
    getHost,
    isThirdPartyRequest,
} from '../../../common';

import { RequestContext } from '../request';

/**
 * Stealth action bitwise masks.
 */
export enum StealthActions {
    HIDE_REFERRER = 1 << 0,
    HIDE_SEARCH_QUERIES = 1 << 1,
    BLOCK_CHROME_CLIENT_DATA = 1 << 2,
    SEND_DO_NOT_TRACK = 1 << 3,
    // TODO check where this enums are used, and add comments
    FIRST_PARTY_COOKIES = 1 << 4,
    THIRD_PARTY_COOKIES = 1 << 5,
}

/**
 * Stealth service module.
 */
export class StealthService {
    /**
     * Headers.
     */
    private static readonly HEADERS = {
        REFERRER: 'Referer',
        X_CLIENT_DATA: 'X-Client-Data',
        DO_NOT_TRACK: 'DNT',
    };

    /**
     * Header values.
     */
    private static readonly HEADER_VALUES = {
        DO_NOT_TRACK: {
            name: 'DNT',
            value: '1',
        },
        GLOBAL_PRIVACY_CONTROL: {
            name: 'Sec-GPC',
            value: '1',
        },
    };

    /**
     * Search engines regexps.
     */
    private static readonly SEARCH_ENGINES = [
        /https?:\/\/(www\.)?google\./i,
        /https?:\/\/(www\.)?yandex\./i,
        /https?:\/\/(www\.)?bing\./i,
        /https?:\/\/(www\.)?yahoo\./i,
        /https?:\/\/(www\.)?go\.mail\.ru/i,
        /https?:\/\/(www\.)?ask\.com/i,
        /https?:\/\/(www\.)?aol\.com/i,
        /https?:\/\/(www\.)?baidu\.com/i,
        /https?:\/\/(www\.)?seznam\.cz/i,
    ];

    /**
     * Configuration.
     */
    private readonly config: StealthConfig;

    /**
     * Filtering logger.
     */
    private readonly filteringLog: FilteringLogInterface;

    /**
     * Constructor.
     *
     * @param config Configuration.
     * @param filteringLog Filtering log.
     */
    constructor(
        config: StealthConfig,
        filteringLog: FilteringLogInterface,
    ) {
        this.config = config;
        this.filteringLog = filteringLog;
    }

    /**
     * Returns synthetic set of rules matching the specified request.
     *
     * @returns Strings of cookie rules.
     */
    public getCookieRulesTexts(): string[] {
        const result: string[] = [];

        if (this.config.selfDestructFirstPartyCookies) {
            result.push(StealthService.generateCookieRuleText(this.config.selfDestructFirstPartyCookiesTime));
        }

        if (this.config.selfDestructThirdPartyCookies) {
            result.push(StealthService.generateCookieRuleText(this.config.selfDestructThirdPartyCookiesTime, true));
        }

        return result;
    }

    /**
     * Applies stealth actions to request headers.
     *
     * @param context Request context.
     * @returns Stealth actions bitmask.
     */
    public processRequestHeaders(context: RequestContext): StealthActions {
        let stealthActions = 0;

        const { requestUrl, requestType, requestHeaders } = context;

        if (!requestHeaders) {
            return stealthActions;
        }

        // Remove referrer for third-party requests
        if (this.config.hideReferrer) {
            const refHeader = findHeaderByName(requestHeaders, StealthService.HEADERS.REFERRER);
            if (refHeader
                && refHeader.value
                && isThirdPartyRequest(requestUrl, refHeader.value)) {
                refHeader.value = StealthService.createMockRefHeaderUrl(requestUrl);
                stealthActions |= StealthActions.HIDE_REFERRER;
            }
        }

        // Hide referrer in case of search engine is referrer
        const isMainFrame = requestType === RequestType.Document;
        if (this.config.hideSearchQueries && isMainFrame) {
            const refHeader = findHeaderByName(requestHeaders, StealthService.HEADERS.REFERRER);
            if (refHeader
                && refHeader.value
                && StealthService.isSearchEngine(refHeader.value)
                && isThirdPartyRequest(requestUrl, refHeader.value)) {
                refHeader.value = StealthService.createMockRefHeaderUrl(requestUrl);
                stealthActions |= StealthActions.HIDE_SEARCH_QUERIES;
            }
        }

        // Remove X-Client-Data header
        if (this.config.blockChromeClientData) {
            if (removeHeader(requestHeaders, StealthService.HEADERS.X_CLIENT_DATA)) {
                stealthActions |= StealthActions.BLOCK_CHROME_CLIENT_DATA;
            }
        }

        // Adding Do-Not-Track (DNT) header
        if (this.config.sendDoNotTrack) {
            requestHeaders.push(StealthService.HEADER_VALUES.DO_NOT_TRACK);
            requestHeaders.push(StealthService.HEADER_VALUES.GLOBAL_PRIVACY_CONTROL);
            stealthActions |= StealthActions.SEND_DO_NOT_TRACK;
        }

        if (stealthActions > 0) {
            this.filteringLog.publishEvent({
                type: FilteringEventType.STEALTH_ACTION,
                data: {
                    tabId: context.tabId,
                    eventId: context.requestId,
                    stealthActions,
                },
            });
        }

        return stealthActions;
    }

    /**
     * Returns set dom signal script if sendDoNotTrack enabled, otherwise empty string.
     *
     * @returns Dom signal script.
     */
    public getSetDomSignalScript(): string {
        if (this.config.sendDoNotTrack) {
            return `(${StealthHelper.setDomSignal.toString()})()`;
        }

        return '';
    }

    /**
     * Generates rule removing cookies.
     *
     * @param maxAgeMinutes Cookie maxAge in minutes.
     * @param isThirdParty Flag for generating third-party rule texts.
     * @returns Rule text.
     */
    private static generateCookieRuleText(maxAgeMinutes: number, isThirdParty = false): string {
        const maxAgeOption = maxAgeMinutes > 0 ? `;maxAge=${maxAgeMinutes * 60}` : '';
        const thirdPartyOption = isThirdParty ? ',third-party' : '';
        const ruleText = `$cookie=/.+/${maxAgeOption}${thirdPartyOption}`;
        return ruleText;
    }

    /**
     * Crops url path.
     *
     * @param url URL.
     * @returns URL without path.
     */
    private static createMockRefHeaderUrl(url: string): string {
        const host = getHost(url);
        return `${(url.indexOf('https') === 0 ? 'https://' : 'http://') + host}/`;
    }

    /**
     * Is url search engine.
     *
     * @param url Url for check.
     * @returns True if url is search engine.
     */
    private static isSearchEngine(url: string): boolean {
        return StealthService.SEARCH_ENGINES.some((searchEngineRegex) => searchEngineRegex.test(url));
    }
}
