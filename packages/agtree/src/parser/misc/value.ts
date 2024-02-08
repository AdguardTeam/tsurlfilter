import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { AST_TYPE_MAP, VALUE_PROPS_MAP, type Value } from '../common';
import { OutputByteBuffer } from '../../utils/output-byte-buffer';
import { InputByteBuffer } from '../../utils/input-byte-buffer';
import { ByteBuffer } from '../../utils/byte-buffer';

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
    public static deserialize(buffer: InputByteBuffer): Value {
        // deserialize "from right to left"
        const endOffset = buffer.byteOffset;

        // check node type
        const type = buffer.readUint8();

        if (type !== AST_TYPE_MAP.Value) {
            throw new Error(`Invalid node type: ${type}.`);
        }

        // prepare the result
        const result: Partial<Value> = {
            type: 'Value',
        };

        // read node length (node length within the buffer)
        const length = buffer.readUint32();

        // read properties
        const startOffset = endOffset - length;
        while (buffer.byteOffset > startOffset) {
            // read property type
            const prop = buffer.readUint8();

            switch (prop) {
                case VALUE_PROPS_MAP.value: {
                    // read value length
                    const valueLength = buffer.readUint32();

                    // read value
                    result.value = buffer.readString(valueLength);
                    break;
                }
                case VALUE_PROPS_MAP.start: {
                    result.start = buffer.readUint32();
                    break;
                }
                case VALUE_PROPS_MAP.end: {
                    result.end = buffer.readUint32();
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
const node = ValueParser.parse('hello 你好', defaultParserOptions, 0);
console.log(node);
const buffer = new ByteBuffer();
ValueParser.serialize(node, new OutputByteBuffer(buffer));
console.log(ValueParser.deserialize(new InputByteBuffer(buffer)));
