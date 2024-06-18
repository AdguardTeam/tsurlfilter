/* eslint-disable no-param-reassign */
import {
    COMMA,
    MODIFIERS_SEPARATOR,
    MODIFIER_ASSIGN_OPERATOR,
    NULL,
    REGEX_MARKER,
    UINT16_MAX,
} from '../../utils/constants';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { StringUtils } from '../../utils/string';
import { BinaryTypeMap, type Modifier, type ModifierList } from '../common';
import { ParserBase } from '../interface';
import { defaultParserOptions } from '../options';
import { ModifierParser } from './modifier';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';

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

/**
 * List of modifier names where the value is / can be a regex.
 * These modifiers require special handling while tokenizing the modifier list.
 */
const POSSIBLE_REGEX_MODIFIERS = new Set([
    'domain',
    'app',
    'url',
    'path',
]);

/**
 * Utility function to skip modifiers whose values is / can be a regex, like domain=/example.(com|org)/.
 *
 * @param input Input string.
 * @param offset Starting offset.
 * @returns The offset after the regex modifier or the original offset if no regex modifier is found
 *          at the given offset.
 */
const skipRegexModifier = (input: string, offset: number): number => {
    let i = offset;

    // Obtain modifier name by consuming all valid modifier name characters
    while (i < input.length && input[i].match(/[a-zA-Z0-9_-]/)) {
        i += 1;
    }

    const name = input.slice(offset, i);

    // If the found sequence is not a possible modifier name, then no need to continue
    if (!POSSIBLE_REGEX_MODIFIERS.has(name)) {
        return offset;
    }

    // Skip possible whitespace after the modifier name
    i = StringUtils.skipWS(input, i);

    // If the next character is not an equal sign, then no need to continue
    // We expect modifiers to have a value, so if there is no value, then it is not a regex modifier
    if (input[i] !== MODIFIER_ASSIGN_OPERATOR) {
        return offset;
    }

    // Skip the equal sign
    i += 1;

    // Skip possible whitespace after the equal sign
    i = StringUtils.skipWS(input, i);

    // If the next character is not a slash, then no need to continue, because regex values should start with a slash
    if (input[i] !== REGEX_MARKER) {
        return offset;
    }

    // $path modifier needs special handling, because its value can be a regex or a path,
    // e.g. $path=/foo/bar or $path=/regex/
    // (but the value starts with a slash in both cases)
    if (name === 'path') {
        i += 1;
        const nextSlash = StringUtils.findNextUnescapedCharacter(input, REGEX_MARKER, i);

        if (nextSlash === -1) {
            // $path is used without regex value
            return offset;
        }

        // If we find a slash, we should handle this case:
        // [$path=/page.html,domain=/example/]##.ad
        //                          ^ next slash is a part of the next modifier
        //
        // It's a rare case, so its ok to use a bit heavier logic here
        const regex = new RegExp(
            // pattern: <possible-regexp-modifier><ws*>=<ws*>/, like domain=/ or domain = /
            String.raw`${Array.from(POSSIBLE_REGEX_MODIFIERS).join('|')}\s*=\s*/`,
        );

        const nextPossibleModifierIndex = input.slice(i).search(regex);

        if (nextPossibleModifierIndex !== -1 && nextPossibleModifierIndex < nextSlash) {
            // $path is used without regex value, like $path=/foo/bar,domain=/example.(com|org)/
            return offset;
        }

        // Skip spaces after the slash
        i = StringUtils.skipWS(input, nextSlash + 1);

        // Slash should be followed by a modifier separator or the end of the input
        // This is needed, because if our input is $path=/foo/bar, then the value continues after the slash
        //                                                   ^ do not stop here
        if (i === input.length || input[i] === COMMA) {
            return nextSlash + 1;
        }
    }

    // Skip the slash
    i += 1;
    // Find the next unescaped slash
    i = StringUtils.findNextUnescapedCharacter(input, REGEX_MARKER, i);

    // If we don't find a closing slash, then no need to continue, because it is not a regex modifier
    if (i === -1) {
        return offset;
    }

    // Return the index after the closing slash
    return i + 1;
};

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

        const lastNonWS = StringUtils.skipWSBack(raw, raw.length - 1);
        if (raw[lastNonWS] === MODIFIERS_SEPARATOR) {
            throw new AdblockSyntaxError(
                'Modifier list cannot end with a separator',
                baseOffset + lastNonWS,
                baseOffset + raw.length,
            );
        }

        if (offset === lastNonWS) {
            throw new AdblockSyntaxError(
                'Modifier list cannot be empty',
                baseOffset,
                baseOffset + raw.length,
            );
        }

        // Split modifiers by unescaped commas
        while (offset < raw.length) {
            offset = StringUtils.skipWS(raw, offset);

            if (offset === raw.length) {
                break;
            }

            const modifierStartIndex = offset;
            let modifierEndIndex = -1;

            const regexModifierEnd = skipRegexModifier(raw, offset);

            if (regexModifierEnd > offset) {
                // Special regex modifier
                modifierEndIndex = regexModifierEnd;
            } else {
                // Regular modifier
                const separatorIndex = StringUtils.findNextUnescapedCharacter(raw, MODIFIERS_SEPARATOR, offset);
                modifierEndIndex = separatorIndex === -1 ? raw.length : separatorIndex;
            }

            result.children.push(
                ModifierParser.parse(
                    raw.slice(modifierStartIndex, StringUtils.skipWSBack(raw, modifierEndIndex - 1) + 1),
                    options,
                    baseOffset + modifierStartIndex,
                ),
            );

            // +1 to skip the comma
            offset = modifierEndIndex + 1;
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
