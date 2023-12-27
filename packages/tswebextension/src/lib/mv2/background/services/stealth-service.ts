import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import { StealthOptionName, type NetworkRule } from '@adguard/tsurlfilter';
import { WebRequest } from 'webextension-polyfill';

import { findHeaderByName, getHost, isThirdPartyRequest } from '../../../common/utils';
import { removeHeader } from '../utils/headers';
import {
    FilteringEventType,
    type FilteringLogInterface,
} from '../../../common/filtering-log';
import type { StealthConfig } from '../../../common/configuration';
import { StealthHelper } from '../../../common/stealth-helper';

import type { RequestContext } from '../request';
import type { AppContext } from '../context';

/**
 * Stealth action bitwise masks used on the background page and on the filtering log page.
 */
export enum StealthActions {
    None = 0,
    HideReferrer = 1 << 0,
    HideSearchQueries = 1 << 1,
    BlockChromeClientData = 1 << 2,
    SendDoNotTrack = 1 << 3,
    // TODO check where this enums are used, and add comments
    FirstPartyCookies = 1 << 4,
    ThirdPartyCookies = 1 << 5,
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
     * Filtering logger.
     */
    private readonly filteringLog: FilteringLogInterface;

    /**
     * App context.
     */
    private readonly appContext: AppContext;

    /**
     * Configuration.
     *
     * @returns App Stealth configuration or undefined.
     */
    private get config(): StealthConfig | undefined {
        return this.appContext.configuration?.settings.stealth;
    }

    /**
     * Constructor.
     *
     * @param appContext App context.
     * @param filteringLog Filtering log.
     */
    constructor(appContext: AppContext, filteringLog: FilteringLogInterface) {
        this.appContext = appContext;
        this.filteringLog = filteringLog;
    }

