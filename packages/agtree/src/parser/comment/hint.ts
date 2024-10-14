/* eslint-disable no-param-reassign */
/**
 * @file AdGuard Hints
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */

import {
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    NULL,
    OPEN_PARENTHESIS,
    SPACE,
    UNDERSCORE,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import {
    BinaryTypeMap,
    type ParameterList,
    type Hint,
    type Value,
} from '../../nodes';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { ParameterListParser } from '../misc/parameter-list';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { ValueParser } from '../misc/value';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum HintNodeSerializationMap {
    Name = 1,
    Params,
    Start,
    End,
}

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const FREQUENT_HINTS_SERIALIZATION_MAP = new Map<string, number>([
    ['NOT_OPTIMIZED', 0],
    ['PLATFORM', 1],
    ['NOT_PLATFORM', 2],
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_HINTS_DESERIALIZATION_MAP: Map<number, string>;
const getFrequentHintsDeserializationMap = () => {
    if (!FREQUENT_HINTS_DESERIALIZATION_MAP) {
        FREQUENT_HINTS_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_HINTS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return FREQUENT_HINTS_DESERIALIZATION_MAP;
};

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const FREQUENT_PLATFORMS_SERIALIZATION_MAP = new Map<string, number>([
    ['windows', 0],
    ['mac', 1],
    ['android', 2],
    ['ios', 3],
    ['ext_chromium', 4],
    ['ext_ff', 5],
    ['ext_edge', 6],
    ['ext_opera', 7],
    ['ext_safari', 8],
    ['ext_android_cb', 9],
    ['ext_ublock', 10],
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_PLATFORMS_DESERIALIZATION_MAP: Map<number, string>;
const getFrequentPlatformsDeserializationMap = () => {
    if (!FREQUENT_PLATFORMS_DESERIALIZATION_MAP) {
        FREQUENT_PLATFORMS_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_PLATFORMS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return FREQUENT_PLATFORMS_DESERIALIZATION_MAP;
};

/**
 * `HintParser` is responsible for parsing AdGuard hints.
 *
 * @example
 * If the hint rule is
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * then the hints are `NOT_OPTIMIZED` and `PLATFORM(windows)`, and this
 * class is responsible for parsing them. The rule itself is parsed by
 * the `HintRuleParser`, which uses this class to parse single hints.
 */
export class HintParser extends ParserBase {
    /**
     * Parses a raw rule as a hint.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Hint rule AST or null
     * @throws If the syntax is invalid
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): Hint {
        let offset = 0;

        // Skip whitespace characters before the hint
        offset = StringUtils.skipWS(raw);

        // Hint should start with the hint name in every case

        // Save the start offset of the hint name
        const nameStartIndex = offset;

        // Parse the hint name
        for (; offset < raw.length; offset += 1) {
            const char = raw[offset];

            // Abort consuming the hint name if we encounter a whitespace character
            // or an opening parenthesis, which means 'HIT_NAME(' case
            if (char === OPEN_PARENTHESIS || char === SPACE) {
                break;
            }

            // Hint name should only contain letters, digits, and underscores
            if (!StringUtils.isAlphaNumeric(char) && char !== UNDERSCORE) {
                throw new AdblockSyntaxError(
                    `Invalid character "${char}" in hint name: "${char}"`,
                    baseOffset + nameStartIndex,
                    baseOffset + offset,
                );
            }
        }

        // Save the end offset of the hint name
        const nameEndIndex = offset;

        // Save the hint name token
        const name = raw.slice(nameStartIndex, nameEndIndex);

        // Hint name cannot be empty
        if (name === EMPTY) {
            throw new AdblockSyntaxError('Empty hint name', baseOffset, baseOffset + nameEndIndex);
        }

        // Now we have two case:
        //  1. We have HINT_NAME and should return it
        //  2. We have HINT_NAME(PARAMS) and should continue parsing

        // Skip whitespace characters after the hint name
        offset = StringUtils.skipWS(raw, offset);

        // Throw error for 'HINT_NAME (' case
        if (offset > nameEndIndex && raw[offset] === OPEN_PARENTHESIS) {
            throw new AdblockSyntaxError(
                'Unexpected whitespace(s) between hint name and opening parenthesis',
                baseOffset + nameEndIndex,
                baseOffset + offset,
            );
        }

        // Create the hint name node (we can reuse it in the 'HINT_NAME' case, if needed)
        const nameNode = ValueParser.parse(name, options, baseOffset + nameStartIndex);

        // Just return the hint name if we have 'HINT_NAME' case (no params)
        if (raw[offset] !== OPEN_PARENTHESIS) {
            const result: Hint = {
                type: 'Hint',
                name: nameNode,
            };

            if (options.isLocIncluded) {
                result.start = baseOffset;
                result.end = baseOffset + offset;
            }

            return result;
        }

        // Skip the opening parenthesis
        offset += 1;

        // Find closing parenthesis
        const closeParenthesisIndex = raw.lastIndexOf(CLOSE_PARENTHESIS);

        // Throw error if we don't have closing parenthesis
        if (closeParenthesisIndex === -1) {
            throw new AdblockSyntaxError(
                `Missing closing parenthesis for hint "${name}"`,
                baseOffset + nameStartIndex,
                baseOffset + raw.length,
            );
        }

        // Save the start and end index of the params
        const paramsStartIndex = offset;
        const paramsEndIndex = closeParenthesisIndex;

        // Parse the params
        const params = ParameterListParser.parse(
            raw.slice(paramsStartIndex, paramsEndIndex),
            options,
            baseOffset + paramsStartIndex,
            COMMA,
        );

        offset = closeParenthesisIndex + 1;

        // Skip whitespace characters after the closing parenthesis
        offset = StringUtils.skipWS(raw, offset);

        // Throw error if we don't reach the end of the input
        if (offset !== raw.length) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                `Unexpected input after closing parenthesis for hint "${name}": "${raw.slice(closeParenthesisIndex + 1, offset + 1)}"`,
                baseOffset + closeParenthesisIndex + 1,
                baseOffset + offset + 1,
            );
        }

        // Return the HINT_NAME(PARAMS) case AST
        const result: Hint = {
            type: 'Hint',
            name: nameNode,
            params,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + offset;
        }

        return result;
    }

    /**
     * Converts a single hint AST to a string.
     *
     * @param hint Hint AST
     * @returns Hint string
     */
    public static generate(hint: Hint): string {
        let result = EMPTY;

        result += hint.name.value;

        if (hint.params && hint.params.children.length > 0) {
            result += OPEN_PARENTHESIS;
            result += ParameterListParser.generate(hint.params, COMMA);
            result += CLOSE_PARENTHESIS;
        }

        return result;
    }

    /**
     * Serializes a hint node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: Hint, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.HintNode);

        buffer.writeUint8(HintNodeSerializationMap.Name);
        ValueParser.serialize(node.name, buffer, FREQUENT_HINTS_SERIALIZATION_MAP);

        if (!isUndefined(node.params)) {
            buffer.writeUint8(HintNodeSerializationMap.Params);
            ParameterListParser.serialize(node.params, buffer, FREQUENT_PLATFORMS_SERIALIZATION_MAP);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HintNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HintNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a hint node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Hint>): void {
        buffer.assertUint8(BinaryTypeMap.HintNode);

        node.type = 'Hint';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HintNodeSerializationMap.Name:
                    ValueParser.deserialize(buffer, node.name = {} as Value, getFrequentHintsDeserializationMap());
                    break;

                case HintNodeSerializationMap.Params:
                    // eslint-disable-next-line max-len
                    ParameterListParser.deserialize(buffer, node.params = {} as ParameterList, getFrequentPlatformsDeserializationMap());
                    break;

                case HintNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HintNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
