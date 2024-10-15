/* eslint-disable no-param-reassign */
import { defaultParserOptions } from '../options';
import { BaseParser } from '../interface';
import { BinaryTypeMap, type Value } from '../../nodes';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { EMPTY, NULL } from '../../utils/constants';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the `BINARY_SCHEMA_VERSION` !
 *
 * @note Only 256 values can be represented this way.
 */
const enum ValueNodeSerializationMap {
    Value = 1,
    FrequentValue,
    Start,
    End,
}

/**
 * Value parser.
 * This parser is very simple, it just exists to provide a consistent interface for parsing and generating values.
 */
export class ValueParser extends BaseParser {
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
     * Deserializes a value node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentValuesMap Optional map of frequent values.
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: Partial<Value>,
        frequentValuesMap?: Map<number, string>,
    ): void {
        buffer.assertUint8(BinaryTypeMap.ValueNode);

        node.type = 'Value';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ValueNodeSerializationMap.Value:
                    node.value = buffer.readString();
                    break;

                case ValueNodeSerializationMap.FrequentValue:
                    node.value = frequentValuesMap?.get(buffer.readUint8()) ?? EMPTY;
                    break;

                case ValueNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ValueNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
