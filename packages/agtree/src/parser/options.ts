/**
 * @file Common options for all parsers.
 */

/**
 * Common options for all parsers.
 */
export interface ParserOptions {
    /**
     * If `true`, then the parser will not throw an error if the rule is syntactically invalid, instead it will
     * return an `InvalidRule` object with the error attached to it.
     */
    tolerant?: boolean;

    /**
     * Whether to include location information in the AST nodes.
     */
    isLocIncluded?: boolean;

    /**
     * Whether to parse AdBlock-specific rules.
     */
    parseAbpSpecificRules?: boolean;

    /**
     * Whether to parse uBlock Origin-specific rules.
     */
    parseUboSpecificRules?: boolean;

    /**
     * Whether to parse raw parts.
     */
    includeRaws?: boolean;

    /**
     * Whether to ignore comment-rules.
     */
    ignoreComments?: boolean;

    /**
     * Whether to parse host rules.
     */
    parseHostRules?: boolean;
}

/**
 * Default parser options.
 */
export const defaultParserOptions: ParserOptions = Object.freeze({
    tolerant: false,
    isLocIncluded: true,
    parseAbpSpecificRules: true,
    parseUboSpecificRules: true,
    includeRaws: true,
    ignoreComments: false,
    parseHostRules: false,
});
