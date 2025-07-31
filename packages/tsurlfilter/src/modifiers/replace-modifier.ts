import { SimpleRegex } from '../rules/simple-regex';
import { splitByDelimiterWithEscapeCharacter } from '../utils/string-utils';

import { type IAdvancedModifier } from './advanced-modifier';

/**
 * Replace modifier class.
 */
export class ReplaceModifier implements IAdvancedModifier {
    /**
     * Replace option value.
     */
    private readonly replaceOption: string;

    /**
     * Replace option apply function.
     */
    private readonly replaceApply: (input: string) => string;

    /**
     * Constructor.
     *
     * @param value Replace modifier value.
     */
    constructor(value: string) {
        const parsed = ReplaceModifier.parseReplaceOption(value);

        this.replaceOption = parsed.optionText;
        this.replaceApply = parsed.apply;
    }

    /**
     * Parses replace option.
     *
     * @param option Replace option.
     *
     * @returns Parsed replace option.
     */
    private static parseReplaceOption(option: string): { apply: (input: string) => string; optionText: string } {
        if (!option) {
            return {
                apply: (x: string): string => x,
                optionText: '',
            };
        }

        const parts = splitByDelimiterWithEscapeCharacter(option, '/', '\\', true);

        let modifiers = (parts[2] || '');
        if (modifiers.indexOf('g') < 0) {
            modifiers += 'g';
        }

        const pattern = new RegExp(parts[0], modifiers);

        // unescape replacement alias
        let replacement = parts[1].replace(/\\\$/g, '$');
        replacement = SimpleRegex.unescapeSpecials(replacement);

        const apply = (input: string): string => input.replace(pattern, replacement);

        return {
            apply,
            optionText: option,
        };
    }

    /**
     * Replace content.
     *
     * @returns The replace option value.
     */
    public getValue(): string {
        return this.replaceOption;
    }

    /**
     * Replace apply function.
     *
     * @returns The function to apply the replacement.
     */
    public getApplyFunc(): (input: string) => string {
        return this.replaceApply;
    }
}
