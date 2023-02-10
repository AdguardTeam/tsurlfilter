/* eslint-disable class-methods-use-this,jsdoc/require-description-complete-sentence */
import { nanoid } from 'nanoid';
import { NetworkRule, CookieModifier } from '@adguard/tsurlfilter';
import {
    ContentType,
    defaultFilteringLog,
    FilteringEventType,
    FilteringLogInterface,
    logger,
} from '../../../../common';
import CookieRulesFinder from './cookie-rules-finder';
import ParsedCookie from './parsed-cookie';
import CookieUtils from './utils';
import BrowserCookieApi from './browser-cookie/browser-cookie-api';
import { findHeaderByName } from '../../utils/headers';
import { RequestContext, requestContextStorage } from '../../request';
import { tabsApi } from '../../tabs';

/**
 * Cookie filtering.
 *
 * The following public methods should be set as suitable webrequest events listeners, check sample extension in this
 * repo for an example.
 *
 * Logic introduction:
 *  onBeforeSendHeaders:
 *  - get all cookies for request url;
 *  - store cookies (first-party);
 *
 *  onHeadersReceived:
 *  - parse set-cookie header, only to detect if the cookie in header will be set from third-party request;
 *  - save third-party flag for this cookie cookie.thirdParty=request.thirdParty;
 *  - apply rules via removing them from headers and removing them with browser.cookies api;
 *  TODO Rewrite/split method for extensions on MV3, because we wont have possibility to remove rules via headers.
 *
 *  onCompleted
 *  - apply rules via content script
 *  In content-scripts (check /src/content-script/cookie-controller.ts):
 *  - get matching cookie rules
 *  - apply
 */
export class CookieFiltering {
    private filteringLog: FilteringLogInterface;

    private browserCookieApi: BrowserCookieApi = new BrowserCookieApi();

    /**
     * Constructor.
     *
     * @param filteringLog Filtering log.
     */
    constructor(filteringLog: FilteringLogInterface) {
        this.filteringLog = filteringLog;
    }

    /**
     * Parses cookies from headers.
     *
     * @param context Request context.
     */
    public onBeforeSendHeaders(context: RequestContext): void {
        const { requestHeaders, requestUrl, requestId } = context;
        if (!requestHeaders || !requestUrl) {
            return;
        }

        const cookieHeader = findHeaderByName(requestHeaders, 'Cookie');

        if (!cookieHeader?.value) {
            return;
        }

        const cookies = CookieUtils.parseCookies(cookieHeader.value, requestUrl);
        if (cookies.length === 0) {
            return;
        }

        requestContextStorage.update(requestId, { cookies });
    }

    /**
     * Applies cookies to headers.
     *
     * @param context Request context.
     * @returns True if headers were modified.
     */
    private applyRulesToCookieHeaders(context: RequestContext): boolean {
        let headersModified = false;

        const {
            responseHeaders,
            matchingResult,
            requestUrl,
            thirdParty,
            tabId,
            requestId,
        } = context;

        if (!responseHeaders
            || !matchingResult
            || !requestUrl
            || typeof thirdParty !== 'boolean'
        ) {
            return headersModified;
        }

        const cookieRules = matchingResult.getCookieRules();

        for (let i = responseHeaders.length - 1; i >= 0; i -= 1) {
            const header = responseHeaders[i];
            const cookie = CookieUtils.parseSetCookieHeader(header, requestUrl);

            if (!cookie) {
                continue;
            }

            const bRule = CookieRulesFinder.lookupNotModifyingRule(cookie.name, cookieRules, thirdParty);

            if (bRule) {
                if (!bRule.isAllowlist()) {
                    responseHeaders.splice(i, 1);
                    headersModified = true;
                }

                this.filteringLog.publishEvent({
                    type: FilteringEventType.COOKIE,
                    data: {
                        eventId: nanoid(),
                        tabId: context.tabId,
                        cookieName: cookie.name,
                        cookieValue: cookie.value,
                        frameDomain: cookie.domain,
                        rule: bRule,
                        isModifyingCookieRule: false,
                        requestThirdParty: thirdParty,
                        requestType: ContentType.COOKIE,
                        timestamp: Date.now(),
                    },

                });
            }

            const mRules = CookieRulesFinder.lookupModifyingRules(cookie.name, cookieRules, thirdParty);
            if (mRules.length > 0) {
                const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookie, mRules);
                if (appliedRules.length > 0) {
                    headersModified = true;
                    responseHeaders[i] = { name: 'set-cookie', value: CookieUtils.serializeCookie(cookie) };
                    appliedRules.forEach((r) => {
                        this.filteringLog.publishEvent({
                            type: FilteringEventType.COOKIE,
                            data: {
                                eventId: nanoid(),
                                tabId,
                                cookieName: cookie.name,
                                cookieValue: cookie.value,
                                frameDomain: cookie.domain,
                                rule: r,
                                isModifyingCookieRule: true,
                                requestThirdParty: thirdParty,
                                timestamp: Date.now(),
                                requestType: ContentType.COOKIE,
                            },
                        });
                    });
                }
            }
        }

