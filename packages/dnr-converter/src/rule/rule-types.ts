/**
 * @file Type definitions for the parsed network rule representation.
 *
 * Modifier tracking uses string sets and priority uses counter-based
 * calculation.
 */

/**
 * HTTP header matcher for the `$header` modifier.
 * Specifies the header name and an optional value/pattern to match.
 */
export type HttpHeaderMatcher = {
    /**
     * Name of the HTTP header to match.
     */
    header: string;

    /**
     * HTTP header value matcher.
     *
     * - `null` — match by name only (any value passes).
     * - `string` — exact string or regex-pattern to match against.
     *   When {@link isRegExp} is `true`, the string is a regex source
     *   (without surrounding slashes) and the consumer is responsible
     *   for compiling it into a `RegExp`.
     */
    value: string | null;

    /**
     * Whether {@link value} should be interpreted as a regular expression
     * source string.
     */
    isRegExp: boolean;
};

/**
 * Canonical content-type modifier name strings.
 *
 * Each consumer maps them to its own type system:
 * - `@adguard/tsurlfilter` maps to a `RequestType` bitmask.
 * - `@adguard/dnr-converter` maps to a `ResourceType` enum string.
 */
export type ContentTypeName =
    | 'document'
    | 'subdocument'
    | 'script'
    | 'stylesheet'
    | 'object'
    | 'image'
    | 'xmlhttprequest'
    | 'media'
    | 'font'
    | 'websocket'
    | 'other'
    | 'ping';

/**
 * Internal accumulator used during modifier processing for priority
 * calculation. Counts category contributions without bitmask operations.
 */
export interface ConversionMeta {
    /**
     * Number of base modifiers that each contribute +1 to priority
     * (ThirdParty, MatchCase, DnsRewrite, denyallow, restricted
     * domains/methods/content-types, To).
     */
    baseModifierCount: number;

    /**
     * Number of permitted content-type modifiers.
     */
    permittedContentTypeCount: number;

    /**
     * Number of permitted HTTP methods.
     */
    permittedMethodCount: number;

    /**
     * Whether `$header` modifier is present.
     */
    hasHeader: boolean;

    /**
     * Number of permitted domains (from `$domain`).
     */
    permittedDomainCount: number;

    /**
     * Whether `$redirect` or `$redirect-rule` modifier is present.
     */
    hasRedirect: boolean;

    /**
     * Number of specific exclusion modifiers
     * (elemhide, generichide, specifichide, content, urlblock,
     * genericblock, jsinject, extension).
     */
    specificExclusionCount: number;

    /**
     * Whether `$important` modifier is present.
     */
    hasImportant: boolean;
}
