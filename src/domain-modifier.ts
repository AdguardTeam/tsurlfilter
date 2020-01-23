/**
 * This is a helper class that is used specifically to work
 * with domains restrictions.
 *
 * There are two options how you can add a domain restriction:
 * * `$domain` modifier: https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#domain-modifier
 * * domains list for the cosmetic rules
 *
 * The only difference between them is that in one case we use `|` as a separator,
 * and in the other case - `,`.
 *
 * Examples:
 * * `||example.org^$domain=example.com|~sub.example.com` -- network rule
 * * `example.com,~sub.example.com##banner` -- cosmetic rule
 */
export class DomainModifier {
    /** list of permitted domains or null */
    public readonly permittedDomains: string[] | null;

    /** list of restricted domains or null */
    public readonly restrictedDomains: string[] | null;

    /**
     * Parses the `domains` string and initializes the object.
     *
     * @param domains - domains string
     * @param sep - separator (`,` or `|`)
     *
     * @throws an error if the domains string is empty or invalid
     */
    constructor(domains: string, sep: string) {
        if (!domains) {
            throw new SyntaxError('domains cannot be empty');
        }

        const permittedDomains: string[] = [];
        const restrictedDomains: string[] = [];

        const parts = domains.split(sep);
        for (let i = 0; i < parts.length; i += 1) {
            let domain = parts[i];
            let restricted = false;
            if (domain.startsWith('~')) {
                restricted = true;
                domain = domain.substring(1).trim();
            }

            if (domain === '') {
                throw new SyntaxError(`empty domain specified in "${domains}"`);
            }

            if (restricted) {
                restrictedDomains.push(domain);
            } else {
                permittedDomains.push(domain);
            }
        }

        this.restrictedDomains = restrictedDomains.length > 0 ? restrictedDomains : null;
        this.permittedDomains = permittedDomains.length > 0 ? permittedDomains : null;
    }

    /**
     * isDomainOrSubdomainOfAny checks if `domain` is the same or a subdomain
     * of any of `domains`.
     *
     * @param domain - domain to check
     * @param domains - domains list to check against
     */
    static isDomainOrSubdomainOfAny(domain: string, domains: string[]): boolean {
        for (let i = 0; i < domains.length; i += 1) {
            const d = domains[i];
            if (domain === d || (domain.endsWith(d) && domain.endsWith(`.${d}`))) {
                return true;
            }
        }

        return false;
    }
}
