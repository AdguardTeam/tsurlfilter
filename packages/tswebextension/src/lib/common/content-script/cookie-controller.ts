import { type GetSaveCookieLogEventPayloadValidator } from '../message';

/**
 * Data which will be passed to filtering log,
 * contains information about applied cookie rules.
 */
export type OnRuleAppliedData = GetSaveCookieLogEventPayloadValidator;

interface OnRuleAppliedCallback {
    (data: OnRuleAppliedData): void;
}

export interface CookieRule {
    match: string | null;
    isThirdParty: boolean;
    filterId: number;
    ruleIndex: number;
    isAllowlist: boolean;
    isImportant: boolean;
    isDocumentLevel: boolean;
    advancedModifier: string | null;
}

/**
 * Represents cookie rule.
 */
export interface CookieRule {
    /**
     * Matcher string, the value of the $cookie modifier,
     * or null if the modifier does not have a value.
     */
    match: string | null;

    /**
     * Whether the rule is for third-party context.
     */
    isThirdParty: boolean;

    /**
     * Filter ID rule belongs to.
     */
    filterId: number;

    /**
     * Rule start index in the byte buffer.
     */
    ruleIndex: number;

    /**
     * Whether the rule is exception.
     */
    isAllowlist: boolean;

    /**
     * Whether the rule is important.
     */
    isImportant: boolean;

    /**
     * Whether the rule is document level.
     */
    isDocumentLevel: boolean;

    /**
     * Advanced modifier value, if present.
     */
    advancedModifier: string | null;
}

/**
 * This class applies cookie rules in page context.
 *
 * - Removes cookies matching rules
 * - Listens to new cookies, then tries to apply rules to them.
 */
export class CookieController {
    /**
     * Default cookie polling interval.
     */
    DEFAULT_COOKIE_POLLING_INTERVAL_MS = 1000;

    /**
     * On rule applied callback.
     */
    private readonly onRuleAppliedCallback: OnRuleAppliedCallback;

    /**
     * Is current context third-party.
     */
    private readonly isThirdPartyContext: boolean = false;

    /**
     * Constructor.
     *
     * @param callback On rule applied callback.
     */
    constructor(callback: OnRuleAppliedCallback) {
        this.onRuleAppliedCallback = callback;

        this.isThirdPartyContext = this.isThirdPartyFrame();
    }

    /**
     * Applies rules.
     *
     * @param rules Rules to apply.
     */
    public apply(rules: CookieRule[]): void {
        this.applyRules(rules);

        let lastCookie = document.cookie;
        this.listenCookieChange((oldValue, newValue) => {
            if (newValue === lastCookie) {
                // Skip changes made by this class
                return;
            }

            this.applyRules(rules);

            lastCookie = document.cookie;
        });

        window.addEventListener('beforeunload', () => {
            this.applyRules(rules);
        });
    }

    /**
     * Polling document cookie.
     *
     * @param callback Callback to be called periodically.
     * @param interval Polling interval.
     */
    private listenCookieChange(
        callback: (oldValue: string, newValue: string) => void,
        interval = this.DEFAULT_COOKIE_POLLING_INTERVAL_MS,
    ): void {
        let lastCookie = document.cookie;

        setInterval(() => {
            const { cookie } = document;
            if (cookie !== lastCookie) {
                try {
                    callback(lastCookie, cookie);
                } finally {
                    lastCookie = cookie;
                }
            }
        }, interval);
    }

    /**
     * Checks if current context is third-party.
     *
     * @returns True if current context is third-party.
     */
    // eslint-disable-next-line class-methods-use-this
    private isThirdPartyFrame(): boolean {
        try {
            return window.self !== window.top && document.location.hostname !== window.parent.location.hostname;
        } catch (e) {
            return true;
        }
    }

    /**
     * Applies rules to document cookies.
     *
     * Inspired by remove-cookie scriptlet.
     *
     * @see {@link https://github.com/AdguardTeam/Scriptlets/blob/master/src/scriptlets/remove-cookie.js}
     *
     * @param rules Rules to apply.
     */
    private applyRules(
        rules: CookieRule[],
    ): void {
        document.cookie.split(';').forEach((cookieStr) => {
            const pos = cookieStr.indexOf('=');
            if (pos === -1) {
                return;
            }

            const cookieName = cookieStr.slice(0, pos).trim();
            const cookieValue = cookieStr.slice(pos + 1).trim();

            const matchingRules = rules.filter((r) => {
                if (this.isThirdPartyContext !== r.isThirdParty) {
                    return false;
                }

                const regex = r.match ? CookieController.toRegExp(r.match) : CookieController.toRegExp('/.?/');
                return regex.test(cookieName);
            });

            const importantRules = matchingRules.filter((r) => r.isImportant);
            if (importantRules.length > 0) {
                importantRules.forEach((rule) => {
                    this.applyRule(rule, cookieName, cookieValue);
                });
            } else {
                const allowlistRules = matchingRules.filter((r) => r.isAllowlist);
                if (allowlistRules.length > 0) {
                    allowlistRules.forEach((rule) => {
                        this.applyRule(rule, cookieName, cookieValue);
                    });
                } else {
                    matchingRules.forEach((rule) => {
                        this.applyRule(rule, cookieName, cookieValue);
                    });
                }
            }
        });
    }

    /**
     * Applies rule.
     *
     * @param rule Rule to apply.
     * @param cookieName Cookie name.
     * @param cookieValue Cookie value.
     */
    private applyRule(
        rule: CookieRule,
        cookieName: string,
        cookieValue: string,
    ): void {
        if (!rule.isAllowlist) {
            const hostParts = document.location.hostname.split('.');
            for (let i = 0; i <= hostParts.length - 1; i += 1) {
                const hostName = hostParts.slice(i).join('.');
                if (hostName) {
                    CookieController.removeCookieFromHost(cookieName, hostName);
                }
            }
        }

        this.onRuleAppliedCallback({
            cookieName,
            cookieValue,
            cookieDomain: document.location.hostname,
            thirdParty: rule.isThirdParty,
            filterId: rule.filterId,
            ruleIndex: rule.ruleIndex,
            isAllowlist: rule.isAllowlist,
            isImportant: rule.isImportant,
            isDocumentLevel: rule.isDocumentLevel,
            isCsp: false,
            isCookie: true,
            advancedModifier: null,
        });
    }

    /**
     * Removes cookie for host.
     *
     * @param cookieName Cookie name.
     * @param hostName Host name.
     */
    private static removeCookieFromHost(cookieName: string, hostName: string): void {
        const cookieSpec = `${cookieName}=`;
        const domain1 = `; domain=${hostName}`;
        const domain2 = `; domain=.${hostName}`;
        const path = '; path=/';
        const expiration = '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = cookieSpec + expiration;
        document.cookie = cookieSpec + domain1 + expiration;
        document.cookie = cookieSpec + domain2 + expiration;
        document.cookie = cookieSpec + path + expiration;
        document.cookie = cookieSpec + domain1 + path + expiration;
        document.cookie = cookieSpec + domain2 + path + expiration;
    }

    /**
     * Converts cookie rule match to regular expression.
     *
     * @param str String to convert.
     *
     * @returns Regular expression.
     */
    private static toRegExp(str: string): RegExp {
        if (str[0] === '/' && str[str.length - 1] === '/') {
            return new RegExp(str.slice(1, -1));
        }
        const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${escaped}$`);
    }
}
