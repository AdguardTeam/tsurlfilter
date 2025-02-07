/**
 * @file Extended CSS pseudo names used by the tokenizer.
 *
 * @note This enumeration contains only those pseudo class names that require special handling, for example, `:has()`
 * is covered by the basic CSS tokenizer, so it is not included here.
 */

export const enum ExtendedCssPseudo {
    AbpContains = '-abp-contains',
    Contains = 'contains',
    HasText = 'has-text',
    MatchesCss = 'matches-css',
    MatchesCssAfter = 'matches-css-after',
    MatchesCssBefore = 'matches-css-before',
    Xpath = 'xpath',
}
