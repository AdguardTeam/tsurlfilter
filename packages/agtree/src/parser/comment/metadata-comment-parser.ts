/**
 * @file Metadata comments
 */

import { StringUtils } from '../../utils/string';
import { AdblockSyntax } from '../../utils/adblockers';
import { COLON } from '../../utils/constants';
import {
    CommentMarker,
    CommentRuleType,
    type MetadataCommentRule,
    RuleCategory,
} from '../../nodes';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../base-parser';
import { ValueParser } from '../misc/value-parser';
import { KNOWN_METADATA_HEADERS } from '../../common/metadata-comment-common';

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
export class MetadataCommentParser extends BaseParser {
    /**
     * Parses a raw rule as a metadata comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Metadata comment AST or null (if the raw rule cannot be parsed as a metadata comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): MetadataCommentRule | null {
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
        const marker = ValueParser.parse(raw[offset], options, baseOffset + offset);

        offset += 1;

        // Skip spaces
        offset = StringUtils.skipWS(raw, offset);

        // Save header start position
        const headerStart = offset;

        // Check if the comment text starts with a known header
        const text = raw.slice(offset);

        for (const knownHeader of KNOWN_METADATA_HEADERS) {
            // Check if the comment text starts with the header (case-insensitive)
            if (text.toLocaleLowerCase().startsWith(knownHeader.toLocaleLowerCase())) {
                // Skip the header
                offset += knownHeader.length;

                // Save header
                const header = ValueParser.parse(raw.slice(headerStart, offset), options, baseOffset + headerStart);

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
                const value = ValueParser.parse(raw.slice(valueStart, valueEnd), options, baseOffset + valueStart);

                const result: MetadataCommentRule = {
                    type: CommentRuleType.MetadataCommentRule,
                    category: RuleCategory.Comment,
                    syntax: AdblockSyntax.Common,
                    marker,
                    header,
                    value,
                };

                if (options.includeRaws) {
                    result.raws = {
                        text: raw,
                    };
                }

                if (options.isLocIncluded) {
                    result.start = baseOffset;
                    result.end = baseOffset + raw.length;
                }

                return result;
            }
        }

        return null;
    }
}
