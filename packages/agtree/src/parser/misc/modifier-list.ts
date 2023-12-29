import { MODIFIERS_SEPARATOR } from '../../utils/constants';
import { locRange, shiftLoc } from '../../utils/location';
import { StringUtils } from '../../utils/string';
import { type ModifierList } from '../common';
import { getParserOptions, type ParserOptions } from '../options';
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
     * @param options Parser options. See {@link ParserOptions}.
     * @returns Parsed modifiers interface
     */
    public static parse(raw: string, options: Partial<ParserOptions> = {}): ModifierList {
        const { baseLoc, isLocIncluded } = getParserOptions(options);

        const result: ModifierList = {
            type: 'ModifierList',
            children: [],
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, 0, raw.length);
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
                raw.substring(modifierStart, modifierEnd),
                {
                    isLocIncluded,
                    baseLoc: shiftLoc(baseLoc, modifierStart),
                },
            );

            result.children.push(modifier);

            // Increment the offset to the next modifier (or the end of the string)
            offset = separatorIndex === -1 ? raw.length : separatorIndex + 1;
        }

        // Check if there are any modifiers after the last separator
        if (separatorIndex !== -1) {
            const modifierStart = StringUtils.skipWS(raw, separatorIndex + 1);

            result.children.push(ModifierParser.parse(
                raw.substring(modifierStart, raw.length),
                {
                    isLocIncluded,
                    baseLoc: shiftLoc(baseLoc, modifierStart),
                },
            ));
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
