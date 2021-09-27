/**
 * This class applies cookie rules in page context
 *
 * - Removes cookies matching rules
 * - Listens to new cookies, then tries to apply rules to them
 */
export default class CookieController {
    /**
     * On rule applied callback
     */
    private readonly onRuleAppliedCallback: (cookieName: string,
        cookieDomain: string,
        cookieRuleText: string,
        thirdParty: boolean,
        filterId: number) => void;

    /**
     * Is current context third-party
     */
    private readonly isThirdPartyContext: boolean = false;

    /**
     * Constructor
     *
     * @param callback
     */
    constructor(callback: (cookieName: string,
        cookieDomain: string,
        cookieRuleText: string,
        thirdParty: boolean,
        filterId: number) => void) {
        this.onRuleAppliedCallback = callback;

        this.isThirdPartyContext = this.isThirdPartyFrame();
    }

    /**
     * Applies rules
     *
     * @param rules
     */
    public apply(
        rules: {
            ruleText: string;
            match: string;
            isThirdParty: boolean;
            filterId: number;
        }[],
    ): void {
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
     * Polling document cookie
     *
     * @param callback
     * @param interval
     */
    // eslint-disable-next-line class-methods-use-this
    private listenCookieChange(callback: (oldValue: string, newValue: string) => void, interval = 1000): void {
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
     * Checks if current context is third-party
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
     * Applies rules to document cookies
     * Inspired by remove-cookie scriptlet
     * https://github.com/AdguardTeam/Scriptlets/blob/master/src/scriptlets/remove-cookie.js
     *
     * @param rules
     */
    private applyRules(
        rules: {
            ruleText: string;
            match: string;
            isThirdParty: boolean;
            filterId: number;
        }[],
    ): void {
        document.cookie.split(';').forEach((cookieStr) => {
            const pos = cookieStr.indexOf('=');
            if (pos === -1) {
                return;
            }

            const cookieName = cookieStr.slice(0, pos).trim();
            rules.forEach((rule) => {
                this.applyRule(rule, cookieName);
            });
        });
    }

    /**
     * Applies rule
     *
     * @param rule
     * @param cookieName
     */
    private applyRule(
        rule: { ruleText: string; match: string; isThirdParty: boolean; filterId: number },
        cookieName: string,
    ): void {
        if (this.isThirdPartyContext !== rule.isThirdParty) {
            return;
        }

        const regex = rule.match ? CookieController.toRegExp(rule.match) : CookieController.toRegExp('/.?/');
        if (!regex.test(cookieName)) {
            return;
        }

        const hostParts = document.location.hostname.split('.');
        for (let i = 0; i <= hostParts.length - 1; i += 1) {
            const hostName = hostParts.slice(i).join('.');
            if (hostName) {
                CookieController.removeCookieFromHost(cookieName, hostName);
            }
        }

        this.onRuleAppliedCallback(
            cookieName,
            document.location.hostname,
            rule.ruleText,
            rule.isThirdParty,
            rule.filterId,
        );
    }

    /**
     * Removes cookie for host
     *
     * @param cookieName
     * @param hostName
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
     * Converts cookie rule match to regular expression
     *
     * @param str
     */
    private static toRegExp(str: string): RegExp {
        if (str[0] === '/' && str[str.length - 1] === '/') {
            return new RegExp(str.slice(1, -1));
        }
        const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${escaped}$`);
    }
}
