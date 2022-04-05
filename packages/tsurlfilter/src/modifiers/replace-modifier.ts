import * as utils from '../utils/utils';
import { IAdvancedModifier } from './advanced-modifier';

/**
 * Replace modifier class
 */
export class ReplaceModifier implements IAdvancedModifier {
    /**
     * Replace option value
     */
    private readonly replaceOption: string;

    /**
     * Replace option apply func
     */
    private readonly replaceApply: (input: string) => string;

    /**
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        const parsed = ReplaceModifier.parseReplaceOption(value);

        this.replaceOption = parsed.optionText;
        this.replaceApply = parsed.apply;
    }

    /**
     *
     * @param option
     */
    private static parseReplaceOption(option: string): { apply: (input: string) => string; optionText: string } {
        if (!option) {
            return {
                apply: (x: string): string => x,
                optionText: '',
            };
        }

        const parts = utils.splitByDelimiterWithEscapeCharacter(option, '/', '\\', true);

        if (parts.length < 2 || parts.length > 3) {
            throw new Error(`Cannot parse ${option}`);
        }

        let modifiers = (parts[2] || '');
        if (modifiers.indexOf('g') < 0) {
            modifiers += 'g';
        }

        const pattern = new RegExp(parts[0], modifiers);

        // unescape replacement alias
        const replacement = parts[1].replace(/\\\$/g, '$');

        const apply = (input: string): string => input.replace(pattern, replacement);

        return {
            apply,
            optionText: option,
        };
    }

    /**
     * Replace content
     */
    getValue(): string {
        return this.replaceOption;
    }

    /**
     * Replace apply function
     */
    getApplyFunc(): (input: string) => string {
        return this.replaceApply;
    }
}
