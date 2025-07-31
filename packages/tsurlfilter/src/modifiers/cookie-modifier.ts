import { type IAdvancedModifier } from './advanced-modifier';

/**
 * Cookie modifier class.
 *
 * Learn more about it here:
 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/961.
 */
export class CookieModifier implements IAdvancedModifier {
    /**
     * Cookie `maxAge` name.
     */
    private static MAX_AGE = 'maxAge';

    /**
     * Cookie `sameSite` name.
     */
    private static SAME_SITE = 'sameSite';

    /**
     * Option value.
     */
    private readonly optionValue: string;

    /**
     * Regexp value.
     */
    private readonly regex: RegExp | null;

    /**
     * Cookie name.
     */
    private readonly cookieName: string | null;

    /**
     * Cookie `sameSite` value.
     */
    private readonly sameSite: string | null;

    /**
     * Cookie `maxAge` value.
     */
    private readonly maxAge: number | null;

    /**
     * Constructor.
     *
     * @param value Value of the modifier.
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
     * Gets modifier value.
     *
     * @returns Modifier value.
     */
    public getValue(): string {
        return this.optionValue;
    }

    /**
     * First cookie name.
     *
     * @returns The first cookie name.
     */
    public getCookieName(): string | null {
        return this.cookieName;
    }

    /**
     * Max age cookie value.
     *
     * @returns The max age cookie value.
     */
    public getMaxAge(): number | null {
        return this.maxAge;
    }

    /**
     * Same site cookie value.
     *
     * @returns The same site cookie value.
     */
    public getSameSite(): string | null {
        return this.sameSite;
    }

    /**
     * Checks if cookie with the specified name matches this option.
     *
     * @param name Cookie name.
     *
     * @returns True if matches, false otherwise.
     */
    public matches(name: string | null): boolean {
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
     * Checks if cookie rule has an empty $cookie option.
     *
     * @returns True if $cookie option is empty.
     */
    public isEmpty(): boolean {
        return !this.regex && !this.cookieName;
    }

    /**
     * Checks if the given modifier is an instance of CookieModifier.
     *
     * @param m The modifier to check.
     *
     * @returns True if the modifier is an instance of CookieModifier, false otherwise.
     */
    public static isCookieModifier = (m: IAdvancedModifier): m is CookieModifier => {
        return m instanceof CookieModifier;
    };
}
