import { WebRequest } from 'webextension-polyfill';
import { NetworkRule, CookieModifier, logger } from '@adguard/tsurlfilter';
import { FilteringLog, defaultFilteringLog } from '../../filtering-log';
import CookieRulesFinder from './cookie-rules-finder';
import ParsedCookie from './parsed-cookie';
import CookieUtils from './utils';
import BrowserCookieApi from './browser-cookie/browser-cookie-api';
import { findHeaderByName } from '../../utils/headers';
import { requestContextStorage } from '../../request';
import { FrameRequestService } from '../frame-request-service';

import OnBeforeSendHeadersDetailsType = WebRequest.OnBeforeSendHeadersDetailsType;
import OnHeadersReceivedDetailsType = WebRequest.OnHeadersReceivedDetailsType;


/**
 * Cookie filtering
 *
 * The following public methods should be set as suitable webrequest events listeners,
 * check sample extension in this repo for an example
 *
 * Logic introduction:
 *
 * onBeforeSendHeaders:
 * - get all cookies for request url
 * - store cookies (first-party)
 *
 * onHeadersReceived:
 * - parse set-cookie header, only to detect if the cookie in header will be set from third-party request
 * - save third-party flag for this cookie cookie.thirdParty=request.thirdParty
 * - apply rules via removing them from headers and removing them with browser.cookies api
 * TODO Rewrite/split method for extensions on MV3, because we wont have possibility to remove rules via headers
 *
 * onCompleted
 * - apply rules via content script
 * In content-scripts (check /src/content-script/cookie-controller.ts):
 * - get matching cookie rules
 * - apply
 */
export class CookieFiltering {
    private filteringLog: FilteringLog;

    private browserCookieApi: BrowserCookieApi = new BrowserCookieApi();

    /**
     * Constructor
     *
     * @param filteringLog
     */
    constructor(filteringLog: FilteringLog) {
        this.filteringLog = filteringLog;
    }

    /**
     * Parses cookies from headers
     * @param details
     */
    public onBeforeSendHeaders(details: OnBeforeSendHeadersDetailsType): void {
        if (!details.requestHeaders) {
            return;
        }

        const context = requestContextStorage.get(details.requestId);
        if (!context) {
            return;
        }

        const cookieHeader = findHeaderByName(details.requestHeaders, 'Cookie');
        if (!cookieHeader || !cookieHeader.value) {
            return;
        }

        const cookies = CookieUtils.parseCookies(cookieHeader.value, context.requestUrl!);
        if (cookies.length === 0) {
            return;
        }

        context.cookies = cookies;
    }

    /**
     * Applies cookies to headers
     * @param details
     * @private
     */
    private applyRulesToCookieHeaders(details: WebRequest.OnHeadersReceivedDetailsType): boolean {
        let headersModified = false;

        if (!details.responseHeaders) {
            return headersModified;
        }

        const context = requestContextStorage.get(details.requestId);

        if (!context?.matchingResult) {
            return headersModified;
        }

        const cookieRules = context.matchingResult.getCookieRules();

        for (let i = details.responseHeaders.length - 1; i >= 0; i -= 1) {
            const header = details.responseHeaders[i];
            const cookie = CookieUtils.parseSetCookieHeader(header, details.url);

            if (!cookie) {
                continue;
            }

            const bRule = CookieRulesFinder.lookupNotModifyingRule(cookie.name, cookieRules, details.thirdParty);

            if (bRule) {
                if (!bRule.isAllowlist()) {
                    details.responseHeaders.splice(i, 1);
                    headersModified = true;
                }

                this.filteringLog.addCookieEvent({
                    tabId: context.tabId,
                    cookieName: cookie.name,
                    cookieValue: cookie.value,
                    cookieDomain: cookie.domain,
                    cookieRule: bRule,
                    isModifyingCookieRule: false,
                    thirdParty: details.thirdParty,
                    timestamp: Date.now(),
                });
            }

            const mRules = CookieRulesFinder.lookupModifyingRules(cookie.name, cookieRules, details.thirdParty);
            if (mRules.length > 0) {
                const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookie, mRules);
                if (appliedRules.length > 0) {
                    headersModified = true;
                    details.responseHeaders[i] =  { name: 'set-cookie', value: CookieUtils.serializeCookie(cookie) };
                    appliedRules.forEach((r) => {
                        this.filteringLog.addCookieEvent({
                            tabId: details.tabId,
                            cookieName: cookie.name,
                            cookieValue: cookie.value,
                            cookieDomain: cookie.domain,
                            cookieRule: r,
                            isModifyingCookieRule: true,
                            thirdParty: details.thirdParty,
                            timestamp: Date.now(),
                        });
                    });
                }
            }
        }

