import { IAdvancedModifier } from './advanced-modifier';

/**
 * Cookie modifier class
 *
 * Learn more about it here:
 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/961
 */
export class CookieModifier implements IAdvancedModifier {
    /**
     * Cookie name maxAge
     */
    private static MAX_AGE = 'maxAge';

    /**
     * Cookie name sameSite
     */
    private static SAME_SITE = 'sameSite';

    /**
     * Option value
     */
    private readonly optionValue: string;

    /**
     * Regexp value
     */
    private readonly regex: RegExp | null;

    /**
     * Cookie name
     */
    private readonly cookieName: string | null;

    /**
     * Cookie sameSite value
     */
    private readonly sameSite: string | null;

    /**
     * Cookie maxAge value
     */
    private readonly maxAge: number | null;

    /**
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        // Save the source text of the option modifier
        this.optionValue = value || '';

        this.regex = null;
        this.cookieName = null;
        this.sameSite = null;
        this.maxAge = null;

        // Parse cookie name/regex
        const parts = this.optionValue.split(/;/);
        if (parts.length < 1) {
            throw new Error(`Cannot parse ${this.optionValue}`);
        }

        const cookieName = parts[0];
        if (cookieName.startsWith('/') && cookieName.endsWith('/')) {
            const pattern = cookieName.substring(1, cookieName.length - 1);

            // Save regex to be used further for matching cookies
            this.regex = new RegExp(pattern);
        } else {
            // Match by cookie name
            this.cookieName = cookieName;
        }

        // Parse other cookie options
        if (parts.length > 1) {
            for (let i = 1; i < parts.length; i += 1) {
                const nameValue = parts[i].split('=');
                const optionName = nameValue[0];
                const optionValue = nameValue[1];

                if (optionName === CookieModifier.MAX_AGE) {
                    this.maxAge = parseInt(optionValue, 10);
                } else if (optionName === CookieModifier.SAME_SITE) {
                    this.sameSite = optionValue;
                } else {
                    throw new Error(`Unknown $cookie option: ${optionName}`);
                }
            }
        }
    }

    /**
     * Modifier value
     */
    getValue(): string {
        return this.optionValue;
    }

    /**
     * First cookie name
     */
    getCookieName(): string | null {
        return this.cookieName;
    }

    /**
     * Max age cookie value
     */
    getMaxAge(): number | null {
        return this.maxAge;
    }

    /**
     * Same site cookie value
     */
    getSameSite(): string | null {
        return this.sameSite;
    }

    /**
     * Checks if cookie with the specified name matches this option
     *
     * @param {string} name Cookie name
     * @return {boolean} true if it does
     */
    matches(name: string | null): boolean {
        if (!name) {
            return false;
        }

        if (this.regex) {
            return this.regex.test(name);
        } if (this.cookieName) {
            return this.cookieName === name;
        }

        // Empty regex and cookieName means that we must match all cookies
        return true;
    }

    /**
     * Checks if cookie rule has an empty $cookie option
     *
     * @return {boolean} True if $cookie option is empty
     */
    isEmpty(): boolean {
        return !this.regex && !this.cookieName;
    }
}
