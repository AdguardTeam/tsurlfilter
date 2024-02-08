/* eslint-disable no-param-reassign */
import { EMPTY, MODIFIER_ASSIGN_OPERATOR, NEGATION_MARKER } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { AST_TYPE_MAP, type Modifier, type Value } from '../common';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueParser } from './value';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';

/**
 * `ModifierParser` is responsible for parsing modifiers.
 *
 * @example
 * `match-case`, `~third-party`, `domain=example.com|~example.org`
 */
export class ModifierParser extends ParserBase {
    /**
     * Parses a modifier.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Parsed modifier
     * @throws An error if modifier name or value is empty.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): Modifier {
        let offset = 0;

        // Skip leading whitespace
        offset = StringUtils.skipWS(raw, offset);

        // Save the offset of the first character of the modifier (whole modifier)
        const modifierStart = offset;

        // Check if the modifier is an exception
        let exception = false;

        if (raw[offset] === NEGATION_MARKER) {
            offset += NEGATION_MARKER.length;
            exception = true;
        }

        // Skip whitespace after the exception marker (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Save the offset of the first character of the modifier name
        const modifierNameStart = offset;

        // Find assignment operator
        const assignmentIndex = StringUtils.findNextUnescapedCharacter(raw, MODIFIER_ASSIGN_OPERATOR);

        // Find the end of the modifier
        const modifierEnd = Math.max(StringUtils.skipWSBack(raw) + 1, modifierNameStart);

        // Modifier name can't be empty
        if (modifierNameStart === modifierEnd) {
            throw new AdblockSyntaxError(
                'Modifier name cannot be empty',
                baseOffset,
                baseOffset + raw.length,
            );
        }

        let modifier: Value;
        let value: Value | undefined;

        // If there is no assignment operator, the whole modifier is the name
        // without a value
        if (assignmentIndex === -1) {
            modifier = {
                type: 'Value',
                value: raw.slice(modifierNameStart, modifierEnd),
            };

            if (options.isLocIncluded) {
                modifier.start = baseOffset + modifierNameStart;
                modifier.end = baseOffset + modifierEnd;
            }
        } else {
            // If there is an assignment operator, first we need to find the
            // end of the modifier name, then we can parse the value
            const modifierNameEnd = StringUtils.skipWSBack(raw, assignmentIndex - 1) + 1;

            modifier = {
                type: 'Value',
                value: raw.slice(modifierNameStart, modifierNameEnd),
            };

            if (options.isLocIncluded) {
                modifier.start = baseOffset + modifierNameStart;
                modifier.end = baseOffset + modifierNameEnd;
            }

            // Value can't be empty
            if (assignmentIndex + 1 === modifierEnd) {
                throw new AdblockSyntaxError(
                    'Modifier value cannot be empty',
                    baseOffset,
                    baseOffset + raw.length,
                );
            }

            // Skip whitespace after the assignment operator
            const valueStart = StringUtils.skipWS(raw, assignmentIndex + MODIFIER_ASSIGN_OPERATOR.length);

            value = {
                type: 'Value',
                value: raw.slice(valueStart, modifierEnd),
            };

            if (options.isLocIncluded) {
                value.start = baseOffset + valueStart;
                value.end = baseOffset + modifierEnd;
            }
        }

        const result: Modifier = {
            type: 'Modifier',
            name: modifier,
            value,
            exception,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset + modifierStart;
            result.end = baseOffset + modifierEnd;
        }

        return result;
    }

    /**
     * Generates a string from a modifier (serializes it).
     *
     * @param modifier Modifier to generate string from
     * @returns String representation of the modifier
     */
    public static generate(modifier: Modifier): string {
        let result = EMPTY;

        if (modifier.exception) {
            result += NEGATION_MARKER;
        }

        result += modifier.name.value;

        if (modifier.value !== undefined) {
            result += MODIFIER_ASSIGN_OPERATOR;
            result += modifier.value.value;
        }

        return result;
    }

    /**
     * Serializes a modifier node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: Modifier, buffer: OutputByteBuffer): void {
        // serialize "from left to right"
        const startOffset = buffer.byteOffset;

        if (node.end !== undefined) {
            buffer.writeUint32(node.end);
            buffer.writeUint8(1);
        }

        if (node.start !== undefined) {
            buffer.writeUint32(node.start);
            buffer.writeUint8(2);
        }

        buffer.writeUint8(node.exception === true ? 1 : 0);
        buffer.writeUint8(3);

        if (node.value !== undefined) {
            ValueParser.serialize(node.value, buffer);
            buffer.writeUint8(4);
        }

        ValueParser.serialize(node.name, buffer);
        buffer.writeUint8(5);

        buffer.writeUint32(buffer.byteOffset - startOffset); // value node length
        buffer.writeUint8(AST_TYPE_MAP.modifierNode); // value node type
    }

    /**
     * Deserializes a modifier node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Modifier>): void {
        // deserialize "from left to right"
        // check node type
        const type = buffer.readUint8();

        if (type !== AST_TYPE_MAP.modifierNode) {
            throw new Error(`Invalid node type: ${type}.`);
        }

        node.type = 'Modifier';
        node.exception = false;

        // read node length (node length within the buffer)
        const length = buffer.readUint32();
        const endOffset = buffer.byteOffset + 1;

        // read properties
        const startOffset = endOffset - length;
        while (buffer.byteOffset > startOffset) {
            const prop = buffer.readUint8();

            switch (prop) {
                case 1:
                    node.end = buffer.readUint32();
                    break;
                case 2:
                    node.start = buffer.readUint32();
                    break;
                case 3:
                    node.exception = buffer.readUint8() === 1;
                    break;
                case 4:
                    // FIXME: find better way to handle this
                    node.value = {} as Value;
                    ValueParser.deserialize(buffer, node.value);
                    break;
                case 5:
                    node.name = {} as Value;
                    ValueParser.deserialize(buffer, node.name);
                    break;
                default:
                    throw new Error(`Invalid node type: ${type}.`);
            }
        }
    }
}
