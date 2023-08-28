import { COMMA_DOMAIN_LIST_SEPARATOR, NEGATION_MARKER, EMPTY } from '../../utils/constants';
import { locRange } from '../../utils/location';
import {
    type Domain,
    type DomainList,
    type DomainListSeparator,
    defaultLocation,
    ListNodeType,
    ListItemNodeType,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { parseListItems } from './list-helpers';

/**
 * `DomainListParser` is responsible for parsing a domain list.
 *
 * @example
 * - If the rule is `example.com,~example.net##.ads`, the domain list is `example.com,~example.net`.
 * - If the rule is `ads.js^$script,domains=example.com|~example.org`, the domain list is `example.com|~example.org`.
 * This parser is responsible for parsing these domain lists.
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide_domains}
 */
export class DomainListParser {
    /**
     * Parses a domain list, eg. `example.com,example.org,~example.org`
     *
     * @param raw Raw domain list.
     * @param separator Separator character.
     * @param loc Location of the domain list in the rule. If not set, the default location is used.
     *
     * @returns Domain list AST.
     * @throws An {@link AdblockSyntaxError} if the domain list is syntactically invalid.
     */
    public static parse(
        raw: string,
        separator: DomainListSeparator = COMMA_DOMAIN_LIST_SEPARATOR,
        loc = defaultLocation,
    ): DomainList {
        const rawItems = parseListItems(raw, separator, loc);
        const children: Domain[] = rawItems.map((rawListItem) => ({
            ...rawListItem,
            type: ListItemNodeType.Domain,
        }));

        return {
            type: ListNodeType.DomainList,
            loc: locRange(loc, 0, raw.length),
            separator,
            children,
        };
    }

    /**
     * Converts a domain list AST to a string.
     *
     * @param ast Domain list AST.
     *
     * @returns Raw string.
     */
    public static generate(ast: DomainList): string {
        const result = ast.children
            .map(({ value, exception }) => {
                let subresult = EMPTY;

                if (exception) {
                    subresult += NEGATION_MARKER;
                }

                subresult += value.trim();

                return subresult;
            })
            .join(ast.separator);

        return result;
    }
}
