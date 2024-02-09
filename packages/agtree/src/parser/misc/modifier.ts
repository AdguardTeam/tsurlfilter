/* eslint-disable no-param-reassign */
import {
    EMPTY,
    MODIFIER_ASSIGN_OPERATOR,
    NEGATION_MARKER,
    NULL,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { BinaryTypeMap, type Modifier, type Value } from '../common';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueParser } from './value';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { isUndefined } from '../../utils/common';

/**
 * Property map for binary serialization.
 */
const enum BinaryPropMap {
    Name = 1,
    Value,
    Exception,
    Start,
    End,
}

/**
 * Some values are very frequent and can be represented by a single byte.
 * This map is used to serialize and deserialize such values.
 */
const KNOWN_MODIFIERS = new Map<string, number>([
    ['1p', 0],
    ['3p', 1],
    ['all', 2],
    ['app', 3],
    ['badfilter', 4],
    ['cname', 5],
    ['content', 6],
    ['cookie', 7],
    ['csp', 8],
    ['css', 9],
    ['denyallow', 10],
    ['doc', 11],
    ['document', 12],
    ['domain', 13],
    ['ehide', 14],
    ['elemhide', 15],
    ['empty', 16],
    ['extension', 17],
    ['first-party', 18],
    ['font', 19],
    ['frame', 20],
    ['from', 21],
    ['genericblock', 22],
    ['generichide', 23],
    ['ghide', 24],
    ['header', 25],
    ['hls', 26],
    ['image', 27],
    ['important', 28],
    ['inline-font', 29],
    ['inline-script', 30],
    ['jsinject', 31],
    ['jsonprune', 32],
    ['match-case', 33],
    ['media', 34],
    ['method', 35],
    ['mp4', 36],
    ['network', 37],
    ['object', 38],
    ['object-subrequest', 39],
    ['other', 40],
    ['permissions', 41],
    ['ping', 42],
    ['popunder', 43],
    ['popup', 44],
    ['redirect', 45],
    ['redirect-rule', 46],
    ['referrerpolicy', 47],
    ['removeheader', 48],
    ['removeparam', 49],
    ['replace', 50],
    ['rewrite', 51],
    ['script', 52],
    ['shide', 53],
    ['specifichide', 54],
    ['stealth', 55],
    ['strict1p', 56],
    ['strict3p', 57],
    ['stylesheet', 58],
    ['subdocument', 59],
    ['third-party', 60],
    ['to', 61],
    ['urlblock', 62],
    ['webrtc', 63],
    ['websocket', 64],
    ['xhr', 65],
    ['xmlhttprequest', 66],
]);

/**
 * Reverse frequent values map.
 */
const KNOWN_MODIFIERS_REVERSE = new Map<number, string>(
    Array.from(KNOWN_MODIFIERS, ([key, value]) => [value, key]),
);

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
            modifier = ValueParser.parse(
                raw.slice(modifierNameStart, modifierEnd),
                options,
                baseOffset + modifierNameStart,
            );
        } else {
            // If there is an assignment operator, first we need to find the
            // end of the modifier name, then we can parse the value
            const modifierNameEnd = StringUtils.skipWSBack(raw, assignmentIndex - 1) + 1;

            modifier = ValueParser.parse(
                raw.slice(modifierNameStart, modifierNameEnd),
                options,
                baseOffset + modifierNameStart,
            );

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

            value = ValueParser.parse(
                raw.slice(valueStart, modifierEnd),
                options,
                baseOffset + valueStart,
            );
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
        buffer.writeUint8(BinaryTypeMap.ModifierNode);

        buffer.writeUint8(BinaryPropMap.Name);
        ValueParser.serialize(node.name, buffer, KNOWN_MODIFIERS);

        if (!isUndefined(node.value)) {
            buffer.writeUint8(BinaryPropMap.Value);
            ValueParser.serialize(node.value, buffer);
        }

        buffer.writeUint8(BinaryPropMap.Exception);
        buffer.writeUint8(node.exception ? 1 : 0);

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
     * Deserializes a modifier node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Modifier>): void {
        buffer.assertUint8(BinaryTypeMap.ModifierNode);
        node.type = 'Modifier';

        // read buffer until NULL
        let prop = buffer.readUint8();
        while (prop) {
            switch (prop) {
                case BinaryPropMap.Name:
                    ValueParser.deserialize(buffer, node.name = {} as Value, KNOWN_MODIFIERS_REVERSE);
                    break;
                case BinaryPropMap.Value:
                    ValueParser.deserialize(buffer, node.value = {} as Value);
                    break;
                case BinaryPropMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;
                case BinaryPropMap.Start:
                    node.start = buffer.readUint32();
                    break;
                case BinaryPropMap.End:
                    node.end = buffer.readUint32();
                    break;
                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
