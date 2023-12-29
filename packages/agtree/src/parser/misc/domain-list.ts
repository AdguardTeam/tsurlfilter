import {
    COMMA,
    NEGATION_MARKER,
    EMPTY,
    PIPE,
} from '../../utils/constants';
import { locRange } from '../../utils/location';
import {
    type Domain,
    type DomainList,
    ListNodeType,
    ListItemNodeType,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { type ListParserOptions, parseListItems } from './list-helpers';
import { getParserOptions } from '../options';

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
     * @param options Domain list parser options. See {@link ListParserOptions}.
     *
     * @returns Domain list AST.
     * @throws An {@link AdblockSyntaxError} if the domain list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options: Partial<ListParserOptions> = {}): DomainList {
        const separator = options.separator ?? COMMA;

        if (separator !== COMMA && separator !== PIPE) {
            throw new Error(`Invalid separator: ${separator}`);
        }

        const { baseLoc, isLocIncluded } = getParserOptions(options);

        const rawItems = parseListItems(raw, { separator, baseLoc, isLocIncluded });
        const children: Domain[] = rawItems.map((rawListItem) => ({
            ...rawListItem,
            type: ListItemNodeType.Domain,
        }));

        const result: DomainList = {
            type: ListNodeType.DomainList,
            separator,
            children,
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, 0, raw.length);
        }

        return result;
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
