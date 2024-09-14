/* eslint-disable no-param-reassign */
import { StringUtils } from '../../utils/string';
import { type ParameterList, BinaryTypeMap, type Value } from '../common';
import {
    COMMA,
    EMPTY,
    NULL,
    SPACE,
} from '../../utils/constants';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ValueParser } from './value';
import { isNull, isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { QUOTE_SET } from '../../utils/quotes';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum ParameterListNodeSerializationMap {
    Children = 1,
    Start,
    End,
}

export class ParameterListParser extends ParserBase {
    /**
     * Parses a raw parameter list.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @param separator Separator character (default: comma)
     * @returns Parameter list AST
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
        separator: string = COMMA,
    ): ParameterList {
        // Prepare the parameter list node
        const params: ParameterList = {
            type: 'ParameterList',
            children: [],
        };

        const { length } = raw;

        if (options.isLocIncluded) {
            params.start = baseOffset;
            params.end = baseOffset + length;
        }

        let offset = 0;

        // Parse parameters: skip whitespace before and after each parameter, and
        // split parameters by the separator character.
        while (offset < length) {
            // Skip whitespace before parameter
            offset = StringUtils.skipWS(raw, offset);

            // Parameter may only contain whitespace
            // In this case, we reached the end of the parameter list
            if (raw[offset] === separator || offset === length) {
                // Add a null for empty parameter
                params.children.push(null);

                // Skip separator
                offset += 1;
            } else {
                // Get parameter start position
                const paramStart = offset;

                // Get next unescaped separator position
                const nextSeparator = StringUtils.findUnescapedNonStringNonRegexChar(raw, separator, offset);

                // Get parameter end position
                const paramEnd = nextSeparator !== -1
                    ? StringUtils.skipWSBack(raw, nextSeparator - 1)
                    : StringUtils.skipWSBack(raw);

                // Add parameter to the list
                const param = ValueParser.parse(
                    raw.slice(paramStart, paramEnd + 1),
                    options,
                    baseOffset + paramStart,
                );

                params.children.push(param);

                // Set offset to the next separator position + 1
                offset = nextSeparator !== -1 ? nextSeparator + 1 : length;
            }
        }

        // If the last character was a separator, add an additional null parameter
        if (raw[length - 1] === separator) {
            params.children.push(null);
        }

        return params;
    }

    /**
     * Parses an "uBO-specific parameter list".
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @param separator Separator character (default: comma).
     * @param requireQuotes Whether to require quotes around the parameter values (default: false).
     * @param supportedQuotes Set of accepted quotes (default: {@link QUOTE_SET}).
     * @returns Parameter list node.
     *
     * @note Based on {@link https://github.com/gorhill/uBlock/blob/f9ab4b75041815e6e5690d80851189ae3dc660d0/src/js/static-filtering-parser.js#L607-L699} to provide consistency.
     */
    public static parseUbo(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
        separator: string = COMMA,
        requireQuotes = false,
        supportedQuotes = QUOTE_SET,
    ): ParameterList {
        // Prepare the parameter list node
        const params: ParameterList = {
            type: 'ParameterList',
            children: [],
        };

        const { length } = raw;

        if (options.isLocIncluded) {
            params.start = baseOffset;
            params.end = baseOffset + length;
        }

        let offset = 0;
        let extraNull = false;

        while (offset < length) {
            offset = StringUtils.skipWS(raw, offset);
            const paramStart = offset;
            let paramEnd = offset;

            if (supportedQuotes.has(raw[offset])) {
                // Find the closing quote
                const possibleClosingQuoteIndex = StringUtils.findNextUnescapedCharacter(raw, raw[offset], offset + 1);

                if (possibleClosingQuoteIndex !== -1) {
                    // Next non-whitespace character after the closing quote should be the separator
                    const nextSeparatorIndex = StringUtils.skipWS(raw, possibleClosingQuoteIndex + 1);

                    if (nextSeparatorIndex === length) {
                        // If the separator is not found, the param end is the end of the string
                        paramEnd = StringUtils.skipWSBack(raw, length - 1) + 1;
                        offset = length;
                    } else if (raw[nextSeparatorIndex] === separator) {
                        // If the quote is followed by a separator, we can use it as a closing quote
                        paramEnd = possibleClosingQuoteIndex + 1;
                        offset = nextSeparatorIndex + 1;
                    } else {
                        if (requireQuotes) {
                            throw new AdblockSyntaxError(
                                `Expected separator, got: '${raw[nextSeparatorIndex]}'`,
                                baseOffset + nextSeparatorIndex,
                                baseOffset + length,
                            );
                        }
                        // Param end should be the last separator before the quote
                        offset = StringUtils.findNextUnescapedCharacterBackwards(
                            raw,
                            separator,
                            possibleClosingQuoteIndex,
                        ) + 1;
                        paramEnd = StringUtils.skipWSBack(raw, offset - 2) + 1;
                    }
                } else {
                    // If the closing quote is not found, the param end is the end of the string
                    paramEnd = StringUtils.skipWSBack(raw, length - 1) + 1;
                    offset = length;
                }
            } else {
                if (requireQuotes) {
                    throw new AdblockSyntaxError(
                        `Expected quote, got: '${raw[offset]}'`,
                        baseOffset + offset,
                        baseOffset + length,
                    );
                }
                const nextSeparator = StringUtils.findNextUnescapedCharacter(raw, separator, offset);

                if (nextSeparator === -1) {
                    // If the separator is not found, the param end is the end of the string
                    paramEnd = StringUtils.skipWSBack(raw, length - 1) + 1;
                    offset = length;
                } else {
                    // Param end should be the last non-whitespace character before the separator
                    paramEnd = StringUtils.skipWSBack(raw, nextSeparator - 1) + 1;
                    offset = nextSeparator + 1;

                    if (StringUtils.skipWS(raw, length - 1) === nextSeparator) {
                        extraNull = true;
                    }
                }
            }

            if (paramStart < paramEnd) {
                params.children.push(ValueParser.parse(
                    raw.slice(paramStart, paramEnd),
                    options,
                    baseOffset + paramStart,
                ));
            } else {
                params.children.push(null);
            }
        }

        if (extraNull) {
            params.children.push(null);
        }

        return params;
    }

    /**
     * Converts a parameter list AST to a string.
     *
     * @param params Parameter list AST
     * @param separator Separator character (default: comma)
     * @returns String representation of the parameter list
     */
    public static generate(params: ParameterList, separator = COMMA): string {
        const collection: string[] = [];

        // add parameters
        let i = 0;
        for (; i < params.children.length; i += 1) {
            const param = params.children[i];
            if (param === null) {
                collection.push(EMPTY);
            } else {
                collection.push(ValueParser.generate(param));
            }
        }

        // join parameters with separator
        // if the separator is a space, join with a single space
        const result = collection.join(separator === SPACE ? separator : `${separator}${SPACE}`);

        return result;
    }

    /**
     * Serializes a parameter list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     * @param frequentValuesMap Optional map of frequent values.
     * @param toLower Whether to lowercase the value before the frequent value match (defaults to `false`).
     */
    public static serialize(
        node: ParameterList,
        buffer: OutputByteBuffer,
        frequentValuesMap?: Map<string, number>,
        toLower = false,
    ): void {
        buffer.writeUint8(BinaryTypeMap.ParameterListNode);

        const count = node.children.length;
        buffer.writeUint8(ParameterListNodeSerializationMap.Children);
        // note: we store the count, because re-construction of the array is faster if we know the length
        buffer.writeUint32(count);

        for (let i = 0; i < count; i += 1) {
            const child = node.children[i];
            if (isNull(child)) {
                buffer.writeUint8(BinaryTypeMap.Null);
                continue;
            }
            ValueParser.serialize(child, buffer, frequentValuesMap, toLower);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ParameterListNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ParameterListNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a parameter list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentValuesMap Optional map of frequent values.
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: ParameterList,
        frequentValuesMap?: Map<number, string>,
    ): void {
        buffer.assertUint8(BinaryTypeMap.ParameterListNode);

        node.type = 'ParameterList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ParameterListNodeSerializationMap.Children:
                    node.children = new Array(buffer.readUint32());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        switch (buffer.peekUint8()) {
                            case BinaryTypeMap.Null:
                                buffer.readUint8();
                                node.children[i] = null;
                                break;

                            case BinaryTypeMap.ValueNode:
                                ValueParser.deserialize(buffer, node.children[i] = {} as Value, frequentValuesMap);
                                break;

                            default:
                                throw new Error(`Invalid child type: ${buffer.peekUint8()}`);
                        }
                    }
                    break;

                case ParameterListNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ParameterListNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
