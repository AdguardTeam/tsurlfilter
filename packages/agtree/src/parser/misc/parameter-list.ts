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
import { isUndefined } from '../../utils/type-guards';

/**
 * Property map for binary serialization.
 */
const enum BinaryPropMap {
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
                // note: this is needed to keep the parameter count, like:
                // +js(,foo) - in this case, the first parameter is empty
                params.children.push(null);

                // skip separator
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

        // if the last parameter is empty, add an extra separator to the end
        if (params.children.length > 0 && params.children[params.children.length - 1] === null) {
            return `${result}${separator}`;
        }

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
        if (count) {
            buffer.writeUint8(BinaryPropMap.Children);
            buffer.writeUint32(count);

            for (let i = 0; i < count; i += 1) {
                const child = node.children[i];
                if (child === null) {
                    buffer.writeUint8(BinaryTypeMap.Null);
                    continue;
                }
                ValueParser.serialize(child, buffer, frequentValuesMap, toLower);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(BinaryPropMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(BinaryPropMap.End);
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

        // read buffer until NULL
        let prop = buffer.readUint8();
        while (prop) {
            switch (prop) {
                case BinaryPropMap.Children:
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
                                throw new Error(`Invalid child type: ${buffer.peekUint8()}.`);
                        }
                    }
                    break;
                case BinaryPropMap.Start:
                    node.start = buffer.readUint32();
                    break;
                case BinaryPropMap.End:
                    node.end = buffer.readUint32();
                    break;
                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