        return headersModified;
    }

    /**
     * Parses set-cookie header
     * looks up third-party cookies
     * This callback won't work for mv3 extensions
     * TODO separate or rewrite to mv2 and mv3 methods
     *
     * @param details
     */
    public onHeadersReceived(details: OnHeadersReceivedDetailsType): boolean {
        const context = requestContextStorage.get(details.requestId);
        if (!context) {
            return false;
        }

        if (details.responseHeaders) {
            const cookies = CookieUtils.parseSetCookieHeaders(details.responseHeaders, context.requestUrl!);
            const newCookies = cookies.filter((c) => !context.cookies?.includes(c));
            for (const cookie of newCookies) {
                cookie.thirdParty = details.thirdParty;
            }

            context.cookies?.push(...newCookies);
        }

        // remove cookie headers
        // this method won't work in the extension build with manifest v3
        const headersModified = this.applyRulesToCookieHeaders(details);

        // removes cookies with browser.cookie api
        this.applyRules(details.requestId)
            .catch(e => {
                logger.error((e as Error).message);
            });
        
        return headersModified;
    }

    /**
     * Looks up blocking rules for content-script in frame context
     */
    public getBlockingRules(
        frameUrl: string, 
        tabId: number, 
        frameId: number,
    ): NetworkRule[] {
        const searchParams = FrameRequestService.prepareSearchParams(frameUrl, tabId, frameId);
        const requestContext = FrameRequestService.search(searchParams);

        if (!requestContext){
            return [];
        }

        const { matchingResult, requestUrl } = requestContext;

        if (!matchingResult || !requestUrl) {
            return [];
        }

        const cookieRules = matchingResult.getCookieRules();

        return CookieRulesFinder.getBlockingRules(requestUrl, cookieRules);    
    }

    /**
     * Applies rules
     * @param requestId
     */
    private async applyRules(requestId: string): Promise<void> {
        const context = requestContextStorage.get(requestId);
        if (!context || !context.matchingResult) {
            return;
        }

        const cookieRules = context.matchingResult.getCookieRules();
        const { cookies } = context;
        if (!cookies) {
            return;
        }

        const promises = cookies.map(async (cookie) => {
            await this.applyRulesToCookie(cookie, cookieRules, context!.tabId);
        });

        await Promise.all(promises);
    }

    /**
     * Applies rules to cookie
     *
     * @param cookie
     * @param cookieRules
     * @param tabId
     */
    /* istanbul ignore next */
    private async applyRulesToCookie(
        cookie: ParsedCookie,
        cookieRules: NetworkRule[],
        tabId: number,
    ): Promise<void> {
        const cookieName = cookie.name;
        const isThirdPartyCookie = cookie.thirdParty;

        const bRule = CookieRulesFinder.lookupNotModifyingRule(cookieName, cookieRules, isThirdPartyCookie);
        if (bRule) {
            if (bRule.isAllowlist() || await this.browserCookieApi.removeCookie(cookie.name, cookie.url)) {
                this.filteringLog.addCookieEvent({
                    tabId,
                    cookieName: cookie.name,
                    cookieValue: cookie.value,
                    cookieDomain: cookie.domain,
                    cookieRule: bRule,
                    isModifyingCookieRule: false,
                    thirdParty: isThirdPartyCookie,
                    timestamp: Date.now(),
                });
            }

            return;
        }

        const mRules = CookieRulesFinder.lookupModifyingRules(cookieName, cookieRules, isThirdPartyCookie);
        if (mRules.length > 0) {
            const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookie, mRules);
            if (appliedRules.length > 0) {
                if (await this.browserCookieApi.modifyCookie(cookie)) {
                    appliedRules.forEach((r) => {
                        this.filteringLog.addCookieEvent({
                            tabId,
                            cookieName: cookie.name,
                            cookieValue: cookie.value,
                            cookieDomain: cookie.domain,
                            cookieRule: r,
                            isModifyingCookieRule: true,
                            thirdParty: isThirdPartyCookie,
                            timestamp: Date.now(),
                        });
                    });
                }
            }
        }
    }

    /**
     * Modifies instance of BrowserCookie with provided rules
     *
     * @param cookie Cookie modify
     * @param rules Cookie matching rules
     * @return applied rules
     *
     */
    private static applyRuleToBrowserCookie(cookie: ParsedCookie, rules: NetworkRule[]): NetworkRule[] {
        const appliedRules = [];

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];

            if (rule.isAllowlist()) {
                appliedRules.push(rule);
                continue;
            }
            
            const cookieModifier = rule.getAdvancedModifier() as CookieModifier;

            let modified = false;

            const sameSite = cookieModifier.getSameSite();
            if (sameSite && cookie.sameSite !== sameSite) {
                // eslint-disable-next-line no-param-reassign
                cookie.sameSite = sameSite;
                modified = true;
            }

            const maxAge = cookieModifier.getMaxAge();
            if (maxAge) {
                if (CookieUtils.updateCookieMaxAge(cookie, maxAge)) {
                    modified = true;
                }
            }

            if (modified) {
                appliedRules.push(rule);
            }
        }

        return appliedRules;
    }
}

export const cookieFiltering = new CookieFiltering(defaultFilteringLog);
