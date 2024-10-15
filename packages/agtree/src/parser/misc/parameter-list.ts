/* eslint-disable no-param-reassign */
import { StringUtils } from '../../utils/string';
import { type ParameterList, BinaryTypeMap, type Value } from '../../nodes';
import { COMMA, NULL } from '../../utils/constants';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ValueParser } from './value';
import { isNull, isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

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

export class ParameterListParser extends BaseParser {
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
