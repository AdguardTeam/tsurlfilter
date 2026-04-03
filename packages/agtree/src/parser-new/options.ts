/**
 * @file Parser options shared across all AST parsers.
 */

/**
 * Options for the AST parser.
 */
export interface PreparserParseOptions {
    /**
     * Whether to include source location info (start/end) on AST nodes.
     */
    isLocIncluded?: boolean;

    /**
     * Whether to include raw text on the root node.
     */
    includeRaws?: boolean;

    /**
     * Whether to parse uBlock Origin-specific rules (uBO modifiers in cosmetic rules).
     * Defaults to `true`.
     */
    parseUboSpecificRules?: boolean;

    /**
     * Whether to parse Adblock Plus-specific rules (ABP snippet injection).
     * Defaults to `true`.
     */
    parseAbpSpecificRules?: boolean;
}
