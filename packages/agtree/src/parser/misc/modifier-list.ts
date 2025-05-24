/* eslint-disable no-param-reassign */
import { MODIFIERS_SEPARATOR } from '../../utils/constants.js';
import { StringUtils } from '../../utils/string.js';
import { type ModifierList } from '../../nodes/index.js';
import { BaseParser } from '../base-parser.js';
import { defaultParserOptions } from '../options.js';
import { ModifierParser } from './modifier-parser.js';

/**
 * `ModifierListParser` is responsible for parsing modifier lists. Please note that the name is not
 * uniform, "modifiers" are also known as "options".
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers}
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#non-basic-rules-modifiers}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#options}
 */
export class ModifierListParser extends BaseParser {
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
                raw.slice(modifierStart, modifierEnd),
                options,
                baseOffset + modifierStart,
            );

            result.children.push(modifier);

            // Increment the offset to the next modifier (or the end of the string)
            offset = separatorIndex === -1 ? raw.length : separatorIndex + 1;
        }

        // Check if there are any modifiers after the last separator
        if (separatorIndex !== -1) {
            const modifierStart = StringUtils.skipWS(raw, separatorIndex + 1);

            result.children.push(
                ModifierParser.parse(
                    raw.slice(modifierStart, raw.length),
                    options,
                    baseOffset + modifierStart,
                ),
            );
        }

        return result;
    }
}
