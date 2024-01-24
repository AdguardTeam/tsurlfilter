/* eslint-disable no-plusplus */
/* eslint-disable no-case-declarations */
import valid from 'semver/functions/valid';
import coerce from 'semver/functions/coerce';

import { EMPTY, SPACE } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { type Agent, type Value } from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { AdblockSyntax } from '../../utils/adblockers';
import { ParserBase } from '../interface';
import { defaultParserOptions } from '../options';
import { decoder, encoder } from '../../utils/text-encoder';

const TYPE_MAP: Record<string, number> = {
    Agent: 0,
};

const TYPE_MAP_REVERSE: Record<number, string> = {
    0: 'Agent',
};

const ADG_NAME_MARKERS = new Set([
    'adguard',
    'adg',
]);

const UBO_NAME_MARKERS = new Set([
    'ublock',
    'ublock origin',
    'ubo',
]);

const ABP_NAME_MARKERS = new Set([
    'adblock',
    'adblock plus',
    'adblockplus',
    'abp',
]);

/**
 * Returns the adblock syntax based on the adblock name
 * parsed from the agent type comment.
 * Needed for modifiers validation of network rules by AGLint.
 *
 * @param name Adblock name.
 *
 * @returns Adblock syntax.
 */
const getAdblockSyntax = (name: string): AdblockSyntax => {
    let syntax = AdblockSyntax.Common;
    if (ADG_NAME_MARKERS.has(name.toLowerCase())) {
        syntax = AdblockSyntax.Adg;
    } else if (UBO_NAME_MARKERS.has(name.toLowerCase())) {
        syntax = AdblockSyntax.Ubo;
    } else if (ABP_NAME_MARKERS.has(name.toLowerCase())) {
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
 * `AgentCommentRuleParser`, which uses this class to parse single agents.
 */
export class AgentParser extends ParserBase {
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
        let name: Value | null = null;
        let version: Value | null = null;
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
                // Multiple versions aren't allowed
                if (version !== null) {
                    throw new AdblockSyntaxError(
                        'Duplicated versions are not allowed',
                        baseOffset + offset,
                        baseOffset + partEnd,
                    );
                }

                const parsedNamePart = raw.slice(nameStartIndex, nameEndIndex);

                // Save name
                name = {
                    type: 'Value',
                    value: parsedNamePart,
                };

                if (options.isLocIncluded) {
                    name.start = baseOffset + nameStartIndex;
                    name.end = baseOffset + nameEndIndex;
                }

                // Save version
                version = {
                    type: 'Value',
                    value: part,
                };

                if (options.isLocIncluded) {
                    version.start = baseOffset + offset;
                    version.end = baseOffset + partEnd;
                }

                // Save syntax
                syntax = getAdblockSyntax(parsedNamePart);
            } else {
                nameEndIndex = partEnd;
            }

            // Skip whitespace after the part
            offset = StringUtils.skipWS(raw, partEnd);
        }

        // If we didn't find a version, the whole string is the name
        if (name === null) {
            const parsedNamePart = raw.slice(nameStartIndex, nameEndIndex);
            name = {
                type: 'Value',
                value: parsedNamePart,
            };

            if (options.isLocIncluded) {
                name.start = baseOffset + nameStartIndex;
                name.end = baseOffset + nameEndIndex;
            }

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
            version,
            syntax,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    /**
     * Converts an adblock agent AST to a string.
     *
     * @param ast Agent AST
     * @returns Raw string
     */
    public static generate(ast: Agent): string {
        let result = EMPTY;

        // Agent adblock name
        result += ast.adblock.value;

        // Agent adblock version (if present)
        if (ast.version !== null) {
            // Add a space between the name and the version
            result += SPACE;

            result += ast.version.value;
        }

        return result;
    }

    /**
     * Serializes an agent node to binary format.
     *
     * Node structure (from left to right):
     * - 1 byte - type
     * - n bytes - agent name
     * - 1 byte - size of agent name
     * - n bytes - agent version
     * - 1 byte - size of agent version
     *
     * @param node Node to serialize.
     * @returns Node serialized to binary format.
     */
    public static serialize(node: Agent): Uint8Array {
        const nameLength = node.adblock.value.length;
        const versionLength = node.version?.value?.length ?? 0;

        const bufferSize = 3 + nameLength + versionLength;
        const u8view = new Uint8Array(bufferSize);

        // encode from left to right
        let i = 0;

        // type
        u8view[i++] = TYPE_MAP[node.type];

        // name
        encoder.encodeInto(node.adblock.value, u8view.subarray(i, i + nameLength));
        i += nameLength;
        u8view[i++] = nameLength;

        // version
        if (node.version) {
            encoder.encodeInto(node.version.value, u8view.subarray(i));
            i += versionLength;
        }
        u8view[i++] = versionLength;

        return u8view;
    }

    /**
     * Deserializes an agent node from binary format.
     *
     * @param data Node serialized to binary format.
     * @returns Deserialized node.
     */
    public static deserialize(data: Uint8Array): Agent {
        // decode from right to left
        let i = data.length - 1;

        // read version
        const versionSize = data[i];
        const version = versionSize > 0
            ? decoder.decode(data.subarray(i - versionSize, i))
            : null;

        i -= versionSize + 1;

        // read name
        const nameSize = data[i];
        const name = decoder.decode(data.subarray(i - nameSize, i));

        i -= nameSize + 1;

        // read type
        const type = TYPE_MAP_REVERSE[data[i]];

        return {
            type,
            adblock: {
                type: 'Value',
                value: name,
            },
            version: version
                ? {
                    type: 'Value',
                    value: version,
                }
                : null,
            syntax: getAdblockSyntax(name),
        } as Agent;
    }
}
