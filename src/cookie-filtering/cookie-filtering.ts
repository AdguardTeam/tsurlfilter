import { Cookies, WebRequest } from 'webextension-polyfill-ts';
import { NetworkRule } from '../rules/network-rule';
import { FilteringLog } from '../filtering-log';
import CookieEngine from './cookie-engine';
import ParsedCookie from './parsed-cookie';
import CookieUtils from './utils';
import { BrowserCookieApi, IBrowserCookieApi } from './browser-cookie/browser-cookie-api';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { RequestType } from '../request';
import OnBeforeRequestDetailsType = WebRequest.OnBeforeRequestDetailsType;
import OnBeforeSendHeadersDetailsType = WebRequest.OnBeforeSendHeadersDetailsType;
import OnHeadersReceivedDetailsType = WebRequest.OnHeadersReceivedDetailsType;
import OnCompletedDetailsType = WebRequest.OnCompletedDetailsType;
import OnErrorOccurredDetailsType = WebRequest.OnErrorOccurredDetailsType;
import Cookie = Cookies.Cookie;

/**
 * Cookie filtering
 *
 * The following public methods should be set as suitable webrequest events listeners,
 * check sample extension in this repo for an example
 *
 * Logic introduction:
 *
 * onBeforeRequest:
 * - get $cookie rules for current url
 *
 * onBeforeSendHeaders:
 * - get all cookies for request url
 * - store cookies (first-party)
 *
 * onHeadersReceived:
 * - parse set-cookie header, only to detect if the cookie in header will be set from third-party request
 * - save third-party flag for this cookie cookie.thirdParty=request.thirdParty
 * - apply rules
 *
 * onCompleted/onErrorOccurred:
 * - delete request context from the storage
 *
 * onCompleted
 * - apply rules via content script
 * In content-scripts:
 * - TODO: describe content-scripts logic
 * - get matching cookie rules
 * - apply
 */
export class CookieFiltering {
    private cookieEngine: CookieEngine;

    private filteringLog: FilteringLog;

    private browserCookieApi: IBrowserCookieApi = new BrowserCookieApi();

    private requestContextStorage = new Map<string, {
        rules: NetworkRule[];
        cookies: ParsedCookie[];
        url: string;
        tabId: number;
    }>();

    /**
     * Constructor
     *
     * @param rules
     * @param filteringLog
     */
    constructor(rules: NetworkRule[], filteringLog: FilteringLog) {
        this.cookieEngine = new CookieEngine(rules);
        this.filteringLog = filteringLog;
    }

    /**
     * Finds rules for request and saves it to context storage
     * @param details
     */
    public onBeforeRequest(details: OnBeforeRequestDetailsType): void {
        const rules = this.cookieEngine.getRules(details.url);
        this.requestContextStorage.set(details.requestId,
            {
                rules,
                cookies: [],
                url: details.url,
                tabId: details.tabId,
            });
    }

    /**
     * Parses cookies from headers
     * @param details
     */
    public onBeforeSendHeaders(details: OnBeforeSendHeadersDetailsType): void {
        const context = this.requestContextStorage.get(details.requestId);
        if (!context) {
            return;
        }

        if (!details.requestHeaders) {
            return;
        }

        const cookieHeader = CookieUtils.findHeaderByName(details.requestHeaders, 'Cookie');
        if (!cookieHeader || !cookieHeader.value) {
            return;
        }

        const cookies = CookieUtils.parseCookies(cookieHeader.value!);
        if (cookies.length === 0) {
            return;
        }

        context.cookies = cookies;
    }

    /**
     * Parses set-cookie header
     * looks up third-party cookies
     *
     * @param details
     */
    public async onHeadersReceived(details: OnHeadersReceivedDetailsType): Promise<void> {
        const context = this.requestContextStorage.get(details.requestId);
        if (!context) {
            return;
        }

        if (!details.responseHeaders) {
            return;
        }

        const cookies = CookieUtils.parseSetCookieHeaders(details.responseHeaders);
        const newCookies = cookies.filter((c) => !context.cookies.includes(c));
        for (const cookie of newCookies) {
            cookie.thirdParty = details.thirdParty;
        }

        context.cookies.push(...newCookies);

        await this.applyRules(details.requestId);
    }

    public onCompleted(details: OnCompletedDetailsType): void {
        this.requestContextStorage.delete(details.requestId);
    }

    public onErrorOccurred(details: OnErrorOccurredDetailsType): void {
        this.requestContextStorage.delete(details.requestId);
    }

    /**
     * Applies rules
     * @param requestId
     */
    private async applyRules(requestId: string): Promise<void> {
        const context = this.requestContextStorage.get(requestId);
        if (!context) {
            return;
        }

        const { rules, cookies } = context;
        if (!rules || !cookies) {
            return;
        }

        const promises = cookies.map(async (cookie) => {
            // TODO: extend ParsedCookie from Cookies.Cookie
            const converted = {};
            await this.applyRulesToCookie(context.url, converted, cookie.thirdParty, rules, context.tabId);
        });

        await Promise.all(promises);
    }

    /**
     * Applies rules to cookie
     *
     * @param url
     * @param cookie
     * @param isThirdPartyCookie
     * @param cookieRules
     * @param tabId
     */
    private async applyRulesToCookie(
        url: string,
        cookie: Cookie,
        isThirdPartyCookie: boolean,
        cookieRules: NetworkRule[],
        tabId: number,
    ): Promise<void> {
        const cookieName = cookie.name;

        const bRule = CookieEngine.lookupNotModifyingRule(cookieName, cookieRules, isThirdPartyCookie);
        if (bRule) {
            await this.browserCookieApi.removeCookie(cookie.name, url);
            this.filteringLog.addCookieEvent(
                tabId,
                cookie.name,
                cookie.value,
                cookie.domain,
                RequestType.Document, // TODO: Find request type
                bRule,
                false,
                isThirdPartyCookie,
            );

            return;
        }

        const mRules = CookieEngine.lookupModifyingRules(cookieName, cookieRules, isThirdPartyCookie);
        if (mRules.length > 0) {
            const appliedRules = CookieFiltering.applyRuleToBrowserCookie(cookie, mRules);
            if (appliedRules.length > 0) {
                await this.browserCookieApi.modifyCookie(cookie, url);
                // TODO: Fill params
                // this.filteringLog.addCookieEvent(tabId, cookie.name, appliedRules);
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
    private static applyRuleToBrowserCookie(cookie: Cookie, rules: NetworkRule[]): NetworkRule[] {
        const appliedRules = [];

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            const cookieModifier = rule.getAdvancedModifier() as CookieModifier;

            let modified = false;

            // eslint-disable-next-line prefer-destructuring
            const sameSite = cookieModifier.getSameSite();
            if (sameSite && cookie.sameSite !== sameSite) {
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
