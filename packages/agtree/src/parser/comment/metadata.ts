/**
 * @file Metadata comments
 */

import { StringUtils } from '../../utils/string';
import { METADATA_HEADERS } from '../../converter/metadata';
import { AdblockSyntax } from '../../utils/adblockers';
import { COLON, EMPTY, SPACE } from '../../utils/constants';
import {
    CommentMarker,
    CommentRuleType,
    Location,
    MetadataCommentRule,
    RuleCategory,
    Value,
    defaultLocation,
} from '../common';
import { locRange } from '../../utils/location';

/**
 * `MetadataParser` is responsible for parsing metadata comments.
 * Metadata comments are special comments that specify some properties of the list.
 *
 * @example
 * For example, in the case of
 * ```adblock
 * ! Title: My List
 * ```
 * the name of the header is `Title`, and the value is `My List`, which means that
 * the list title is `My List`, and it can be used in the adblocker UI.
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#special-comments}
 */
export class MetadataCommentRuleParser {
    /**
     * Parses a raw rule as a metadata comment.
     *
     * @param raw Raw rule
     * @param loc Base location
     * @returns Metadata comment AST or null (if the raw rule cannot be parsed as a metadata comment)
     */
    public static parse(raw: string, loc: Location = defaultLocation): MetadataCommentRule | null {
        // Fast check to avoid unnecessary work
        if (raw.indexOf(COLON) === -1) {
            return null;
        }

        let offset = 0;

        // Skip leading spaces before the comment marker
        offset = StringUtils.skipWS(raw, offset);

        // Check if the rule starts with a comment marker (first non-space sequence)
        if (raw[offset] !== CommentMarker.Regular && raw[offset] !== CommentMarker.Hashmark) {
            return null;
        }

        // Consume the comment marker
        const marker: Value<CommentMarker> = {
            type: 'Value',
            loc: locRange(loc, offset, offset + 1),
            value: raw[offset] === CommentMarker.Hashmark ? CommentMarker.Hashmark : CommentMarker.Regular,
        };

        offset += 1;

        // Skip spaces
        offset = StringUtils.skipWS(raw, offset);

        // Save header start position
        const headerStart = offset;

        // Check if the comment text starts with a known header
        const text = raw.slice(offset);

        for (let i = 0; i < METADATA_HEADERS.length; i += 1) {
            // Check if the comment text starts with the header (case-insensitive)
            if (text.toLocaleLowerCase().startsWith(METADATA_HEADERS[i].toLocaleLowerCase())) {
                // Skip the header
                offset += METADATA_HEADERS[i].length;

                // Save header
                const header: Value = {
                    type: 'Value',
                    loc: locRange(loc, headerStart, offset),
                    value: raw.slice(headerStart, offset),
                };

                // Skip spaces after the header
                offset = StringUtils.skipWS(raw, offset);

                // Check if the rule contains a separator after the header
                if (raw[offset] !== COLON) {
                    return null;
                }

                // Skip the separator
                offset += 1;

                // Skip spaces after the separator
                offset = StringUtils.skipWS(raw, offset);

                // Save the value start position
                const valueStart = offset;

                // Check if the rule contains a value
                if (offset >= raw.length) {
                    return null;
                }

                const valueEnd = StringUtils.skipWSBack(raw, raw.length - 1) + 1;

                // Save the value
                const value: Value = {
                    type: 'Value',
                    loc: locRange(loc, valueStart, valueEnd),
                    value: raw.substring(valueStart, valueEnd),
                };

                return {
                    type: CommentRuleType.MetadataCommentRule,
                    loc: locRange(loc, 0, raw.length),
                    raws: {
                        text: raw,
                    },
                    category: RuleCategory.Comment,
                    syntax: AdblockSyntax.Common,
                    marker,
                    header,
                    value,
                };
            }
        }

        return null;
    }

    /**
     * Converts a metadata comment AST to a string.
     *
     * @param ast - Metadata comment AST
     * @returns Raw string
     */
    public static generate(ast: MetadataCommentRule): string {
        let result = EMPTY;

        result += ast.marker.value;
        result += SPACE;
        result += ast.header.value;
        result += COLON;
        result += SPACE;
        result += ast.value.value;

        return result;
    }
}
