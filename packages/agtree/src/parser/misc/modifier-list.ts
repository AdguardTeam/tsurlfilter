/* eslint-disable no-param-reassign */
import { MODIFIERS_SEPARATOR, NULL, UINT16_MAX } from '../../utils/constants';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { StringUtils } from '../../utils/string';
import { BinaryTypeMap, Value, type Modifier, type ModifierList } from '../common';
import { ParserBase } from '../interface';
import { defaultParserOptions } from '../options';
import { ModifierParser } from './modifier';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { ValueParser } from './value';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum ModifierListNodeSerializationMap {
    Children = 1,
    Start,
    End,
}

const POSSIBLE_REGEX_MODIFIERS = new Set(['domain', 'app', 'url', 'path']);

/**
 * `ModifierListParser` is responsible for parsing modifier lists. Please note that the name is not
 * uniform, "modifiers" are also known as "options".
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers}
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#non-basic-rules-modifiers}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#options}
 */
export class ModifierListParser extends ParserBase {
    // private static tokenize(raw: string): string[] {


    /**
     * Parses the cosmetic rule modifiers, eg. `third-party,domain=example.com|~example.org`.
     *
     * _Note:_ you should remove `$` separator before passing the raw modifiers to this function,
     *  or it will be parsed in the first modifier.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Parsed modifiers interface
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ModifierList {
        const result: ModifierList = {
            type: 'ModifierList',
            children: [],
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        let offset = StringUtils.skipWS(raw);

        let separatorIndex = -1;

        // Split modifiers by unescaped commas
        while (offset < raw.length) {
            // Skip whitespace before the modifier
            offset = StringUtils.skipWS(raw, offset);

            const modifierStart = offset;
            let modifierNameStart = offset;

            // Get modifier name here
            // If modifier name is in a set, we should check for regex
            // If we check for regex, we need to check for = sign (assign operator), and if the value starts with /,
            // it's a regex, and we should continue until we find the closing /

            let exception = false;

            if (raw[offset] === '~') {
                exception = true;
                offset += 1;
                modifierNameStart += 1;
            }

            // consume until we find alphanumeric characters and _ and -
            while (offset < raw.length && raw[offset].match(/[a-zA-Z0-9_-]/)) {
                offset += 1;
            }

            const modifierName = ValueParser.parse(
                raw.slice(modifierNameStart, offset),
                options,
                baseOffset + modifierStart,
            );

            offset = StringUtils.skipWS(raw, offset);

            let modifierValue: Value | undefined;

            // next character should be an assign operator or a separator or the end of the string

            // if the next character is an assign operator, we should check if the modifier is a regex
            if (raw[offset] === '=') {
                if (POSSIBLE_REGEX_MODIFIERS.has(modifierName.value)) {
                    // if the modifier is a regex, we should continue until we find the closing /
                    offset += 1; // skip the =
                    offset = StringUtils.skipWS(raw, offset);
                    const valueStart = offset;
                    offset = StringUtils.findNextUnescapedCharacter(raw, '/', offset);

                    if (offset === -1) {
                        throw new Error(`Missing closing / at ${baseOffset + offset}`);
                    }

                    // skip the closing /
                    offset += 1;

                    modifierValue = ValueParser.parse(
                        raw.slice(valueStart, offset),
                        options,
                        baseOffset + valueStart,
                    );
                } else {
                    // its a regular modifier
                    offset += 1; // skip the =
                    offset = StringUtils.skipWS(raw, offset);
                    const valueStart = offset;
                    offset = StringUtils.findNextUnescapedCharacter(raw, MODIFIERS_SEPARATOR, offset);

                    if (offset === -1) {
                        offset = raw.length;
                    }

                    modifierValue = ValueParser.parse(
                        raw.slice(valueStart, offset),
                        options,
                        baseOffset + valueStart,
                    );
                }
            } else if (raw[offset] === MODIFIERS_SEPARATOR) {
                // if the next character is a separator, we should skip it
                offset += 1;
            } else if (offset < raw.length) {
                throw new Error(`Unexpected character at ${baseOffset + offset}`);
            }

            const modifierNode: Modifier = {
                type: 'Modifier',
                name: modifierName,
                value: modifierValue,
                exception,
            };

            if (options.isLocIncluded) {
                modifierNode.start = baseOffset + modifierStart;
                modifierNode.end = baseOffset + offset;
            }

            result.children.push(modifierNode);

            // Increment the offset to the next modifier (or the end of the string)
            offset = separatorIndex === -1 ? raw.length : separatorIndex + 1;
        }

        // Check if there are any modifiers after the last separator
        if (separatorIndex !== -1) {
            const modifierStart = StringUtils.skipWS(raw, separatorIndex + 1);

            result.children.push(
                ModifierParser.parse(
                    raw.slice(modifierStart, raw.length),
                    options,
                    baseOffset + modifierStart,
                ),
            );
        }

        return result;
    }

    /**
     * Converts a modifier list AST to a string.
     *
     * @param ast Modifier list AST
     * @returns Raw string
     */
    public static generate(ast: ModifierList): string {
        const result = ast.children
            .map(ModifierParser.generate)
            .join(MODIFIERS_SEPARATOR);

        return result;
    }

    /**
     * Serializes a modifier list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ModifierList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ModifierListNode);

        const count = node.children.length;
        if (count) {
            buffer.writeUint8(ModifierListNodeSerializationMap.Children);
            // note: we store the count, because re-construction of the array is faster if we know the length
            if (count > UINT16_MAX) {
                throw new Error(`Too many modifiers: ${count}, the limit is ${UINT16_MAX}`);
            }
            buffer.writeUint16(count);

            for (let i = 0; i < count; i += 1) {
                ModifierParser.serialize(node.children[i], buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ModifierListNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ModifierListNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a modifier list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: ModifierList): void {
        buffer.assertUint8(BinaryTypeMap.ModifierListNode);

        node.type = 'ModifierList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ModifierListNodeSerializationMap.Children:
                    node.children = new Array(buffer.readUint16());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        ModifierParser.deserialize(buffer, node.children[i] = {} as Modifier);
                    }
                    break;

                case ModifierListNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ModifierListNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
