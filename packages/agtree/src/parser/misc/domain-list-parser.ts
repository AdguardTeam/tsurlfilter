import { COMMA, PIPE } from '../../utils/constants';
import { type DomainList, ListNodeType, ListItemNodeType } from '../../nodes';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../base-parser';
import { ListItemsParser } from './list-items-parser';

/**
 * `DomainListParser` is responsible for parsing a domain list.
 *
 * @example
 * - If the rule is `example.com,~example.net##.ads`, the domain list is `example.com,~example.net`.
 * - If the rule is `ads.js^$script,domains=example.com|~example.org`, the domain list is `example.com|~example.org`.
 * This parser is responsible for parsing these domain lists.
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide_domains}
 */
export class DomainListParser extends BaseParser {
    /**
     * Parses a domain list, eg. `example.com,example.org,~example.org`
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @param separator Separator character (default: comma)
     *
     * @returns Domain list AST.
     * @throws An {@link AdblockSyntaxError} if the domain list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0, separator = COMMA): DomainList {
        if (separator !== COMMA && separator !== PIPE) {
            throw new Error(`Invalid separator: ${separator}`);
        }

        const result: DomainList = {
            type: ListNodeType.DomainList,
            separator,
            children: ListItemsParser.parse(raw, options, baseOffset, separator, ListItemNodeType.Domain),
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }
}
