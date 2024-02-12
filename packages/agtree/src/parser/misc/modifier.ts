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
 *
 * @note Only 256 values can be represented this way.
 */
const KNOWN_MODIFIERS = new Map<string, number>([
    ['_', 0],
    ['all', 1],
    ['app', 2],
    ['badfilter', 3],
    ['cname', 4],
    ['content', 5],
    ['cookie', 6],
    ['csp', 7],
    ['denyallow', 8],
    ['document', 9],
    ['doc', 10],
    ['domain', 11],
    ['from', 12],
    ['elemhide', 13],
    ['ehide', 14],
    ['empty', 15],
    ['first-party', 16],
    ['1p', 17],
    ['extension', 18],
    ['font', 19],
    ['genericblock', 20],
    ['generichide', 21],
    ['ghide', 22],
    ['header', 23],
    ['hls', 24],
    ['image', 25],
    ['important', 26],
    ['inline-font', 27],
    ['inline-script', 28],
    ['jsinject', 29],
    ['jsonprune', 30],
    ['match-case', 31],
    ['media', 32],
    ['method', 33],
    ['mp4', 34],
    ['network', 35],
    ['object-subrequest', 36],
    ['object', 37],
    ['other', 38],
    ['permissions', 39],
    ['ping', 40],
    ['popunder', 41],
    ['popup', 42],
    ['redirect-rule', 43],
    ['redirect', 44],
    ['rewrite', 45],
    ['referrerpolicy', 46],
    ['removeheader', 47],
    ['removeparam', 48],
    ['replace', 49],
    ['script', 50],
    ['specifichide', 51],
    ['shide', 52],
    ['stealth', 53],
    ['strict1p', 54],
    ['strict3p', 55],
    ['stylesheet', 56],
    ['css', 57],
    ['subdocument', 58],
    ['frame', 59],
    ['third-party', 60],
    ['3p', 61],
    ['to', 62],
    ['urlblock', 63],
    ['webrtc', 64],
    ['websocket', 65],
    ['xmlhttprequest', 66],
    ['xhr', 67],
    // TODO: add new modifiers here
]);

/**
 * Reverse frequent values map.
 */
const KNOWN_MODIFIERS_REVERSE = new Map<number, string>(
    Array.from(KNOWN_MODIFIERS, ([key, value]) => [value, key]),
);

/**
 * Some values are very frequent and can be represented by a single byte.
 * This map is used to serialize and deserialize such values.
 *
 * @note Only 256 values can be represented this way.
 */
const KNOWN_MODIFIER_VALUES = new Map<string, number>([
    ['noopjs', 0],
]);

/**
 * Reverse frequent values map.
 */
const KNOWN_MODIFIER_VALUES_REVERSE = new Map<number, string>(
    Array.from(KNOWN_MODIFIER_VALUES, ([key, value]) => [value, key]),
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
            ValueParser.serialize(node.value, buffer, KNOWN_MODIFIER_VALUES);
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
                    ValueParser.deserialize(buffer, node.value = {} as Value, KNOWN_MODIFIER_VALUES_REVERSE);
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
