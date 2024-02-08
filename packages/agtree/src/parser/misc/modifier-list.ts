/* eslint-disable no-param-reassign */
import { inspect } from 'util';
import { ByteBuffer } from '../../utils/byte-buffer';
import { MODIFIERS_SEPARATOR } from '../../utils/constants';
import { InputByteBuffer } from '../../utils/input-byte-buffer';
import { OutputByteBuffer } from '../../utils/output-byte-buffer';
import { StringUtils } from '../../utils/string';
import { AST_TYPE_MAP, type Modifier, type ModifierList } from '../common';
import { ParserBase } from '../interface';
import { defaultParserOptions } from '../options';
import { ModifierParser } from './modifier';

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

        for (const child of node.children) {
            ModifierParser.serialize(child, buffer);
        }
        buffer.writeUint32(node.children.length);
        buffer.writeUint8(3);

        buffer.writeUint32(buffer.byteOffset - startOffset + 1); // modifier list length
        buffer.writeUint8(AST_TYPE_MAP.modifierListNode); // modifier list type
    }

    /**
     * Deserializes a modifier list AST from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: ModifierList): void {
        // deserialize "from right to left"
        const endOffset = buffer.byteOffset;

        // check node type
        const type = buffer.readUint8();

        if (type !== AST_TYPE_MAP.modifierListNode) {
            throw new Error(`Invalid node type: ${type}.`);
        }

        node.type = 'ModifierList';

        // read node length (node length within the buffer)
        const length = buffer.readUint32();

        // read properties
        const startOffset = endOffset - length;
        while (buffer.byteOffset > startOffset) {
            // read property type
            const prop = buffer.readUint8();

            switch (prop) {
                case 1:
                    node.end = buffer.readUint32();
                    break;
                case 2:
                    node.start = buffer.readUint32();
                    break;
                case 3:
                    node.children = new Array(buffer.readUint32());
                    for (let i = 0; i < node.children.length; i += 1) {
                        node.children[i] = {} as Modifier;
                        ModifierParser.deserialize(buffer, node.children[i]);
                    }
                    break;
                default:
                    throw new Error(`Invalid property type: ${prop}.`);
            }
        }
    }
}

// FIXME: remove this
const node = ModifierListParser.parse('third-party,domain=example.com|~example.org', {
    isLocIncluded: false,
});
console.log(inspect(node, false, null, true));
const buffer = new ByteBuffer();
ModifierListParser.serialize(node, new OutputByteBuffer(buffer));
const deserializedNode = {} as ModifierList;
ModifierListParser.deserialize(new InputByteBuffer(buffer), deserializedNode);
console.log(inspect(deserializedNode, false, null, true));

console.log(buffer.byteOffset);
