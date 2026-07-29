/**
 * @file Parser options shared across all AST parsers.
 */

/**
 * Options for the AST parser.
 */
export interface ParseOptions {
    /**
     * Whether to include source location info (start/end) on AST nodes.
     */
    isLocIncluded?: boolean;

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

    /**
     * Whether to parse HTML filtering rule bodies with the CSS selector list
     * parser. When false, body is stored as raw start/end offsets.
     * Defaults to `false`.
     */
    parseHtmlFilteringRuleBodies?: boolean;

    /**
     * Whether to parse CSS injection rule selector lists into fully-parsed
     * `SelectorList` AST nodes via the CSS pipeline parsers. When `false`
     * (default), the selector list is returned as a `Raw` node containing
     * the cleaned selector text.
     *
     * Defaults to `false`.
     */
    parseCssSelectorList?: boolean;

    /**
     * Whether to parse CSS injection rule declaration lists into fully-parsed
     * `CssDeclarationList` AST nodes via the CSS pipeline parsers. When
     * `false` (default), the declaration list is returned as a `Raw` node
     * containing the raw declaration text.
     *
     * Defaults to `false`.
     */
    parseCssDeclarationList?: boolean;

    /**
     * When `true`, cosmetic rules are returned as `InvalidRule` nodes.
     * Defaults to `false`.
     */
    ignoreCosmetic?: boolean;

    /**
     * When `true`, network rules are returned as `InvalidRule` nodes.
     * Defaults to `false`.
     */
    ignoreNetwork?: boolean;

    /**
     * When `true`, `/etc/hosts`-style rules (e.g. `127.0.0.1 example.com` or the
     * "just domain" form `example.org`) are parsed into `HostRule` nodes before
     * falling back to network-rule parsing. Defaults to `false`.
     */
    parseHostRules?: boolean;
}
