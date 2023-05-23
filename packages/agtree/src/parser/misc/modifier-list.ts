import { MODIFIERS_SEPARATOR } from '../../utils/constants';
import { locRange, shiftLoc } from '../../utils/location';
import { StringUtils } from '../../utils/string';
import { ModifierList, defaultLocation } from '../common';
import { ModifierParser } from './modifier';

/**
 * `ModifierListParser` is responsible for parsing modifier lists. Please note that the name is not
 * uniform, "modifiers" are also known as "options".
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers}
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#non-basic-rules-modifiers}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#options}
 */
export class ModifierListParser {
    /**
     * Parses the cosmetic rule modifiers, eg. `third-party,domain=example.com|~example.org`.
     *
     * _Note:_ you should remove `$` separator before passing the raw modifiers to this function,
     *  or it will be parsed in the first modifier.
     *
     * @param raw Raw modifier list
     * @param loc Location of the modifier list
     * @returns Parsed modifiers interface
     */
    public static parse(raw: string, loc = defaultLocation): ModifierList {
        const result: ModifierList = {
            type: 'ModifierList',
            loc: locRange(loc, 0, raw.length),
            children: [],
        };

        let offset = 0;

        // Skip whitespace before the modifier list
        offset = StringUtils.skipWS(raw, offset);

        // Split modifiers by unescaped commas
        while (offset < raw.length) {
            // Skip whitespace before the modifier
            offset = StringUtils.skipWS(raw, offset);

            const modifierStart = offset;

            // Find the index of the first unescaped "," character
            const separatorStartIndex = StringUtils.findNextUnescapedCharacter(raw, MODIFIERS_SEPARATOR, offset);

            const modifierEnd = separatorStartIndex === -1
                ? StringUtils.skipWSBack(raw) + 1
                : StringUtils.skipWSBack(raw, separatorStartIndex - 1) + 1;

            // Parse the modifier
            const modifier = ModifierParser.parse(
                raw.substring(modifierStart, modifierEnd),
                shiftLoc(loc, modifierStart),
            );

            result.children.push(modifier);

            // Increment the offset to the next modifier (or the end of the string)
            offset = separatorStartIndex === -1 ? raw.length : separatorStartIndex + 1;
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
}
