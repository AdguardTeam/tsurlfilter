import { AdblockSyntax } from '../../utils/adblockers';
import { REGEX_MARKER, StringUtils } from '../../utils/string';
import { ModifierListParser } from '../misc/modifier-list';
import {
    EMPTY,
    ESCAPE_CHARACTER,
    NETWORK_RULE_EXCEPTION_MARKER,
    NETWORK_RULE_EXCEPTION_MARKER_LEN,
    NETWORK_RULE_SEPARATOR,
} from '../../utils/constants';
import {
    ModifierList,
    NetworkRule,
    RuleCategory,
    Value,
    defaultLocation,
} from '../common';
import { locRange, shiftLoc } from '../../utils/location';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';

/**
 * `NetworkRuleParser` is responsible for parsing network rules.
 *
 * Please note that this will parse all syntactically correct network rules.
 * Modifier compatibility is not checked at the parser level.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#basic}
 */
export class NetworkRuleParser {
    /**
     * Parses a network rule (also known as basic rule).
     *
     * @param raw Raw rule
     * @param loc Location of the rule
     * @returns Network rule AST
     */
    public static parse(raw: string, loc = defaultLocation): NetworkRule {
        let offset = 0;

        // Skip leading whitespace
        offset = StringUtils.skipWS(raw, offset);

        // Handle exception rules
        let exception = false;

        // Rule starts with exception marker, eg @@||example.com,
        // where @@ is the exception marker
        if (raw.startsWith(NETWORK_RULE_EXCEPTION_MARKER, offset)) {
            offset += NETWORK_RULE_EXCEPTION_MARKER_LEN;
            exception = true;
        }

        // Save the start of the pattern
        const patternStart = offset;

        // Find corresponding (last) separator ($) character (if any)
        const separatorIndex = NetworkRuleParser.findNetworkRuleSeparatorIndex(raw);

        // Save the end of the pattern
        const patternEnd = separatorIndex === -1
            ? StringUtils.skipWSBack(raw) + 1
            : StringUtils.skipWSBack(raw, separatorIndex - 1) + 1;

        // Extract the pattern
        const pattern: Value = {
            type: 'Value',
            loc: locRange(loc, patternStart, patternEnd),
            value: raw.substring(patternStart, patternEnd),
        };

        // Parse modifiers (if any)
        let modifiers: ModifierList | undefined;

        // Find start and end index of the modifiers
        const modifiersStart = separatorIndex + 1;
        const modifiersEnd = StringUtils.skipWSBack(raw) + 1;

        if (separatorIndex !== -1) {
            modifiers = ModifierListParser.parse(
                raw.substring(modifiersStart, modifiersEnd),
                shiftLoc(loc, modifiersStart),
            );
        }

        // Throw error if there is no pattern and no modifiers
        if (pattern.value.length === 0 && (modifiers === undefined || modifiers.children.length === 0)) {
            throw new AdblockSyntaxError(
                'Network rule must have a pattern or modifiers',
                locRange(loc, 0, raw.length),
            );
        }

        return {
            type: 'NetworkRule',
            loc: locRange(loc, 0, raw.length),
            raws: {
                text: raw,
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception,
            pattern,
            modifiers,
        };
    }

    /**
     * Finds the index of the separator character in a network rule.
     *
     * @param rule Network rule to check
     * @returns The index of the separator character, or -1 if there is no separator
     */
    private static findNetworkRuleSeparatorIndex(rule: string): number {
        // As we are looking for the last separator, we start from the end of the string
        for (let i = rule.length - 1; i >= 0; i -= 1) {
            // If we find a potential separator, we should check
            // - if it's not escaped
            // - if it's not followed by a regex marker, for example: `example.org^$removeparam=/regex$/`
            // eslint-disable-next-line max-len
            if (rule[i] === NETWORK_RULE_SEPARATOR && rule[i + 1] !== REGEX_MARKER && rule[i - 1] !== ESCAPE_CHARACTER) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Converts a network rule (basic rule) AST to a string.
     *
     * @param ast - Network rule AST
     * @returns Raw string
     */
    public static generate(ast: NetworkRule): string {
        let result = EMPTY;

        // If the rule is an exception, add the exception marker: `@@||example.org`
        if (ast.exception) {
            result += NETWORK_RULE_EXCEPTION_MARKER;
        }

        // Add the pattern: `||example.org`
        result += ast.pattern.value;

        // If there are modifiers, add a separator and the modifiers: `||example.org$important`
        if (ast.modifiers && ast.modifiers.children.length > 0) {
            result += NETWORK_RULE_SEPARATOR;
            result += ModifierListParser.generate(ast.modifiers);
        }

        return result;
    }
}
