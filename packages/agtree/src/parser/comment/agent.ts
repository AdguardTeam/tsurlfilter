/* eslint-disable no-param-reassign */
import valid from 'semver/functions/valid';
import coerce from 'semver/functions/coerce';

import { NULL } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { BinaryTypeMap, type Agent, type Value } from '../../nodes';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { AdblockSyntax } from '../../utils/adblockers';
import { BaseParser } from '../interface';
import { defaultParserOptions } from '../options';
import { ValueParser } from '../misc/value';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum AgentNodeSerializationMap {
    Adblock = 1,
    Version,
    Start,
    End,
}

/**
 * Possible AdGuard agent markers.
 */
const ADG_NAME_MARKERS = new Set([
    'adguard',
    'adg',
]);

/**
 * Possible uBlock Origin agent markers.
 */
const UBO_NAME_MARKERS = new Set([
    'ublock',
    'ublock origin',
    'ubo',
]);

/**
 * Possible Adblock Plus agent markers.
 */
const ABP_NAME_MARKERS = new Set([
    'adblock',
    'adblock plus',
    'adblockplus',
    'abp',
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
const FREQUENT_AGENTS_DESERIALIZATION_MAP = new Map<number, string>([
    // AdGuard
    [0, 'AdGuard'],
    [1, 'ADG'],

    // uBlock Origin
    [2, 'uBlock Origin'],
    [3, 'uBlock'],
    [4, 'uBO'],

    // Adblock Plus
    [5, 'Adblock Plus'],
    [6, 'AdblockPlus'],
    [7, 'ABP'],
    [8, 'AdBlock'],
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
// FIXME
const FREQUENT_AGENTS_SERIALIZATION_MAP = new Map<string, number>(
    Array.from(FREQUENT_AGENTS_DESERIALIZATION_MAP).map(([key, value]) => [value.toLowerCase(), key]),
);

/**
 * Returns the adblock syntax based on the adblock name parsed from the agent type comment.
 * Needed for modifiers validation of network rules by AGLint.
 *
 * @param name Adblock name.
 *
 * @returns Adblock syntax.
 */
const getAdblockSyntax = (name: string): AdblockSyntax => {
    let syntax = AdblockSyntax.Common;
    const lowerCaseName = name.toLowerCase();
    if (ADG_NAME_MARKERS.has(lowerCaseName)) {
        syntax = AdblockSyntax.Adg;
    } else if (UBO_NAME_MARKERS.has(lowerCaseName)) {
        syntax = AdblockSyntax.Ubo;
    } else if (ABP_NAME_MARKERS.has(lowerCaseName)) {
        syntax = AdblockSyntax.Abp;
    }
    return syntax;
};

/**
 * `AgentParser` is responsible for parsing single adblock agent elements.
 *
 * @example
 * If the adblock agent rule is
 * ```adblock
 * [Adblock Plus 2.0; AdGuard]
 * ```
 * then the adblock agents are `Adblock Plus 2.0` and `AdGuard`, and this
 * class is responsible for parsing them. The rule itself is parsed by
 * `AgentCommentParser`, which uses this class to parse single agents.
 */
export class AgentParser extends BaseParser {
    /**
     * Checks if the string is a valid version.
     *
     * @param str String to check
     * @returns `true` if the string is a valid version, `false` otherwise
     */
    private static isValidVersion(str: string): boolean {
        return valid(coerce(str)) !== null;
    }

    /**
     * Parses a raw rule as an adblock agent comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Agent rule AST
     * @throws {AdblockSyntaxError} If the raw rule cannot be parsed as an adblock agent
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): Agent {
        let offset = 0;

        // Save name start position
        const nameStartIndex = offset;
        let nameEndIndex = offset;

        // Prepare variables for name and version
        let name: Value | undefined;
        let version: Value | undefined;
        // default value for the syntax
        let syntax: AdblockSyntax = AdblockSyntax.Common;

        // Get agent parts by splitting it by spaces. The last part may be a version.
        // Example: "Adblock Plus 2.0"
        while (offset < raw.length) {
            // Skip whitespace before the part
            offset = StringUtils.skipWS(raw, offset);

            const partEnd = StringUtils.findNextWhitespaceCharacter(raw, offset);
            const part = raw.slice(offset, partEnd);

            if (AgentParser.isValidVersion(part)) {
                if (!isUndefined(version)) {
                    throw new AdblockSyntaxError(
                        'Duplicated versions are not allowed',
                        baseOffset + offset,
                        baseOffset + partEnd,
                    );
                }

                const parsedNamePart = raw.slice(nameStartIndex, nameEndIndex);

                name = ValueParser.parse(parsedNamePart, options, baseOffset + nameStartIndex);
                version = ValueParser.parse(part, options, baseOffset + offset);
                syntax = getAdblockSyntax(parsedNamePart);
            } else {
                nameEndIndex = partEnd;
            }

            // Skip whitespace after the part
            offset = StringUtils.skipWS(raw, partEnd);
        }

        // If we didn't find a version, the whole string is the name
        if (isUndefined(name)) {
            const parsedNamePart = raw.slice(nameStartIndex, nameEndIndex);
            name = ValueParser.parse(parsedNamePart, options, baseOffset + nameStartIndex);
            syntax = getAdblockSyntax(parsedNamePart);
        }

        // Agent name cannot be empty
        if (name.value.length === 0) {
            throw new AdblockSyntaxError(
                'Agent name cannot be empty',
                baseOffset,
                baseOffset + raw.length,
            );
        }

        const result: Agent = {
            type: 'Agent',
            adblock: name,
            syntax,
        };

        // only add version if it's present
        if (version) {
            result.version = version;
        }

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    /**
     * Serializes an agent node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: Agent, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.AgentNode);

        buffer.writeUint8(AgentNodeSerializationMap.Adblock);
        ValueParser.serialize(node.adblock, buffer, FREQUENT_AGENTS_SERIALIZATION_MAP, true);

        if (!isUndefined(node.version)) {
            buffer.writeUint8(AgentNodeSerializationMap.Version);
            ValueParser.serialize(node.version, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(AgentNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(AgentNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes an agent node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Agent>): void {
        buffer.assertUint8(BinaryTypeMap.AgentNode);

        node.type = 'Agent';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case AgentNodeSerializationMap.Adblock:
                    ValueParser.deserialize(buffer, node.adblock = {} as Value, FREQUENT_AGENTS_DESERIALIZATION_MAP);
                    if (node.adblock) {
                        node.syntax = getAdblockSyntax(node.adblock.value);
                    }
                    break;

                case AgentNodeSerializationMap.Version:
                    ValueParser.deserialize(buffer, node.version = {} as Value);
                    break;

                case AgentNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case AgentNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
