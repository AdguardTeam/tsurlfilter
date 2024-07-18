/**
 * @file CSS validation result.
 */

/**
 * Result of a CSS validation.
 */
export interface CssValidationResult {
    /**
     * `true` if the CSS has passed validation, `false` otherwise.
     *
     * @note This is a basic validation for the most necessary things, it does not guarantee that the CSS is completely
     * valid.
     */
    isValid: boolean;

    /**
     * `true` if CSS contains Extended CSS elements, `false` otherwise.
     */
    isExtendedCss: boolean;

    /**
     * Error message if the CSS is not valid.
     */
    errorMessage?: string;
}
