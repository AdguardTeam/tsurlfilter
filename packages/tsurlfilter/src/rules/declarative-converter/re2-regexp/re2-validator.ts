import { regexValidatorExtension } from './regex-validator-extension';

/**
 * Type definition for the validator function.
 * The function takes a regex pattern as input and returns a promise that resolves to a boolean
 * indicating whether the regex is supported or not.
 * The function may throw an error if the regex validation fails.
 */
type ValidatorFunction = (regexFilter: string) => Promise<boolean>;

/**
 * Class to manage regex validation using a customizable validator function.
 * By default, it uses the Chrome validator, but a custom validator can be set.
 */
class Re2Validator {
    /**
     * The default validator function.
     * By default, it uses the builtin browser validator.
     */
    private validator: ValidatorFunction = regexValidatorExtension;

    /**
     * Set a custom validator function.
     *
     * @param validator - The custom validator function to use.
     */
    public setValidator(validator: ValidatorFunction): void {
        this.validator = validator;
    }

    /**
     * Check if the regex is supported using the current validator function.
     *
     * @param regexFilter - The regex pattern to validate.
     * @returns A promise that resolves to true if the regex is supported, false otherwise.
     */
    public async isRegexSupported(regexFilter: string): Promise<boolean> {
        return this.validator(regexFilter);
    }
}

/**
 * Singleton instance of the Re2Validator class.
 * Provides a single point of access to manage regex validation.
 */
export const re2Validator = new Re2Validator();
