import { IAdvancedModifier } from './advanced-modifier';

/**
 * Permitted/restricted values modifier
 */
export interface IValuesModifier extends IAdvancedModifier {
    /**
     * Permitted values
     */
    getPermitted(): string[] | null;

    /**
     * Restricted values
     */
    getRestricted(): string[] | null;

    /**
     * Checks if value matches this modifier
     *
     * @param value
     */
    match(value: string): boolean;
}

/**
 * This is the base class representing double values modifiers
 */
export class BaseValuesModifier implements IValuesModifier {
    /** list of permitted values or null */
    protected permitted: string[] | null;

    /** list of restricted values or null */
    protected restricted: string[] | null;

    /**
     * Value
     */
    private readonly value: string;

    /**
     * Separator between values
     */
    protected SEPARATOR = '|';

    /**
     * Parses the values string
     *
     * @param values - values string
     *
     * @throws an error if the string is empty or invalid
     */
    constructor(values: string) {
        if (!values) {
            throw new SyntaxError('Modifier cannot be empty');
        }

        this.value = values;

        const permittedValues: string[] = [];
        const restrictedValues: string[] = [];

        const parts = values.split(this.SEPARATOR);
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

    getPermitted(): string[] | null {
        return this.permitted;
    }

    getRestricted(): string[] | null {
        return this.restricted;
    }

    getValue(): string {
        return this.value;
    }

    match(value: string): boolean {
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