    /**
     * Returns synthetic set of rules matching the specified request.
     *
     * @returns Strings of cookie rules.
     */
    public getCookieRulesTexts(): string[] {
        const result: string[] = [];

        if (this.config?.selfDestructFirstPartyCookies) {
            result.push(StealthService.generateCookieRuleText(this.config.selfDestructFirstPartyCookiesTime));
        }

        if (this.config?.selfDestructThirdPartyCookies) {
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
        let stealthActions = StealthActions.None;

        if (!this.config) {
            return stealthActions;
        }

        const {
            requestUrl,
            requestHeaders,
            matchingResult,
            requestType,
            tabId,
            eventId,
            referrerUrl,
            contentType,
            timestamp,
        } = context;

        if (!requestHeaders || matchingResult?.documentRule) {
            return stealthActions;
        }

        /**
         * Regarding stealth rule modifier, stealth options can be disabled on two occasions:
         * - stealth modifier does not have specific values, thus disabling stealth entirely
         * - stealth modifier has specific options to disable.
         */
        const stealthDisablingRule = matchingResult?.getStealthRule();
        if (stealthDisablingRule) {
            // $stealth rule without options is not being published to the filtering log
            // to conform with desktop application behavior
            return stealthActions;
        }

        // Collect applied allowlist rules in a set to only publish
        // one filtering event per applied allowlist rule
        const appliedAllowlistRules = new Set<NetworkRule>();

        // Remove referrer for third-party requests
        if (this.config?.hideReferrer) {
            const disablingRule = matchingResult?.getStealthRule(StealthOptionName.HideReferrer);
            if (disablingRule) {
                appliedAllowlistRules.add(disablingRule);
            } else if (StealthService.removeReferrer(requestHeaders, requestUrl)) {
                stealthActions |= StealthActions.HideReferrer;
            }
        }

        // Hide referrer in case of search engine is referrer
        const isMainFrame = requestType === RequestType.Document;
        if (isMainFrame && this.config?.hideSearchQueries) {
            const disablingRule = matchingResult?.getStealthRule(StealthOptionName.HideSearchQueries);
            if (disablingRule) {
                appliedAllowlistRules.add(disablingRule);
            } else if (StealthService.hideSearchQueries(requestHeaders, requestUrl)) {
                stealthActions |= StealthActions.HideSearchQueries;
            }
        }

        // Remove X-Client-Data header
        if (this.config?.blockChromeClientData) {
            const disablingRule = matchingResult?.getStealthRule(StealthOptionName.XClientData);
            if (disablingRule) {
                appliedAllowlistRules.add(disablingRule);
            } else if (StealthService.removeXClientData(requestHeaders)) {
                stealthActions |= StealthActions.BlockChromeClientData;
            }
        }

        // Adding Do-Not-Track (DNT) header
        if (this.config?.sendDoNotTrack) {
            const disablingRule = matchingResult?.getStealthRule(StealthOptionName.DoNotTrack);
            if (disablingRule) {
                appliedAllowlistRules.add(disablingRule);
            } else if (StealthService.sendDoNotTrack(requestHeaders)) {
                stealthActions |= StealthActions.SendDoNotTrack;
            }
        }

        if (appliedAllowlistRules.size > 0) {
            this.filteringLog.publishEvent({
                type: FilteringEventType.StealthAllowlistAction,
                data: {
                    tabId,
                    eventId,
                    rules: Array.from(appliedAllowlistRules),
                    requestUrl,
                    frameUrl: referrerUrl,
                    requestType: contentType,
                    timestamp,
                },
            });
        }

        if (stealthActions > 0) {
            this.filteringLog.publishEvent({
                type: FilteringEventType.StealthAction,
                data: {
                    tabId,
                    eventId,
                    stealthActions,
                },
            });
        }

        return stealthActions;
    }

    /**
     * Removes referrer from request headers.
     *
     * @param requestHeaders Request headers.
     * @param requestUrl Request URL.
     * @returns True if referrer was removed.
     */
    private static removeReferrer(requestHeaders: WebRequest.HttpHeaders, requestUrl: string): boolean {
        const refHeader = findHeaderByName(requestHeaders, StealthService.HEADERS.REFERRER);
        if (
            refHeader
            && refHeader.value
            && isThirdPartyRequest(requestUrl, refHeader.value)
        ) {
            refHeader.value = StealthService.createMockRefHeaderUrl(requestUrl);
            return true;
        }
        return false;
    }

    /**
     * Hides search queries from referrer.
     *
     * @param requestHeaders Request headers.
     * @param requestUrl Request URL.
     * @returns True if search queries were hidden.
     */
    private static hideSearchQueries(requestHeaders: WebRequest.HttpHeaders, requestUrl: string): boolean {
        const refHeader = findHeaderByName(requestHeaders, StealthService.HEADERS.REFERRER);
        if (
            refHeader
            && refHeader.value
            && StealthService.isSearchEngine(refHeader.value)
            && isThirdPartyRequest(requestUrl, refHeader.value)
        ) {
            refHeader.value = StealthService.createMockRefHeaderUrl(requestUrl);
            return true;
        }
        return false;
    }

    /**
     * Removes X-Client-Data header.
     *
     * @param requestHeaders Request headers.
     * @returns True if X-Client-Data header was removed.
     */
    private static removeXClientData(requestHeaders: WebRequest.HttpHeaders): boolean {
        return removeHeader(requestHeaders, StealthService.HEADERS.X_CLIENT_DATA);
    }

    /**
     * Adds Do-Not-Track (DNT) and Global Privacy Control (GPC) headers.
     *
     * @param requestHeaders Request headers.
     * @returns True if DNT and GPC headers were added.
     */
    private static sendDoNotTrack(requestHeaders: WebRequest.HttpHeaders): boolean {
        requestHeaders.push(StealthService.HEADER_VALUES.DO_NOT_TRACK);
        requestHeaders.push(StealthService.HEADER_VALUES.GLOBAL_PRIVACY_CONTROL);
        return true;
    }

    /**
     * Returns set dom signal script if sendDoNotTrack enabled, otherwise empty string.
     *
     * @returns Dom signal script.
     */
    public getSetDomSignalScript(): string {
        if (this.config?.sendDoNotTrack) {
            return `;(function ${StealthHelper.setDomSignal.toString()})();`;
        }
        return '';
    }

    /**
     * Returns hide document referrer script if hideReferrer enabled, otherwise empty string.
     *
     * @returns Hide referrer script.
     */
    public getHideDocumentReferrerScript(): string {
        if (this.config?.hideReferrer) {
            return `;(function ${StealthHelper.hideDocumentReferrer.toString()})();`;
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
