import { IValueListModifier } from './value-list-modifier';

/**
 * To modifier class.
 * Rules with $to modifier are limited to requests made to the specified domains and their subdomains.
 *
 * Learn more about it here:
 * https://adguard.com/kb/general/ad-filtering/create-own-filters/#to-modifier
 */
export class ToModifier implements IValueListModifier<string> {
    /**
     * Domains separator
     */
    private static PIPE_SEPARATOR = '|';

    /**
     * List of permitted domains or null.
     */
    readonly permittedValues: string[] | null;

    /**
     * List of restricted domains or null.
     */
    readonly restrictedValues: string[] | null;

    /**
     * Constructor
     */
    constructor(domainsStr: string) {
        if (!domainsStr) {
            throw new SyntaxError('$to modifier value cannot be empty');
        }

        const permittedDomains: string[] = [];
        const restrictedDomains: string[] = [];

        const parts = domainsStr.toLowerCase().split(ToModifier.PIPE_SEPARATOR);
        for (let i = 0; i < parts.length; i += 1) {
            let domain = parts[i].trim();
            let restricted = false;
            if (domain.startsWith('~')) {
                restricted = true;
                domain = domain.substring(1);
            }

            if (domain === '') {
                throw new SyntaxError(`Empty domain specified in "${domainsStr}"`);
            }

            if (restricted) {
                restrictedDomains.push(domain);
            } else {
                permittedDomains.push(domain);
            }
        }

        this.restrictedValues = restrictedDomains.length > 0 ? restrictedDomains : null;
        this.permittedValues = permittedDomains.length > 0 ? permittedDomains : null;
    }
}
