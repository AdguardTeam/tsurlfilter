/**
 * @file Names of the special pseudo-classes with raw-text arguments, shared
 * between the HTML filtering rule body parser and the HTML filtering rule
 * converter, so that both lists are derived from a single source and stay in
 * sync.
 */

/**
 * Names of the special pseudo-classes which take a raw-text argument —
 * arbitrary text matched against the element content, which may contain
 * unbalanced parentheses, quotes or slashes without any escaping.
 *
 * In AdGuard products (CoreLibs) the argument of such a pseudo-class is
 * simply the raw text between the opening parenthesis of the pseudo-class
 * and the last closing parenthesis of the selector, e.g.
 * `$$script:contains((function(g,b,a,c,e,d)` matches script elements whose
 * content contains `(function(g,b,a,c,e,d`. These rules are present in
 * production filter lists, so the parser and the converter handle them the
 * same way.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules--contains}
 */
export const SPECIAL_PSEUDO_CLASS_NAMES = [
    'contains',
    '-abp-contains',
    'has-text',
] as const;
