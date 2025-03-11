import {
    DomainListParser,
    PIPE_MODIFIER_SEPARATOR,
    type DomainList,
    type ModifierValue,
} from '@adguard/agtree';
import { defaultParserOptions } from '@adguard/agtree/parser';
import { ListItemsGenerator } from '@adguard/agtree/generator';
import { type IValueListModifier } from './value-list-modifier';
import { isString } from '../utils/string-utils';

/**
 * `$to` modifier class.
 * Rules with $to modifier are limited to requests made to the specified domains and their subdomains.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#to-modifier}
 */
export class ToModifier implements IValueListModifier<string> {
    /**
     * List of permitted domains or null.
     */
    readonly permittedValues: string[] | null;

    /**
     * List of restricted domains or null.
     */
    readonly restrictedValues: string[] | null;

    private static getDomainListNode = (domains: string | ModifierValue): DomainList => {
        if (isString(domains)) {
            if (!domains) {
                throw new Error('Domain list cannot be empty');
            }

            return DomainListParser.parse(domains, defaultParserOptions, 0, PIPE_MODIFIER_SEPARATOR);
        }

        if (domains.type !== 'DomainList') {
            throw new Error('Unsupported modifier value type');
        }

        if (domains.children.length === 0) {
            throw new Error('Domain list cannot be empty');
        }

        return domains;
    };

    /**
     * Constructor.
     *
     * @param domains String with domains separated by `|`.
     */
    constructor(domains: string | ModifierValue) {
        const domainListNode = ToModifier.getDomainListNode(domains);

        const permittedDomains: string[] = [];
        const restrictedDomains: string[] = [];

        domainListNode.children.forEach((domain) => {
            const domainStr = domain.value;

            if (domainStr === '') {
                // eslint-disable-next-line max-len
                throw new SyntaxError(`Empty domain specified in "${ListItemsGenerator.generate(domainListNode.children, PIPE_MODIFIER_SEPARATOR)}"`);
            }

            if (domain.exception) {
                restrictedDomains.push(domainStr);
            } else {
                permittedDomains.push(domainStr);
            }
        });

        this.restrictedValues = restrictedDomains.length > 0 ? restrictedDomains : null;
        this.permittedValues = permittedDomains.length > 0 ? permittedDomains : null;
    }
}
