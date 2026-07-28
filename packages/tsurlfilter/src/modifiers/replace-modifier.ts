import { type IAdvancedModifier } from './advanced-modifier';
import { parseRegexSubstitution } from './parse-regex-substitution';

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
        const parsed = parseRegexSubstitution(value);

        this.replaceOption = parsed.optionText;
        this.replaceApply = parsed.apply;
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
