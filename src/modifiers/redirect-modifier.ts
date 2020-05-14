import { IAdvancedModifier } from './advanced-modifier';

/**
 * Redirect modifier class
 */
export class RedirectModifier implements IAdvancedModifier {
    /**
     * Value
     */
    private readonly redirectValue: string;

    /**
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        this.redirectValue = value;
    }

    /**
     * Csp directive
     */
    getValue(): string {
        return this.redirectValue;
    }
}
