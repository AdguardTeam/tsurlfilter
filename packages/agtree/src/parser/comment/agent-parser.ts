import { StringUtils } from '../../utils/string.js';
import { type Agent, type Value } from '../../nodes/index.js';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { BaseParser } from '../base-parser.js';
import { defaultParserOptions } from '../options.js';
import { ValueParser } from '../misc/value-parser.js';
import { isUndefined } from '../../utils/type-guards.js';
import { getAdblockSyntax } from '../../common/agent-common.js';

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
     * Regex to match a version inside a string.
     */
    private static readonly VERSION_REGEX = /\b\d+\.\d+(\.\d+)?\b/;

    /**
     * Checks if the string is a valid version.
     *
     * The string can have a version in formats like
     * [Adblock Plus 2.0], or [Adblock Plus 3.1; AdGuard].
     *
     * @param str String to check
     * @returns `true` if the string is a valid version, `false` otherwise
     */
    private static isValidVersion(str: string): boolean {
        // Check if the string contains a valid version pattern
        return AgentParser.VERSION_REGEX.test(str);
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
}
