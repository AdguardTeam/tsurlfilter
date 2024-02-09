/* eslint-disable no-param-reassign */
import { inspect } from 'util';

import { MODIFIERS_SEPARATOR, NULL } from '../../utils/constants';
import { InputByteBuffer } from '../../utils/input-byte-buffer';
import { OutputByteBuffer } from '../../utils/output-byte-buffer';
import { StringUtils } from '../../utils/string';
import { BinaryTypeMap, type Modifier, type ModifierList } from '../common';
import { ParserBase } from '../interface';
import { defaultParserOptions } from '../options';
import { ModifierParser } from './modifier';
import { isUndefined } from '../../utils/common';

/**
 * Property map for binary serialization.
 */
const enum BinaryPropMap {
    Children = 1,
    Start,
    End,
}

/**
 * `ModifierListParser` is responsible for parsing modifier lists. Please note that the name is not
 * uniform, "modifiers" are also known as "options".
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers}
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#non-basic-rules-modifiers}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#options}
 */
export class ModifierListParser extends ParserBase {
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

            // Find the index of the first unescaped comma
            separatorIndex = StringUtils.findNextUnescapedCharacter(raw, MODIFIERS_SEPARATOR, offset);

            const modifierEnd = separatorIndex === -1
                ? raw.length
                : StringUtils.skipWSBack(raw, separatorIndex - 1) + 1;

            // Parse the modifier
            const modifier = ModifierParser.parse(
                raw.slice(modifierStart, modifierEnd),
                options,
                baseOffset + modifierStart,
            );

            result.children.push(modifier);

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
     * Serializes a modifier list AST to binary format.
     *
     * @param node AST to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ModifierList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ModifierListNode);

        const count = node.children.length;
        if (count) {
            // FIXME
            buffer.writeUint8(BinaryPropMap.Children);
            buffer.writeUint32(count);

            for (let i = 0; i < count; i += 1) {
                ModifierParser.serialize(node.children[i], buffer);
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
     * Deserializes a modifier list AST from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: ModifierList): void {
        const type = buffer.readUint8();

        if (type !== BinaryTypeMap.ModifierListNode) {
            throw new Error(`Not a modifier list node: ${type}.`);
        }

        node.type = 'ModifierList';

        let prop = buffer.readUint8();

        // while prop is not undefined or NULL (0)
        while (prop) {
            switch (prop) {
                case BinaryPropMap.Children:
                    node.children = new Array(buffer.readUint32());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        ModifierParser.deserialize(buffer, node.children[i] = {} as Modifier);
                    }
                    break;
                case BinaryPropMap.Start:
                    node.start = buffer.readUint32();
                    break;
                case BinaryPropMap.End:
                    node.end = buffer.readUint32();
                    break;
                default:
                    throw new Error(`Invalid property type: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}

// FIXME: remove this
const node = ModifierListParser.parse('~third-party,domain=example.com|~example.org,script', {
    isLocIncluded: true,
});
const outBuffer = new OutputByteBuffer();
ModifierListParser.serialize(node, outBuffer);
console.log(outBuffer.offset);
console.log(outBuffer.byteBuffer.chunks[0].slice(0, 100));
const inBuffer = new InputByteBuffer(outBuffer.byteBuffer.chunks);
const newNode = {} as ModifierList;
ModifierListParser.deserialize(inBuffer, newNode);
console.log(inspect(newNode, false, null, true));
console.log(ModifierListParser.generate(newNode));