        if (headersModified) {
            requestContextStorage.update(requestId, { responseHeaders });
        }

        return headersModified;
    }

    /**
     * Parses set-cookie header and looks up third-party cookies.
     * This callback won't work for mv3 extensions.
     * TODO separate or rewrite to mv2 and mv3 methods.
     *
     * @param context Request context.
     * @returns True if headers were modified.
     */
    public onHeadersReceived(context: RequestContext): boolean {
        const {
            responseHeaders,
            requestUrl,
            thirdParty,
            requestId,
        } = context;

        if (responseHeaders
            && requestUrl
            && typeof thirdParty === 'boolean'
        ) {
            const cookies = CookieUtils.parseSetCookieHeaders(responseHeaders, requestUrl);
            const newCookies = cookies.filter((c) => !context.cookies?.includes(c));
            for (const cookie of newCookies) {
                cookie.thirdParty = thirdParty;
            }

            requestContextStorage.update(requestId, {
                cookies: context.cookies ? [...context.cookies, ...newCookies] : newCookies,
            });
        }

        // remove cookie headers
        // this method won't work in the extension build with manifest v3
        const headersModified = this.applyRulesToCookieHeaders(context);

        // removes cookies with browser.cookie api
        this.applyRules(context)
            .catch((e) => {
                logger.error((e as Error).message);
            });

        return headersModified;
    }

    /**
     * TODO: Return engine startup status data to content script
     * to delay execution of cookie rules until the engine is ready
     *
     * Looks up blocking rules for content-script in frame context.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @returns List of blocking rules.
     */
    public getBlockingRules(tabId: number, frameId: number): NetworkRule[] {
        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (!frame || !frame.matchingResult) {
            return [];
        }

        const cookieRules = frame.matchingResult.getCookieRules();

        return CookieRulesFinder.getBlockingRules(frame.url, cookieRules);
    }

    /**
     * Applies rules.
     *
     * @param context Request context.
     */
    private async applyRules(context: RequestContext): Promise<void> {
        const { matchingResult, cookies, tabId } = context;

        if (!matchingResult || !cookies) {
            return;
        }

        const cookieRules = matchingResult.getCookieRules();

        const promises = cookies.map(async (cookie) => {
            await this.applyRulesToCookie(cookie, cookieRules, tabId);
        });

        await Promise.all(promises);
    }

    /**
     * Applies rules to cookie.
     *
     * @param cookie Cookie.
     * @param cookieRules Cookie rules.
     * @param tabId Tab id.
     */
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
                this.filteringLog.publishEvent({
                    type: FilteringEventType.COOKIE,
                    data: {
                        eventId: nanoid(),
                        tabId,
                        cookieName: cookie.name,
                        cookieValue: cookie.value,
                        frameDomain: cookie.domain,
                        rule: bRule,
                        isModifyingCookieRule: false,
                        requestThirdParty: isThirdPartyCookie,
                        timestamp: Date.now(),
                        requestType: ContentType.COOKIE,
                    },
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
                        this.filteringLog.publishEvent({
                            type: FilteringEventType.COOKIE,
                            data: {
                                eventId: nanoid(),
                                tabId,
                                cookieName: cookie.name,
                                cookieValue: cookie.value,
                                frameDomain: cookie.domain,
                                rule: r,
                                isModifyingCookieRule: true,
                                requestThirdParty: isThirdPartyCookie,
                                timestamp: Date.now(),
                                requestType: ContentType.COOKIE,
                            },
                        });
                    });
                }
            }
        }
    }

    /**
     * Modifies instance of BrowserCookie with provided rules.
     *
     * @param cookie Cookie modify.
     * @param rules Cookie matching rules.
     * @returns Applied rules.
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
