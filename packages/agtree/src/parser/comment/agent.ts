import valid from 'semver/functions/valid';
import coerce from 'semver/functions/coerce';
import { locRange } from '../../utils/location';
import { EMPTY, SPACE } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import {
    Agent,
    Location,
    Value,
    defaultLocation,
} from '../common';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';

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
export class AgentParser {
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
     * @param raw Raw rule
     * @param loc Base location
     * @returns Agent rule AST
     * @throws {AdblockSyntaxError} If the raw rule cannot be parsed as an adblock agent
     */
    public static parse(raw: string, loc: Location = defaultLocation): Agent {
        let offset = 0;

        // Save name start position
        const nameStartIndex = offset;
        let nameEndIndex = offset;

        // Prepare variables for name and version
        let name: Value | null = null;
        let version: Value | null = null;

        // Get agent parts by splitting it by spaces. The last part may be a version.
        // Example: "Adblock Plus 2.0"
        while (offset < raw.length) {
            // Skip whitespace before the part
            offset = StringUtils.skipWS(raw, offset);

            const partEnd = StringUtils.findNextWhitespaceCharacter(raw, offset);
            const part = raw.substring(offset, partEnd);

            if (AgentParser.isValidVersion(part)) {
                // Multiple versions aren't allowed
                if (version !== null) {
                    throw new AdblockSyntaxError(
                        'Duplicated versions are not allowed',
                        locRange(loc, offset, partEnd),
                    );
                }

                // Save name
                name = {
                    type: 'Value',
                    loc: locRange(loc, nameStartIndex, nameEndIndex),
                    value: raw.substring(nameStartIndex, nameEndIndex),
                };

                // Save version
                version = {
                    type: 'Value',
                    loc: locRange(loc, offset, partEnd),
                    value: part,
                };
            } else {
                nameEndIndex = partEnd;
            }

            // Skip whitespace after the part
            offset = StringUtils.skipWS(raw, partEnd);
        }

        // If we didn't find a version, the whole string is the name
        if (name === null) {
            name = {
                type: 'Value',
                loc: locRange(loc, nameStartIndex, nameEndIndex),
                value: raw.substring(nameStartIndex, nameEndIndex),
            };
        }

        // Agent name cannot be empty
        if (name.value.length === 0) {
            throw new AdblockSyntaxError(
                'Agent name cannot be empty',
                locRange(loc, 0, raw.length),
            );
        }

        return {
            type: 'Agent',
            loc: locRange(loc, 0, raw.length),
            adblock: name,
            version,
        };
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
}
