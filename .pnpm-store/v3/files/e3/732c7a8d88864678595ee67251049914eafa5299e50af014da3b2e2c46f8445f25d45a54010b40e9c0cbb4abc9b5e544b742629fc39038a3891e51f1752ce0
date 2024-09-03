/**
 * Html rule wildcard
 */
export declare class Wildcard {
    private readonly regexp;
    private readonly shortcut;
    /**
     * Constructor
     *
     * @param pattern
     */
    constructor(pattern: string);
    /**
     * Returns 'true' if input text is matching wildcard.
     * This method first checking shortcut -- if shortcut exists in input string -- than it checks regexp.
     *
     * @param input Input string
     * @return boolean if input string matches wildcard
     */
    matches(input: string): boolean;
    /**
     * Converts wildcard to regular expression
     *
     * @param pattern The wildcard pattern to convert
     * @return string A regex equivalent of the given wildcard
     */
    private static wildcardToRegex;
    /**
     * Extracts longest string that does not contain * or ? symbols.
     *
     * @param pattern Wildcard pattern
     * @return Longest string without special symbols
     */
    private static extractShortcut;
}
