/**
 * @file uBlock scriptlet injection body parser
 */

import { SEMICOLON, SPACE } from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ParameterListParser } from '../../misc/parameter-list';
import { type ScriptletInjectionRuleBody } from '../../../nodes';
import { defaultParserOptions } from '../../options';
import { BaseParser } from '../../interface';
import { deserializeScriptletBody } from './scriptlet-serialization-helper';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version';

/**
 * `AbpSnippetInjectionBodyParser` is responsible for parsing the body of an Adblock Plus-style snippet rule.
 *
 * Please note that the parser will parse any scriptlet rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com#$#snippet0 arg0
 * ```
 *
 * but it didn't check if the scriptlet `snippet0` actually supported by any adblocker.
 *
 * @see {@link https://help.eyeo.com/adblockplus/snippet-filters-tutorial}
 */
export class AbpSnippetInjectionBodyParser extends BaseParser {
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        EMPTY_SCRIPTLET_CALL: 'Empty ABP snippet call',
    };

    /**
     * Value map for binary serialization. This helps to reduce the size of the serialized data,
     * as it allows us to use a single byte to represent frequently used values.
     *
     * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
     *
     * @note Only 256 values can be represented this way.
     */
    // TODO: Update this map with the actual values
    private static readonly FREQUENT_ARGS_SERIALIZATION_MAP = new Map<string, number>([
        ['abort-current-inline-script', 0],
        ['abort-on-property-read', 1],
        ['abort-on-property-write', 2],
        ['json-prune', 3],
        ['log', 4],
        ['prevent-listener', 5],
        ['cookie-remover', 6],
        ['override-property-read', 7],
        ['abort-on-iframe-property-read', 8],
        ['abort-on-iframe-property-write', 9],
        ['freeze-element', 10],
        ['json-override', 11],
        ['simulate-mouse-event', 12],
        ['strip-fetch-query-parameter', 13],
        ['hide-if-contains', 14],
        ['hide-if-contains-image', 15],
        ['hide-if-contains-image-hash', 16],
        ['hide-if-contains-similar-text', 17],
        ['hide-if-contains-visible-text', 18],
        ['hide-if-contains-and-matches-style', 19],
        ['hide-if-graph-matches', 20],
        ['hide-if-has-and-matches-style', 21],
        ['hide-if-labelled-by', 22],
        ['hide-if-matches-xpath', 23],
        ['hide-if-matches-computed-xpath', 24],
        ['hide-if-shadow-contains', 25],
        ['debug', 26],
        ['trace', 27],
        ['race', 28],
    ]);

    /**
     * Value map for binary deserialization. This helps to reduce the size of the serialized data,
     * as it allows us to use a single byte to represent frequently used values.
     */
    private static readonly FREQUENT_ARGS_DESERIALIZATION_MAP = new Map<number, string>(
        Array.from(this.FREQUENT_ARGS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
    );

    /**
     * Parses the body of an Adblock Plus-style snippet rule.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Node of the parsed scriptlet call body
     * @throws If the body is syntactically incorrect
     * @example
     * ```
     * #$#snippet0 arg0
     * ```
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ScriptletInjectionRuleBody {
        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            children: [],
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        let offset = 0;

        // Skip leading spaces
        offset = StringUtils.skipWS(raw, offset);

        while (offset < raw.length) {
            offset = StringUtils.skipWS(raw, offset);

            const scriptletCallStart = offset;

            // Find the next semicolon or the end of the string
            let semicolonIndex = StringUtils.findUnescapedNonStringNonRegexChar(raw, SEMICOLON, offset);

            if (semicolonIndex === -1) {
                semicolonIndex = raw.length;
            }

            const scriptletCallEnd = Math.max(StringUtils.skipWSBack(raw, semicolonIndex - 1) + 1, scriptletCallStart);

            const params = ParameterListParser.parse(
                raw.slice(scriptletCallStart, scriptletCallEnd),
                options,
                baseOffset + scriptletCallStart,
                SPACE,
            );

            // Parse the scriptlet call
            result.children.push(params);

            // Skip the semicolon
            offset = semicolonIndex + 1;
        }

        if (result.children.length === 0) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL,
                baseOffset,
                baseOffset + raw.length,
            );
        }

        return result;
    }

    /**
     * Deserializes a scriptlet call body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ScriptletInjectionRuleBody>): void {
        deserializeScriptletBody(buffer, node, this.FREQUENT_ARGS_DESERIALIZATION_MAP);
    }
}
