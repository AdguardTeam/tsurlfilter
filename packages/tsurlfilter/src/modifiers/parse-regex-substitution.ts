import { SimpleRegex } from '../rules/simple-regex';
import { splitByDelimiterWithEscapeCharacter } from '../utils/string-utils';

/**
 * Result of parsing a `/regexp/replacement/flags` option string.
 */
export interface RegexSubstitution {
    /**
     * The compiled replacement function.
     */
    apply: (input: string) => string;

    /**
     * The raw option text.
     */
    optionText: string;
}

/**
 * Parses a `/regexp/replacement/flags` option string into a compiled
 * replacement function.  Shared by `$replace` and `$urltransform`.
 *
 * - The `g` (global) flag is added automatically when not present.
 * - `\$` in the replacement is unescaped to `$`.
 * - Special characters are unescaped via {@link SimpleRegex.unescapeSpecials}.
 *
 * @param option Raw option value (e.g. `/regex/replacement/flags`).
 *
 * @returns Parsed substitution with an apply function and the original text.
 */
export function parseRegexSubstitution(option: string): RegexSubstitution {
    if (!option) {
        return {
            apply: (x: string): string => x,
            optionText: '',
        };
    }

    const parts = splitByDelimiterWithEscapeCharacter(option, '/', '\\', true);

    let flagsStr = parts[2] || '';
    if (flagsStr.indexOf('g') < 0) {
        flagsStr += 'g';
    }

    const pattern = new RegExp(parts[0], flagsStr);

    // unescape replacement alias
    let replacement = parts[1].replace(/\\\$/g, '$');
    replacement = SimpleRegex.unescapeSpecials(replacement);

    const apply = (input: string): string => input.replace(pattern, replacement);

    return { apply, optionText: option };
}
