/**
 * Interface that represents options for the converter.
 */
export interface ConverterOptions {
    /**
     * Path to web accessible resources, relative to the extension root dir.
     * Should start with leading slash and should not end with trailing slash (`'/'`).
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

/**
 * Interface that represents implementation of a filter.
 */
export interface Filter {
    /**
     * The filter ID.
     */
    id: number;

    /**
     * The filter content as a string.
     */
    content: string;
}
