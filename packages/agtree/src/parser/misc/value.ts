/* eslint-disable no-param-reassign */
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { BinaryTypeMap, type Value } from '../common';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { NULL } from '../../utils/constants';
import { isUndefined } from '../../utils/common';

/**
 * Property map for binary serialization.
 */
const enum BinaryPropMap {
    Value = 1,
    Start,
    End,
}

/**
 * Value parser.
 * This parser is very simple, it just exists to provide a consistent interface for parsing and generating values.
 */
export class ValueParser extends ParserBase {
    /**
     * Parses a value.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Value node.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): Value {
        const result: Value = {
            type: 'Value',
            value: raw,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    /**
     * Converts a value node to a string.
     *
     * @param node Value node.
     * @returns Raw string.
     */
    public static generate(node: Value): string {
        return node.value;
    }

    /**
     * Serializes a value node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: Value, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ValueNode);

        buffer.writeUint8(BinaryPropMap.Value);
        buffer.writeString(node.value);

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
     * Deserializes a value node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Value>): void {
        const type = buffer.readUint8();

        if (type !== BinaryTypeMap.ValueNode) {
            throw new Error(`Not a value node: ${type}.`);
        }

        node.type = 'Value';

        let prop = buffer.readUint8();

        // while prop is not undefined or NULL (0)
        while (prop) {
            switch (prop) {
                case BinaryPropMap.Value: {
                    node.value = buffer.readString();
                    break;
                }
                case BinaryPropMap.Start: {
                    node.start = buffer.readUint32();
                    break;
                }
                case BinaryPropMap.End: {
                    node.end = buffer.readUint32();
                    break;
                }
                default:
                    throw new Error(`Invalid property type: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
