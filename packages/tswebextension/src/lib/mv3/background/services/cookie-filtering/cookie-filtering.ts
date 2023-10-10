import { NetworkRule, CookieModifier } from '@adguard/tsurlfilter';
import { ParsedCookie } from '../../../../common/cookie-filtering/parsed-cookie';
import { logger } from '../../../../common';
import { BrowserCookieApi } from '../../../../common/cookie-filtering/browser-cookie-api';
import { findHeaderByName } from '../../../../common/utils/find-header-by-name';
import CookieRulesFinder from '../../../../common/cookie-filtering/cookie-rules-finder';
import { CookieUtils } from '../../../../common/cookie-filtering/utils';
import { RequestContext, requestContextStorage } from '../../request';

/**
 * Cookie filtering.
 *
 * The following public methods should be set as suitable webrequest events listeners, check sample extension in this
 * repo for an example.
 *
 * Logic introduction:
 *  CookieFiltering.onBeforeSendHeaders:
 *  - get all cookies for request url;
 *  - store cookies (first-party);
 *  - apply rules via modifying or removing them with browser.cookies api;
 *
 *  CookieFiltering.onHeadersReceived:
 *  - parse set-cookie header, only to detect if the cookie in header will be set from third-party request;
 *  - save third-party flag for this cookie cookie.thirdParty=request.thirdParty;
 *  - apply rules via modifying or removing them with browser.cookies api;
 *
 *  CookieFiltering.onCompleted:
 *  - apply rules via content script.
 *
 *  In content-scripts (check /src/content-script/cookie-controller.ts):
 *  - apply matched cookie rules.
 */
export class CookieFiltering {
    private browserCookieApi: BrowserCookieApi = new BrowserCookieApi();

    /**
     * Parses cookies from request headers and applies matched rules
     * via browser.cookies api.
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

        // Saves cookies to context
        requestContextStorage.update(requestId, { cookies });

        // Removes cookies from browser with browser.cookies api, but not
        // removing them from context to correct process them in headers.
        this.applyRules(context)
            .catch((e) => {
                logger.error((e as Error).message);
            });
    }

    /**
     * Parses set-cookie header from response, looks up third-party cookies
     * and applies matched rules via browser.cookies api.
     *
     * @param context Request context.
     */
    public onHeadersReceived(context: RequestContext): void {
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
        this.applyRules(context)
            .catch((e) => {
                logger.error((e as Error).message);
            });
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
     *
     * TODO: Implement.
     */
    // eslint-disable-next-line class-methods-use-this
    private recordCookieEvent(
        /* eslint-disable @typescript-eslint/no-unused-vars */
        tabId: number,
        cookie: ParsedCookie,
        requestUrl: string,
        rule: NetworkRule,
        isModifyingCookieRule: boolean,
        requestThirdParty: boolean,
        /* eslint-enable @typescript-eslint/no-unused-vars */
    ): void { }
}

export const cookieFiltering = new CookieFiltering();
