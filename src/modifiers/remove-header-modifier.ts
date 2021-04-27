import { IAdvancedModifier } from './advanced-modifier';

/**
 * Headers filtering modifier class.
 * Rules with $removeheader modifier are intended to remove headers from HTTP requests and responses.
 */
export class RemoveHeaderModifier implements IAdvancedModifier {
    /**
     * Value
     */
    private readonly value: string;

    /**
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        this.value = value;
    }

    /**
     * Modifier value
     */
    public getValue(): string {
        return this.value;
    }

    // TODO: Implement
}
