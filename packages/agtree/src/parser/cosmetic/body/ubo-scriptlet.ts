/**
 * @file uBlock scriptlet injection body parser
 */

import {
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    ESCAPE_CHARACTER,
    OPEN_PARENTHESIS,
    SPACE,
    UBO_SCRIPTLET_MASK,
} from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ParameterListParser } from '../../misc/parameter-list';
import { type ScriptletInjectionRuleBody } from '../../common';
import { defaultParserOptions } from '../../options';
import { ParserBase } from '../../interface';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { deserializeScriptletBody, serializeScriptletBody } from './scriptlet-serialization-helper';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version';

/**
 * `UboScriptletInjectionBodyParser` is responsible for parsing the body of a uBlock-style scriptlet rule.
 *
 * Please note that the parser will parse any scriptlet rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com##+js(scriptlet0, arg0)
 * ```
 *
 * but it didn't check if the scriptlet `scriptlet0` actually supported by any adblocker.
 *
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#scriptlet-injection}
 */
export class UboScriptletInjectionBodyParser extends ParserBase {
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        NO_SCRIPTLET_MASK: `Invalid uBO scriptlet call, no scriptlet call mask '${UBO_SCRIPTLET_MASK}' found`,
        NO_OPENING_PARENTHESIS: `Invalid uBO scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        NO_CLOSING_PARENTHESIS: `Invalid uBO scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        NO_SCRIPTLET_NAME: 'Invalid uBO scriptlet call, no scriptlet name specified',
        WHITESPACE_AFTER_MASK: 'Invalid uBO scriptlet call, whitespace is not allowed after the scriptlet call mask',
        NO_MULTIPLE_SCRIPTLET_CALLS: 'uBO syntaxes does not support multiple scriptlet calls within one single rule',
    };

    /**
     * Value map for binary serialization. This helps to reduce the size of the serialized data,
     * as it allows us to use a single byte to represent frequently used values.
     *
     * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
     *
     * @note Only 256 values can be represented this way.
     */
    private static readonly FREQUENT_ARGS_SERIALIZATION_MAP = new Map<string, number>([
        ['abort-current-script.js', 0],
        ['acs.js', 1],
        ['abort-current-inline-script.js', 2],
        ['acis.js', 3],
        ['abort-on-property-read.js', 4],
        ['aopr.js', 5],
        ['abort-on-property-write.js', 6],
        ['aopw.js', 7],
        ['abort-on-stack-trace.js', 8],
        ['aost.js', 9],
        ['adjust-setInterval.js', 10],
        ['nano-setInterval-booster.js', 11],
        ['nano-sib.js', 12],
        ['adjust-setTimeout.js', 13],
        ['nano-setTimeout-booster.js', 14],
        ['nano-stb.js', 15],
        ['close-window.js', 16],
        ['window-close-if.js', 17],
        ['disable-newtab-links.js', 18],
        ['evaldata-prune.js', 19],
        ['json-prune.js', 20],
        ['addEventListener-logger.js', 21],
        ['aell.js', 22],
        ['m3u-prune.js', 23],
        ['nowebrtc.js', 24],
        ['addEventListener-defuser.js', 25],
        ['aeld.js', 26],
        ['prevent-addEventListener.js', 27],
        ['adfly-defuser.js', 28],
        ['noeval-if.js', 29],
        ['prevent-eval-if.js', 30],
        ['no-fetch-if.js', 31],
        ['prevent-fetch.js', 32],
        ['no-xhr-if.js', 33],
        ['prevent-xhr.js', 34],
        ['prevent-refresh.js', 35],
        ['refresh-defuser.js', 36],
        ['no-requestAnimationFrame-if.js', 37],
        ['norafif.js', 38],
        ['prevent-requestAnimationFrame.js', 39],
        ['no-setInterval-if.js', 40],
        ['nosiif.js', 41],
        ['prevent-setInterval.js', 42],
        ['setInterval-defuser.js', 43],
        ['no-setTimeout-if.js', 44],
        ['nostif.js', 45],
        ['prevent-setTimeout.js', 46],
        ['setTimeout-defuser.js', 47],
        ['no-window-open-if.js', 48],
        ['nowoif.js', 49],
        ['prevent-window-open.js', 50],
        ['window.open-defuser.js', 51],
        ['remove-attr.js', 52],
        ['ra.js', 53],
        ['remove-class.js', 54],
        ['rc.js', 55],
        ['remove-cookie.js', 56],
        ['cookie-remover.js', 57],
        ['remove-node-text.js', 58],
        ['rmnt.js', 59],
        ['set-attr.js', 60],
        ['set-constant.js', 61],
        ['set.js', 62],
        ['set-cookie.js', 63],
        ['set-local-storage-item.js', 64],
        ['set-session-storage-item.js', 65],
        ['xml-prune.js', 66],
        ['webrtc-if.js', 67],
        ['overlay-buster.js', 68],
        ['alert-buster.js', 69],
        ['golem.de.js', 70],
        ['href-sanitizer.js', 71],
        ['call-nothrow.js', 72],
        ['window.name-defuser.js', 73],
        ['spoof-css.js', 74],
        ['trusted-set-constant.js', 75],
        ['trusted-set.js', 76],
        ['trusted-set-cookie.js', 77],
        ['trusted-set-local-storage-item.js', 78],
        ['trusted-replace-fetch-response.js', 79],
        ['json-prune-fetch-response.js', 80],
        ['json-prune-xhr-response.js', 81],
        ['trusted-replace-xhr-response.js', 82],
        ['multiup.js', 83],
        ['prevent-canvas.js', 84],
        ['set-cookie-reload.js', 85],
        ['trusted-set-cookie-reload.js', 86],
        ['trusted-click-element.js', 87],
        ['trusted-prune-inbound-object.js', 88],
        ['trusted-prune-outbound-object.js', 89],
        ['trusted-set-session-storage-item.js', 90],
        ['trusted-replace-node-text.js', 91],
        ['trusted-rpnt.js', 92],
        ['replace-node-text.js', 93],
        ['rpnt.js', 94],
    ]);

    /**
     * Value map for binary deserialization. This helps to reduce the size of the serialized data,
     * as it allows us to use a single byte to represent frequently used values.
     */
    private static readonly FREQUENT_ARGS_DESERIALIZATION_MAP = new Map<number, string>(
        Array.from(this.FREQUENT_ARGS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
    );

    /**
     * Parses the body of a uBlock-style scriptlet rule.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Node of the parsed scriptlet call body
     * @throws If the body is syntactically incorrect
     * @example
     * ```
     * ##+js(scriptlet0, arg0)
     * ```
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ScriptletInjectionRuleBody {
        let offset = 0;

        // Skip leading spaces
        offset = StringUtils.skipWS(raw, offset);

        // Scriptlet call should start with "+js"
        if (!raw.startsWith(UBO_SCRIPTLET_MASK, offset)) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_SCRIPTLET_MASK,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        offset += UBO_SCRIPTLET_MASK.length;

        // Whitespace is not allowed after the mask
        if (raw[offset] === SPACE) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.WHITESPACE_AFTER_MASK,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        // Parameter list should be wrapped in parentheses
        if (raw[offset] !== OPEN_PARENTHESIS) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        // Save the offset of the opening parentheses
        const openingParenthesesIndex = offset;

        // Skip whitespace from the end
        const closingParenthesesIndex = StringUtils.skipWSBack(raw, raw.length - 1);

        // Closing parentheses should be present
        if (
            raw[closingParenthesesIndex] !== CLOSE_PARENTHESIS
            || raw[closingParenthesesIndex - 1] === ESCAPE_CHARACTER
        ) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_CLOSING_PARENTHESIS,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        // Parse parameter list
        const params = ParameterListParser.parse(
            raw.slice(openingParenthesesIndex + 1, closingParenthesesIndex),
            options,
            baseOffset + openingParenthesesIndex + 1,
            COMMA,
        );

        // Allow empty scriptlet call: +js()
        // but not allow parameters without scriptlet: +js(, arg0, arg1)
        if (params.children.length > 0 && params.children[0] === null) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_SCRIPTLET_NAME,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            children: [
                params,
            ],
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    /**
     * Generates a string representation of the uBlock scriptlet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
     */
    public static generate(node: ScriptletInjectionRuleBody): string {
        const result: string[] = [];

        if (node.children.length > 1) {
            throw new Error(this.ERROR_MESSAGES.NO_MULTIPLE_SCRIPTLET_CALLS);
        }

        result.push(UBO_SCRIPTLET_MASK);
        result.push(OPEN_PARENTHESIS);

        if (node.children.length > 0) {
            result.push(ParameterListParser.generate(node.children[0]));
        }

        result.push(CLOSE_PARENTHESIS);

        return result.join(EMPTY);
    }

    /**
     * Serializes a scriptlet call body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ScriptletInjectionRuleBody, buffer: OutputByteBuffer): void {
        serializeScriptletBody(node, buffer, this.FREQUENT_ARGS_SERIALIZATION_MAP);
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
