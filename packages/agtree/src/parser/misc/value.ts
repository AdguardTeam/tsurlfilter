import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { AST_TYPE_MAP, VALUE_PROPS_MAP, type Value } from '../common';
import { type ByteBuffer } from '../../utils/byte-buffer';

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
    public static serialize(node: Value, buffer: ByteBuffer): void {
        // serialize "from left to right"
        const startOffset = buffer.byteOffset;

        if (node.end !== undefined) {
            buffer.writeUint32(node.end);
            buffer.writeUint8(VALUE_PROPS_MAP.end);
        }

        if (node.start !== undefined) {
            buffer.writeUint32(node.start);
            buffer.writeUint8(VALUE_PROPS_MAP.start);
        }

        const valueLength = buffer.writeString(node.value);
        buffer.writeUint32(valueLength);
        buffer.writeUint8(VALUE_PROPS_MAP.value);

        buffer.writeUint32(buffer.byteOffset - startOffset + 1); // value node length
        buffer.writeUint8(AST_TYPE_MAP.Value); // value node type
    }

    /**
     * Deserializes a value node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param endOffset Offset of the end of the node in the buffer.
     * @returns Deserialized value node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: ByteBuffer, endOffset: number): Value {
        // deserialize "from right to left"
        let offset = endOffset;

        // check node type
        offset -= 1;
        const type = buffer.readUint8(offset);

        if (type !== AST_TYPE_MAP.Value) {
            throw new Error(`Invalid node type: ${type}.`);
        }

        // prepare the result
        const result: Partial<Value> = {
            type: 'Value',
        };

        // read node length (node length within the buffer)
        offset -= 4;
        const length = buffer.readUint32(offset);

        // read properties
        const startOffset = offset - length;
        while (offset > startOffset) {
            // read property type
            offset -= 1;
            const prop = buffer.readUint8(offset);

            switch (prop) {
                case VALUE_PROPS_MAP.value: {
                    // read value length
                    offset -= 4;
                    const valueLength = buffer.readUint32(offset);

                    // read value
                    offset -= valueLength;
                    result.value = buffer.readString(offset, valueLength);
                    break;
                }
                case VALUE_PROPS_MAP.start: {
                    offset -= 4;
                    result.start = buffer.readUint32(offset);
                    break;
                }
                case VALUE_PROPS_MAP.end: {
                    offset -= 4;
                    result.end = buffer.readUint32(offset);
                    break;
                }
                default:
                    throw new Error(`Invalid property type: ${prop}.`);
            }
        }

        // FIXME: at this point, we don't check - for example - if value is present or not
        return result as Value;
    }
}

// FIXME: remove these lines
// const node = ValueParser.parse('hello 你好', defaultParserOptions, 0);
// console.log(node);
// const buffer = new ByteBuffer();
// ValueParser.serialize(node, buffer);
// console.log(ValueParser.deserialize(buffer, buffer.byteOffset));
