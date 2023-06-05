/**
 * Css, injected to broken element for hiding.
 */
// eslint-disable-next-line max-len
export const HIDING_STYLE = '{ display: none!important; visibility: hidden!important; height: 0px!important; min-height: 0px!important; }';

/**
 * Type of attribute matching supported by {@link createHidingCssRule}.
 *
 * @see https://www.w3.org/TR/selectors-3/#attribute-selectors
 */
export const enum AttributeMatching {
    Strict = '=',
    Suffix = '$=',
}

/**
 * Creates hiding css rule for specified tag with src attribute.
 *
 * @param tag Element tag for css selector.
 * @param src `src` attribute value for css selector. If value is the empty string
 * then the selector does not represent anything.
 * @param matching Attribute matching type. Currently support strict (=) and suffix ($=) matching.
 * Default to strict.
 *
 * @returns Css rule text.
 */
export function createHidingCssRule(
    tag: string,
    src: string,
    matching = AttributeMatching.Strict,
): string {
    return `${tag}[src${matching}"${src}"] ${HIDING_STYLE}\n`;
}
