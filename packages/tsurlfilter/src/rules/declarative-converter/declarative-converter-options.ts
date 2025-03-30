/**
 * Describes the constraints with the maximum number of rules
 * and specifies the path to web accessible resources.
 */
export interface DeclarativeConverterOptions {
    /**
     * Path to web accessible resources, relative to the extension root dir.
     * Should start with leading slash '/'.
     */
    resourcesPath?: string;

    /**
     * Maximum number of converted rules.
     */
    maxNumberOfRules?: number;

    /**
     * Maximum number of converted unsafe dynamic rules. AG-33779.
     */
    maxNumberOfUnsafeRules?: number;

    /**
     * Maximum number of converted rules with regexps.
     */
    maxNumberOfRegexpRules?: number;
}
