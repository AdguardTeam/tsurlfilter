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
     * Value map for binary deserialization. This helps to reduce the size of the serialized data,
     * as it allows us to use a single byte to represent frequently used values.
     */
    private static readonly FREQUENT_ARGS_DESERIALIZATION_MAP = new Map<number, string>([
        [0, 'abort-current-script.js'],
        [1, 'acs.js'],
        [2, 'abort-current-inline-script.js'],
        [3, 'acis.js'],
        [4, 'abort-on-property-read.js'],
        [5, 'aopr.js'],
        [6, 'abort-on-property-write.js'],
        [7, 'aopw.js'],
        [8, 'abort-on-stack-trace.js'],
        [9, 'aost.js'],
        [10, 'adjust-setInterval.js'],
        [11, 'nano-setInterval-booster.js'],
        [12, 'nano-sib.js'],
        [13, 'adjust-setTimeout.js'],
        [14, 'nano-setTimeout-booster.js'],
        [15, 'nano-stb.js'],
        [16, 'close-window.js'],
        [17, 'window-close-if.js'],
        [18, 'disable-newtab-links.js'],
        [19, 'evaldata-prune.js'],
        [20, 'json-prune.js'],
        [21, 'addEventListener-logger.js'],
        [22, 'aell.js'],
        [23, 'm3u-prune.js'],
        [24, 'nowebrtc.js'],
        [25, 'addEventListener-defuser.js'],
        [26, 'aeld.js'],
        [27, 'prevent-addEventListener.js'],
        [28, 'adfly-defuser.js'],
        [29, 'noeval-if.js'],
        [30, 'prevent-eval-if.js'],
        [31, 'no-fetch-if.js'],
        [32, 'prevent-fetch.js'],
        [33, 'no-xhr-if.js'],
        [34, 'prevent-xhr.js'],
        [35, 'prevent-refresh.js'],
        [36, 'refresh-defuser.js'],
        [37, 'no-requestAnimationFrame-if.js'],
        [38, 'norafif.js'],
        [39, 'prevent-requestAnimationFrame.js'],
        [40, 'no-setInterval-if.js'],
        [41, 'nosiif.js'],
        [42, 'prevent-setInterval.js'],
        [43, 'setInterval-defuser.js'],
        [44, 'no-setTimeout-if.js'],
        [45, 'nostif.js'],
        [46, 'prevent-setTimeout.js'],
        [47, 'setTimeout-defuser.js'],
        [48, 'no-window-open-if.js'],
        [49, 'nowoif.js'],
        [50, 'prevent-window-open.js'],
        [51, 'window.open-defuser.js'],
        [52, 'remove-attr.js'],
        [53, 'ra.js'],
        [54, 'remove-class.js'],
        [55, 'rc.js'],
        [56, 'remove-cookie.js'],
        [57, 'cookie-remover.js'],
        [58, 'remove-node-text.js'],
        [59, 'rmnt.js'],
        [60, 'set-attr.js'],
        [61, 'set-constant.js'],
        [62, 'set.js'],
        [63, 'set-cookie.js'],
        [64, 'set-local-storage-item.js'],
        [65, 'set-session-storage-item.js'],
        [66, 'xml-prune.js'],
        [67, 'webrtc-if.js'],
        [68, 'overlay-buster.js'],
        [69, 'alert-buster.js'],
        [70, 'golem.de.js'],
        [71, 'href-sanitizer.js'],
        [72, 'call-nothrow.js'],
        [73, 'window.name-defuser.js'],
        [74, 'spoof-css.js'],
        [75, 'trusted-set-constant.js'],
        [76, 'trusted-set.js'],
        [77, 'trusted-set-cookie.js'],
        [78, 'trusted-set-local-storage-item.js'],
        [79, 'trusted-replace-fetch-response.js'],
        [80, 'json-prune-fetch-response.js'],
        [81, 'json-prune-xhr-response.js'],
        [82, 'trusted-replace-xhr-response.js'],
        [83, 'multiup.js'],
        [84, 'prevent-canvas.js'],
        [85, 'set-cookie-reload.js'],
        [86, 'trusted-set-cookie-reload.js'],
        [87, 'trusted-click-element.js'],
        [88, 'trusted-prune-inbound-object.js'],
        [89, 'trusted-prune-outbound-object.js'],
        [90, 'trusted-set-session-storage-item.js'],
        [91, 'trusted-replace-node-text.js'],
        [92, 'trusted-rpnt.js'],
        [93, 'replace-node-text.js'],
        [94, 'rpnt.js'],
    ]);

    /**
     * Value map for binary serialization. This helps to reduce the size of the serialized data,
     * as it allows us to use a single byte to represent frequently used values.
     *
     * ! IMPORTANT: WHEN ADDING A NEW VALUE, DO _NOT_ MODIFY EXISTING VALUES AS THIS WILL BREAK DESERIALIZATION!
     *
     * @note Only 256 values can be represented this way.
     * @note We generate serialization map from deserialization map to keep capital characters.
     */
    private static readonly FREQUENT_ARGS_SERIALIZATION_MAP = new Map<string, number>(
        Array.from(this.FREQUENT_ARGS_DESERIALIZATION_MAP.entries()).map(([key, value]) => [value.toLowerCase(), key]),
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
