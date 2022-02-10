import { WebRequest } from 'webextension-polyfill';
import { findHeaderByName, removeHeader } from '../utils/headers';
import { getHost, isThirdPartyRequest } from '../utils/url';
import { RequestType } from '../request-type';
import HttpHeaders = WebRequest.HttpHeaders;
import StealthHelper from './stealth-helper';

/**
 * Stealth action bitwise masks
 */
export enum StealthActions {
    HIDE_REFERRER = 1 << 0,
    HIDE_SEARCH_QUERIES = 1 << 1,
    BLOCK_CHROME_CLIENT_DATA = 1 << 2,
    SEND_DO_NOT_TRACK = 1 << 3,
    FIRST_PARTY_COOKIES = 1 << 4,
    THIRD_PARTY_COOKIES = 1 << 5,
}

/**
 * Stealth service configuration
 */
export interface StealthConfig {
    /**
     * Is destruct first-party cookies enabled
     */
    selfDestructFirstPartyCookies: boolean;

    /**
     * Cookie maxAge in minutes
     */
    selfDestructFirstPartyCookiesTime: number;

    /**
     * Is destruct third-party cookies enabled
     */
    selfDestructThirdPartyCookies: boolean;

    /**
     * Cookie maxAge in minutes
     */
    selfDestructThirdPartyCookiesTime: number;

    /**
     * Remove referrer for third-party requests
     */
    hideReferrer: boolean;

    /**
     * Hide referrer in case of search engine is referrer
     */
    hideSearchQueries: boolean;

    /**
     * Remove X-Client-Data header
     */
    blockChromeClientData: boolean;

    /**
     * Adding Do-Not-Track (DNT) header
     */
    sendDoNotTrack: boolean;
}

/**
 * Stealth service module
 */
export class StealthService {
    /**
     * Headers
     */
    private static readonly HEADERS = {
        REFERRER: 'Referer',
        X_CLIENT_DATA: 'X-Client-Data',
        DO_NOT_TRACK: 'DNT',
    };

    /**
     * Header values
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
     * Search engines regexps
     *
     * @type {Array.<string>}
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
     * Configuration
     */
    private readonly config: StealthConfig;

    /**
     * Constructor
     *
     * @param config
     */
    constructor(config: StealthConfig) {
        this.config = config;
    }

    /**
     * Returns synthetic set of rules matching the specified request
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
     * Applies stealth actions to request headers
     *
     * @param requestUrl
     * @param requestType
     * @param requestHeaders
     */
    public processRequestHeaders(
        requestUrl: string, requestType: RequestType, requestHeaders: HttpHeaders,
    ): StealthActions {
        let stealthActions = 0;

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

        return stealthActions;
    }

    /**
     * Returns set dom signal script if sendDoNotTrack enabled, otherwise empty string
     */
    public getSetDomSignalScript(): string {
        if (this.config.sendDoNotTrack) {
            return `(${StealthHelper.setDomSignal.toString()})()`;
        }

        return '';
    }

    /**
     * Generates rule removing cookies
     *
     * @param maxAgeMinutes Cookie maxAge in minutes
     * @param isThirdParty Flag for generating third-party rule texts
     */
    private static generateCookieRuleText(maxAgeMinutes: number, isThirdParty = false): string {
        const maxAgeOption = maxAgeMinutes > 0 ? `;maxAge=${maxAgeMinutes * 60}` : '';
        const thirdPartyOption = isThirdParty ? ',third-party' : '';
        const ruleText = `$cookie=/.+/${maxAgeOption}${thirdPartyOption}`;
        return ruleText;
    }

    /**
     * Crops url path
     *
     * @param url URL
     * @return URL without path
     */
    private static createMockRefHeaderUrl(url: string): string {
        const host = getHost(url);
        return `${(url.indexOf('https') === 0 ? 'https://' : 'http://') + host}/`;
    }

    /**
     * Is url search engine
     *
     * @param url
     */
    private static isSearchEngine(url: string): boolean {
        return StealthService.SEARCH_ENGINES.some((searchEngineRegex) => searchEngineRegex.test(url));
    }
}
