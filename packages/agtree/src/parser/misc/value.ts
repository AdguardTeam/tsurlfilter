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
    FrequentValue,
    Start,
    End,
}

/**
 * Some values are very frequent and can be represented by a single byte.
 * This map is used to serialize and deserialize such values.
 */
// FIXME: add all frequent values
const FREQUENT_VALUES_MAP: Record<string, number> = Object.freeze({
    domain: 1,
    'third-party': 2,
    script: 3,
});

/**
 * Reverse frequent values map.
 */
// FIXME: add all frequent values
const FREQUENT_VALUES_MAP_REVERSE: Record<number, string> = Object.freeze({
    1: 'domain',
    2: 'third-party',
    3: 'script',
});

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

        const frequentValue = FREQUENT_VALUES_MAP[node.value];
        if (frequentValue) {
            buffer.writeUint8(BinaryPropMap.FrequentValue);
            buffer.writeUint8(frequentValue);
        } else {
            buffer.writeUint8(BinaryPropMap.Value);
            buffer.writeString(node.value);
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
     * Deserializes a value node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Value>): void {
        buffer.assertUint8(BinaryTypeMap.ValueNode);
        node.type = 'Value';

        // read buffer until NULL
        let prop = buffer.readUint8();
        while (prop) {
            switch (prop) {
                case BinaryPropMap.Value: {
                    node.value = buffer.readString();
                    break;
                }
                case BinaryPropMap.FrequentValue: {
                    node.value = FREQUENT_VALUES_MAP_REVERSE[buffer.readUint8()];
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
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
