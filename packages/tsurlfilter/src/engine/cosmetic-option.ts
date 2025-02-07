/**
 * CosmeticOption is the enumeration of various content script options.
 * Depending on the set of enabled flags the content script will contain different set of settings.
 */
export enum CosmeticOption {
    /**
     * If generic elemhide and CSS rules are enabled.
     * Could be disabled by a $generichide rule and $elemhide rule.
     */
    CosmeticOptionGenericCSS = 1 << 1,

    /**
     * If specific elemhide and CSS rules are enabled.
     * Could be disabled by a $specifichide rule and $elemhide rule.
     */
    CosmeticOptionSpecificCSS = 1 << 2,

    /**
     * If JS rules and scriptlets are enabled.
     * Could be disabled by a $jsinject rule.
     */
    CosmeticOptionJS = 1 << 3,

    /**
     * If HTML filtering rules are enabled.
     * Could be disabled by a $content rule.
     */
    CosmeticOptionHtml = 1 << 4,

    /**
     * TODO: Add support for these flags.
     *
     * They are useful when content script is injected into an iframe.
     * In this case we can check what flags were applied to the top-level frame.
     */
    CosmeticOptionSourceGenericCSS = 1 << 5,
    CosmeticOptionSourceCSS = 1 << 6,
    CosmeticOptionSourceJS = 1 << 7,

    /**
     * Everything is enabled.
     */
    CosmeticOptionAll = CosmeticOptionGenericCSS
        | CosmeticOptionSpecificCSS
        | CosmeticOptionJS
        | CosmeticOptionHtml,

    /**
     * Everything is disabled.
     */
    CosmeticOptionNone = 0,
}
