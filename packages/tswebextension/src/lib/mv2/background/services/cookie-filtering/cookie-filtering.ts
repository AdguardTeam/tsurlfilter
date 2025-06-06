import { type NetworkRule, type CookieModifier, NetworkRuleOption } from '@adguard/tsurlfilter';
import { getDomain } from 'tldts';

import { ParsedCookie } from '../../../../common/cookie-filtering/parsed-cookie';
import { createFrameMatchQuery } from '../../../../common/utils/create-frame-match-query';
import { findHeaderByName } from '../../../../common/utils/headers';
import { logger } from '../../../../common/utils/logger';
import { nanoid } from '../../../../common/utils/nanoid';
import CookieRulesFinder from '../../../../common/cookie-filtering/cookie-rules-finder';
import { BrowserCookieApi } from '../../../../common/cookie-filtering/browser-cookie-api';
import { defaultFilteringLog, FilteringEventType, type FilteringLogInterface } from '../../../../common/filtering-log';
import { ContentType } from '../../../../common/request-type';
import { engineApi, tabsApi } from '../../api';
import { type RequestContext, requestContextStorage } from '../../request';

import CookieUtils from './utils';

/**
 * Cookie filtering.
 *
 * The following public methods should be set as suitable webRequest events listeners, check sample extension in this
 * repo for an example.
 *
 * Logic introduction:
 *  CookieFiltering.onBeforeSendHeaders:
 *  - get all cookies for request url;
 *  - store cookies (first-party);
 *  - apply rules via modifying or removing them from headers
 *    and modifying or removing them with browser.cookies api;
 *
 *  CookieFiltering.onHeadersReceived:
 *  - parse set-cookie header, only to detect if the cookie in header will be set from third-party request;
 *  - save third-party flag for this cookie cookie.thirdParty=request.thirdParty;
 *  - apply rules via modifying or removing them from headers
 *    and modifying or removing them with browser.cookies api;
 *
 *  CookieFiltering.onCompleted:
 *  - apply rules via content script
 *  In content-scripts (check /src/content-script/cookie-controller.ts):
 *  - get matching cookie rules;
 *  - apply.
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
     *
     * @returns True if headers were modified.
     */
    public onBeforeSendHeaders(context: RequestContext): boolean {
        const { requestHeaders, requestUrl, requestId } = context;
        if (!requestHeaders || !requestUrl) {
            return false;
        }

        const cookieHeader = findHeaderByName(requestHeaders, 'Cookie');

        if (!cookieHeader?.value) {
            return false;
        }

        const cookies = CookieUtils.parseCookies(cookieHeader.value, requestUrl);
        if (cookies.length === 0) {
            return false;
        }

        // Saves cookies to context
        requestContextStorage.update(requestId, { cookies });

        // Removes cookies from browser with browser.cookies api, but not
        // removing them from context to correct process them in headers.
        // IMPORTANT: This method reads cookies from context, so it should be
        // called before method that change headers, since that method will
        // remove or change headers in context.
        this.applyRules(context)
            .catch((e) => {
                logger.error('[tsweb.CookieFiltering.onBeforeSendHeaders]: cannot apply rules due to: ', e);
            });

        // Removes cookie from headers and updates context.
        // Note: this method won't work in the extension build with manifest v3.
        const headersModified = this.applyRulesToRequestCookieHeaders(context);

        return headersModified;
    }

    /**
     * Applies cookies to request headers.
     *
     * @param context Request context.
     *
     * @returns True if headers were modified.
     */
    private applyRulesToRequestCookieHeaders(context: RequestContext): boolean {
        let headersModified = false;

        const {
            requestHeaders,
            cookies,
            matchingResult,
            requestUrl,
            thirdParty,
            tabId,
            requestId,
        } = context;

        if (!requestHeaders
            || !matchingResult
            || !requestUrl
            || typeof thirdParty !== 'boolean'
            || !cookies
        ) {
            return headersModified;
        }

        const cookieRules = matchingResult.getCookieRules();

        for (let i = 0; i < cookies.length; i += 1) {
            const cookie = cookies[i];

            if (!cookie) {
                continue;
            }

            const bRule = CookieRulesFinder.lookupNotModifyingRule(cookie.name, cookieRules, thirdParty);

            if (bRule) {
                if (!bRule.isAllowlist()) {
                    // Remove from cookies array.
                    cookies.splice(i, 1);
                    // Move the loop counter back because we removed one element
                    // from the iterated array.
                    i -= 1;
                    headersModified = true;
                }

                this.recordCookieEvent(tabId, cookie, requestUrl, bRule, false, thirdParty);
            }

            const mRules = CookieRulesFinder.lookupModifyingRules(cookie.name, cookieRules, thirdParty);
            if (mRules.length > 0) {
                const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookie, mRules);
                if (appliedRules.length > 0) {
                    headersModified = true;
                }
                appliedRules.forEach((r) => {
                    this.recordCookieEvent(tabId, cookie, requestUrl, r, true, thirdParty);
                });
            }
        }

        if (headersModified) {
            const cookieHeaderIndex = requestHeaders.findIndex((header) => header.name.toLowerCase() === 'cookie');
            if (cookieHeaderIndex !== -1) {
                if (cookies.length > 0) {
                    // Update "cookie" header before send request to server.
                    requestHeaders[cookieHeaderIndex].value = CookieUtils.serializeCookieToRequestHeader(cookies);
                } else {
                    // Empty cookies, delete header "Cookie".
                    requestHeaders.splice(cookieHeaderIndex, 1);
                }
            }

            // Update headers and cookies in context.
            requestContextStorage.update(requestId, { requestHeaders, cookies });
        }

        return headersModified;
    }

    /**
     * Applies cookies to response headers.
     *
     * @param context Request context.
     *
     * @returns True if headers were modified.
     */
    private applyRulesToResponseCookieHeaders(context: RequestContext): boolean {
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

                this.recordCookieEvent(tabId, cookie, requestUrl, bRule, false, thirdParty);
            }

            const mRules = CookieRulesFinder.lookupModifyingRules(cookie.name, cookieRules, thirdParty);

            // Only apply if there is at least one non-allowlist rule
            if (mRules.length > 0 && mRules.some((r) => !r.isAllowlist())) {
                const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookie, mRules);
                if (appliedRules.length > 0) {
                    headersModified = true;
                    responseHeaders[i] = {
                        name: 'set-cookie',
                        value: CookieUtils.serializeCookieToResponseHeader(cookie),
                    };
                    appliedRules.forEach((r) => {
                        this.recordCookieEvent(tabId, cookie, requestUrl, r, true, thirdParty);
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
     *
     * @returns True if headers were modified.
     */
    public onHeadersReceived(context: RequestContext): boolean {
        const {
            responseHeaders,
            requestUrl,
            thirdParty,
            requestId,
        } = context;

        /**
         * Full context can be created in onBeforeRequest, partial context can
         * be created on every requestContextStorage.update method call and
         * because of that case - we explicitly checks fields in object.
         * TODO: Improve in AG-24428.
         */
        if (responseHeaders && requestUrl && typeof thirdParty !== 'undefined') {
            const cookies = CookieUtils.parseSetCookieHeaders(responseHeaders, requestUrl);
            const newCookies = cookies.filter((c) => !context.cookies?.includes(c));
            for (const cookie of newCookies) {
                cookie.thirdParty = thirdParty;
            }

            requestContextStorage.update(requestId, {
                cookies: context.cookies ? [...context.cookies, ...newCookies] : newCookies,
            });
        }

        // Removes cookies from browser with browser.cookies api, but not
        // removing them from context to correct process them in headers.
        // IMPORTANT: This method reads cookies from context, so it should be
        // called before method that change headers, since that method will
        // remove or change headers in context.
        this.applyRules(context)
            .catch((e) => {
                logger.error('[tsweb.CookieFiltering.onHeadersReceived]: cannot apply rules due to: ', e);
            });

        // Remove cookie headers.
        // This method won't work in the extension build with manifest v3.
        const headersModified = this.applyRulesToResponseCookieHeaders(context);

        return headersModified;
    }

    /**
     * TODO: Use isAppStarted with interval to re-request cookie rules if engine
     * is not started, as it implemented in CosmeticController.
     *
     * Looks up blocking rules for content-script.
     *
     * @param frameUrl Frame url.
     * @param tabId Tab id.
     * @param frameId Frame id.
     *
     * @returns List of blocking rules.
     */
    // eslint-disable-next-line class-methods-use-this
    public getBlockingRules(frameUrl: string, tabId: number, frameId: number): NetworkRule[] {
        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext?.info.url) {
            return [];
        }

        const matchQuery = createFrameMatchQuery(frameUrl, frameId, tabContext);

        const matchingResult = engineApi.matchRequest(matchQuery);

        if (!matchingResult) {
            return [];
        }

        const cookieRules = matchingResult.getCookieRules();

        return CookieRulesFinder.getBlockingRules(matchQuery.requestUrl, cookieRules);
    }

    /**
     * Applies rules.
     *
     * @param context Request context.
     */
    private async applyRules(context: RequestContext): Promise<void> {
        const {
            matchingResult, cookies, requestUrl, tabId,
        } = context;

        if (!matchingResult || !cookies) {
            return;
        }

        const cookieRules = matchingResult.getCookieRules();

        const promises = cookies.map(async (cookie) => {
            await this.applyRulesToCookie(cookie, cookieRules, requestUrl, tabId);
        });

        await Promise.all(promises);
    }

    /**
     * Attempts to find a "parent" cookie with a wider "path" field,
     * the scope of which includes the specified cookie from
     * the function parameters.
     *
     * This needs to prevent create of multiple "child"-cookies
     * and only modified expiration of general "parent"-cookie,
     * which covered "children"-cookies by 'path' value.
     *
     * @param cookie Cookie, for which need to find the "parent" cookie.
     *
     * @returns Item of parent cookie {@link ParsedCookie} or null if not found.
     */
    private async findParentCookie(cookie: ParsedCookie): Promise<ParsedCookie | null> {
        const pattern = {
            url: cookie.url,
            name: cookie.name,
            domain: cookie.domain,
            secure: cookie.secure,
        };

        const parentCookies = await this.browserCookieApi.findCookies(pattern);
        const sortedParentCookies = parentCookies.sort((a, b) => a.path.length - b.path.length);

        for (let i = 0; i < sortedParentCookies.length; i += 1) {
            const parentCookie = sortedParentCookies[i];

            if (cookie.path?.startsWith(parentCookie.path)) {
                return ParsedCookie.fromBrowserCookie(parentCookie, cookie.url);
            }
        }

        return null;
    }

    /**
     * Applies rules to cookie.
     *
     * @param cookie Cookie.
     * @param cookieRules Cookie rules.
     * @param requestUrl Request URL, needs to record filtering event.
     * @param tabId Tab id.
     */
    private async applyRulesToCookie(
        cookie: ParsedCookie,
        cookieRules: NetworkRule[],
        requestUrl: string,
        tabId: number,
    ): Promise<void> {
        const cookieName = cookie.name;
        const isThirdPartyCookie = cookie.thirdParty;

        const bRule = CookieRulesFinder.lookupNotModifyingRule(cookieName, cookieRules, isThirdPartyCookie);
        if (bRule) {
            if (bRule.isAllowlist() || await this.browserCookieApi.removeCookie(cookie.name, cookie.url)) {
                this.recordCookieEvent(tabId, cookie, requestUrl, bRule, false, isThirdPartyCookie);
            }

            return;
        }

        const mRules = CookieRulesFinder.lookupModifyingRules(cookieName, cookieRules, isThirdPartyCookie);
        if (mRules.length > 0) {
            // Try to find "parent" cookie and modify it instead of creating
            // "child copy" cookie.
            const parentCookie = await this.findParentCookie(cookie);
            const cookieToModify = parentCookie || cookie;

            const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookieToModify, mRules);
            if (appliedRules.length > 0) {
                if (await this.browserCookieApi.modifyCookie(cookieToModify)) {
                    appliedRules.forEach((r) => {
                        this.recordCookieEvent(tabId, cookieToModify, requestUrl, r, true, isThirdPartyCookie);
                    });
                }
            }
        }
    }

    /**
     * Modifies instance of {@link ParsedCookie} with provided rules.
     *
     * @param cookie Cookie modify.
     * @param rules Cookie matching rules.
     *
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

    /**
     * Records cookie event to filtering log.
     *
     * @param tabId Id of the tab.
     * @param cookie Item of {@link ParsedCookie}.
     * @param requestUrl URL of the request.
     * @param rule Applied modifying or deleting rule.
     * @param isModifyingCookieRule Is applied rule modifying or not.
     * @param requestThirdParty Whether request third party or not.
     */
    private recordCookieEvent(
        tabId: number,
        cookie: ParsedCookie,
        requestUrl: string,
        rule: NetworkRule,
        isModifyingCookieRule: boolean,
        requestThirdParty: boolean,
    ): void {
        this.filteringLog.publishEvent({
            type: FilteringEventType.Cookie,
            data: {
                eventId: nanoid(),
                tabId,
                cookieName: cookie.name,
                cookieValue: cookie.value,
                frameDomain: getDomain(requestUrl) || requestUrl,
                filterId: rule.getFilterListId(),
                ruleIndex: rule.getIndex(),
                isModifyingCookieRule,
                requestThirdParty,
                timestamp: Date.now(),
                requestType: ContentType.Cookie,
                isAllowlist: rule.isAllowlist(),
                isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                advancedModifier: rule.getAdvancedModifierValue(),
            },
        });
    }
}

export const cookieFiltering = new CookieFiltering(defaultFilteringLog);
