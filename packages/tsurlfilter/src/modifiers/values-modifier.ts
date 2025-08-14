import { SEPARATOR } from '../common/constants';

import { type IAdvancedModifier } from './advanced-modifier';

/**
 * Permitted/restricted values modifier.
 */
export interface IValuesModifier extends IAdvancedModifier {
    /**
     * Permitted values.
     */
    getPermitted(): string[] | null;

    /**
     * Restricted values.
     */
    getRestricted(): string[] | null;

    /**
     * Checks if value matches this modifier.
     *
     * @param value
     */
    match(value: string): boolean;
}

/**
 * This is the base class representing double values modifiers.
 */
export class BaseValuesModifier implements IValuesModifier {
    /**
     * List of permitted values or null.
     */
    protected permitted: string[] | null;

    /**
     * List of restricted values or null.
     */
    protected restricted: string[] | null;

    /**
     * Value.
     */
    private readonly value: string;

    /**
     * Parses the values string.
     *
     * @param values Values string.
     *
     * @throws An error if the string is empty or invalid.
     */
    constructor(values: string) {
        if (!values) {
            throw new SyntaxError('Modifier cannot be empty');
        }

        this.value = values;

        const permittedValues: string[] = [];
        const restrictedValues: string[] = [];

        const parts = values.split(SEPARATOR);
        for (let i = 0; i < parts.length; i += 1) {
            let app = parts[i];
            let restricted = false;
            if (app.startsWith('~')) {
                restricted = true;
                app = app.substring(1).trim();
            }

            if (app === '') {
                throw new SyntaxError(`Empty values specified in "${values}"`);
            }

            if (restricted) {
                restrictedValues.push(app);
            } else {
                permittedValues.push(app);
            }
        }

        this.restricted = restrictedValues.length > 0 ? restrictedValues : null;
        this.permitted = permittedValues.length > 0 ? permittedValues : null;
    }

    /**
     * Gets list of permitted values.
     *
     * @returns List of permitted values or null if none.
     */
    public getPermitted(): string[] | null {
        return this.permitted;
    }

    /**
     * Gets list of restricted values.
     *
     * @returns List of restricted values or null if none.
     */
    public getRestricted(): string[] | null {
        return this.restricted;
    }

    /**
     * Gets value.
     *
     * @returns Value.
     */
    public getValue(): string {
        return this.value;
    }

    /**
     * Checks if value matches this modifier.
     *
     * @param value Value to check.
     *
     * @returns True if value matches this modifier, false otherwise.
     */
    public match(value: string): boolean {
        if (!this.restricted && !this.permitted) {
            return true;
        }

        if (this.restricted && this.restricted.includes(value)) {
            return false;
        }

        if (this.permitted) {
            return this.permitted.includes(value);
        }

        return true;
    }
}
