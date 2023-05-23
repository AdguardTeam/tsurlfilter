import {
    CLASSIC_DOMAIN_SEPARATOR,
    DOMAIN_EXCEPTION_MARKER,
    DOMAIN_LIST_TYPE,
    EMPTY,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { DomainList, DomainListSeparator, defaultLocation } from '../common';
import { locRange } from '../../utils/location';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';

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
     * @param raw Raw domain list
     * @param separator Separator character
     * @param loc Location of the domain list
     * @returns Domain list AST
     * @throws If the domain list is syntactically invalid
     */
    public static parse(
        raw: string,
        separator: DomainListSeparator = CLASSIC_DOMAIN_SEPARATOR,
        loc = defaultLocation,
    ): DomainList {
        const result: DomainList = {
            type: DOMAIN_LIST_TYPE,
            loc: locRange(loc, 0, raw.length),
            separator,
            children: [],
        };

        // If the last character is a separator, then the domain list is invalid
        // and no need to continue parsing
        const realEndIndex = StringUtils.skipWSBack(raw);

        if (raw[realEndIndex] === separator) {
            throw new AdblockSyntaxError(
                'Domain list cannot end with a separator',
                locRange(loc, realEndIndex, realEndIndex + 1),
            );
        }

        let offset = 0;

        // Skip whitespace before the domain list
        offset = StringUtils.skipWS(raw, offset);

        // Split domains by unescaped separators
        while (offset < raw.length) {
            // Skip whitespace before the domain
            offset = StringUtils.skipWS(raw, offset);

            let domainStart = offset;

            // Find the index of the first unescaped separator character
            const separatorStartIndex = StringUtils.findNextUnescapedCharacter(raw, separator, offset);

            const domainEnd = separatorStartIndex === -1
                ? StringUtils.skipWSBack(raw) + 1
                : StringUtils.skipWSBack(raw, separatorStartIndex - 1) + 1;

            const exception = raw[domainStart] === DOMAIN_EXCEPTION_MARKER;

            // Skip the exception marker
            if (exception) {
                domainStart += 1;

                // Exception marker cannot be followed by another exception marker
                if (raw[domainStart] === DOMAIN_EXCEPTION_MARKER) {
                    throw new AdblockSyntaxError(
                        'Exception marker cannot be followed by another exception marker',
                        locRange(loc, domainStart, domainStart + 1),
                    );
                }

                // Exception marker cannot be followed by a separator
                if (raw[domainStart] === separator) {
                    throw new AdblockSyntaxError(
                        'Exception marker cannot be followed by a separator',
                        locRange(loc, domainStart, domainStart + 1),
                    );
                }

                // Exception marker cannot be followed by whitespace
                if (StringUtils.isWhitespace(raw[domainStart])) {
                    throw new AdblockSyntaxError(
                        'Exception marker cannot be followed by whitespace',
                        locRange(loc, domainStart, domainStart + 1),
                    );
                }
            }

            // Domain can't be empty
            if (domainStart === domainEnd) {
                throw new AdblockSyntaxError(
                    'Empty domain specified',
                    locRange(loc, domainStart, raw.length),
                );
            }

            // Add the domain to the result
            result.children.push({
                type: 'Domain',
                loc: locRange(loc, domainStart, domainEnd),
                value: raw.substring(domainStart, domainEnd),
                exception,
            });

            // Increment the offset to the next domain (or the end of the string)
            offset = separatorStartIndex === -1 ? raw.length : separatorStartIndex + 1;
        }

        return result;
    }

    /**
     * Converts a domain list AST to a string.
     *
     * @param ast Domain list AST
     * @returns Raw string
     */
    public static generate(ast: DomainList): string {
        const result = ast.children
            .map(({ value, exception }) => {
                let subresult = EMPTY;

                if (exception) {
                    subresult += DOMAIN_EXCEPTION_MARKER;
                }

                subresult += value.trim();

                return subresult;
            })
            .join(ast.separator);

        return result;
    }
}
