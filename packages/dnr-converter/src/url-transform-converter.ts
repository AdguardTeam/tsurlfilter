import { splitByDelimiterWithEscapeCharacter } from './utils/string';

/**
 * Keyword for Base64 decode transform.
 */
const B64_KEYWORD = 'b64';

/**
 * Keyword for percent-decode transform.
 */
const PCT_KEYWORD = 'pct';

/**
 * Parsed parts of a `/pattern/replacement/flags` substitution string.
 */
export interface UrlTransformParts {
    /**
     * The regex pattern (without surrounding slashes).
     */
    pattern: string;
    /**
     * The replacement template (AdGuard format with $N refs).
     */
    replacement: string;
    /**
     * Flags string (e.g. 'i', 'g', 'ig', or empty).
     */
    flags: string;
}

/**
 * Parses a `/pattern/replacement/flags` string into its raw components.
 * Uses the same delimiter-splitting logic as parseRegexSubstitution
 * but returns raw strings rather than a compiled RegExp.
 *
 * @param value The raw substitution value (e.g. `/regex/repl/flags`).
 *
 * @returns Parsed parts.
 */
export function parseUrlTransformParts(value: string): UrlTransformParts {
    const parts = splitByDelimiterWithEscapeCharacter(value, '/', '\\', true, false);

    return {
        pattern: parts[0] || '',
        replacement: parts[1] || '',
        flags: parts[2] || '',
    };
}

/**
 * Converts an AdGuard replacement string to DNR regexSubstitution format.
 *
 * - `$N` → `\\N` (shifted by offset).
 * - `\$` → literal `$`.
 *
 * @param replacement The AdGuard replacement string.
 * @param offset Number to add to each group reference (for path-only wrapping).
 *
 * @returns DNR-compatible regexSubstitution string.
 */
export function convertReplacementToDnr(replacement: string, offset: number): string {
    let result = '';
    let i = 0;

    while (i < replacement.length) {
        const ch = replacement[i];

        // Handle escaped dollar: \$N is a backreference (escaped for filter modifier syntax)
        if (ch === '\\' && i + 1 < replacement.length && replacement[i + 1] === '$') {
            if (i + 2 < replacement.length && replacement[i + 2] >= '0' && replacement[i + 2] <= '9') {
                // \$N → \\N (backreference)
                const groupNum = parseInt(replacement[i + 2], 10) + offset;
                result += `\\${groupNum}`;
                i += 3;
                continue;
            }
            // \$ not followed by digit → literal $
            result += '$';
            i += 2;
            continue;
        }

        // Handle unescaped $N group references.
        // Only single-digit refs ($0–$9) are handled because DNR
        // regexSubstitution only supports \\0–\\9.
        if (ch === '$' && i + 1 < replacement.length) {
            const nextCh = replacement[i + 1];
            if (nextCh >= '0' && nextCh <= '9') {
                const groupNum = parseInt(nextCh, 10) + offset;
                result += `\\${groupNum}`;
                i += 2;
                continue;
            }
        }

        result += ch;
        i += 1;
    }

    return result;
}

/**
 * Result of converting a $urltransform rule to DNR format.
 */
export interface UrlTransformDnrResult {
    /**
     * RE2-compatible regex for DNR condition.
     */
    regexFilter: string;

    /**
     * DNR replacement template with \\N references.
     */
    regexSubstitution: string;

    /**
     * If false, case-insensitive matching. Undefined means default.
     */
    isUrlFilterCaseSensitive: boolean | undefined;
}

/**
 * Prefix that identifies full-URL mode patterns.
 */
const FULL_URL_PATTERN_PREFIX = '^http';

/**
 * Origin-capturing prefix for path-only transforms.
 */
const ORIGIN_PREFIX = '^(https?://[^/]+)';

/**
 * Prefix for patterns that can match anywhere in the path.
 * Uses a non-greedy match to capture everything before the pattern.
 */
const FLOATING_PREFIX = '^(https?://[^?#]*?)';

/**
 * Origin-capturing prefix for query-targeting transforms.
 */
const ORIGIN_PREFIX_QUERY = '^(https?://[^?]+)';

/**
 * Checks if a pattern is a full-URL mode pattern.
 *
 * @param pattern The regex pattern.
 *
 * @returns True if the pattern starts with `^http`.
 */
export function isFullUrlPattern(pattern: string): boolean {
    return pattern.startsWith(FULL_URL_PATTERN_PREFIX);
}

/**
 * Converts a full-URL $urltransform to DNR regexFilter + regexSubstitution.
 *
 * @param pattern The regex pattern (already unescaped from the rule).
 * @param replacement The replacement template (AdGuard format).
 * @param flags The flags string.
 *
 * @returns DNR conversion result.
 */
export function convertFullUrlTransform(
    pattern: string,
    replacement: string,
    flags: string,
): UrlTransformDnrResult {
    // Unescape filter-syntax escapes in the pattern:
    // - \/ → /  (slash escaped to avoid conflicting with the
    //            /pattern/replacement/flags delimiter)
    // - \$ → $  (dollar escaped because $ is the modifier separator
    //            in AdGuard syntax; in the regex it must act as the
    //            end-of-string anchor)
    const unescapedPattern = pattern
        .replace(/\\\//g, '/')
        .replace(/\\\$/g, '$');
    let dnrReplacement = convertReplacementToDnr(replacement, 0);
    dnrReplacement = dnrReplacement.replace(/\\\//g, '/');

    return {
        regexFilter: unescapedPattern,
        regexSubstitution: dnrReplacement,
        isUrlFilterCaseSensitive: flags.includes('i') ? false : undefined,
    };
}

/**
 * Counts the number of unescaped capturing groups in a regex pattern.
 * Non-capturing groups (?:...) are excluded.
 *
 * @param pattern Regex pattern string.
 *
 * @returns Number of capturing groups.
 */
export function countCaptureGroups(pattern: string): number {
    let count = 0;
    let escaped = false;
    let inCharClass = false;

    for (let i = 0; i < pattern.length; i += 1) {
        const ch = pattern[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            escaped = true;
            continue;
        }

        if (ch === '[') {
            inCharClass = true;
            continue;
        }

        if (ch === ']') {
            inCharClass = false;
            continue;
        }

        if (inCharClass) {
            continue;
        }

        if (ch === '(' && i + 1 < pattern.length && pattern[i + 1] !== '?') {
            count += 1;
        }
    }

    return count;
}

/**
 * Converts a path-only $urltransform to DNR format by wrapping the pattern
 * with an origin-capturing prefix and shifting capture group references.
 *
 * @param pattern The regex pattern (path-only, not starting with `^http`).
 * @param replacement The replacement template (AdGuard format).
 * @param flags The flags string.
 *
 * @returns DNR conversion result.
 */
export function convertPathOnlyTransform(
    pattern: string,
    replacement: string,
    flags: string,
): UrlTransformDnrResult {
    let workPattern = pattern;

    // Strip leading ^ — the origin-capturing prefix already anchors
    // the regex at the start of the URL.
    if (workPattern.startsWith('^')) {
        workPattern = workPattern.substring(1);
    }

    // Check for end-of-string anchor (\$ in filter syntax, which
    // becomes $ in regex).  When present, we must NOT append the
    // remainder-capturing group (.*)  after the pattern.
    let hasEndAnchor = false;
    if (workPattern.endsWith('\\$')) {
        hasEndAnchor = true;
        workPattern = workPattern.substring(0, workPattern.length - 2);
    }

    const userGroupCount = countCaptureGroups(workPattern);

    // Determine if this is a query-targeting pattern
    const isQueryPattern = workPattern.startsWith('\\?') || workPattern.startsWith('?');

    // Determine if pattern is anchored to path start (starts with \/)
    const isPathAnchored = !isQueryPattern && workPattern.startsWith('\\/');

    // Choose prefix based on pattern type
    let prefix: string;
    if (isQueryPattern) {
        prefix = ORIGIN_PREFIX_QUERY;
    } else if (isPathAnchored) {
        prefix = ORIGIN_PREFIX;
    } else {
        // Pattern can match anywhere in the path (floating match)
        prefix = FLOATING_PREFIX;
    }

    // Remove leading escaped slash from path pattern for joining
    let innerPattern = workPattern;
    if (isPathAnchored) {
        innerPattern = innerPattern.substring(2);
    }

    // Remove trailing escaped slash for clean joining
    let trailingSlash = '/';
    if (!isQueryPattern && innerPattern.endsWith('\\/')) {
        innerPattern = innerPattern.substring(0, innerPattern.length - 2);
        trailingSlash = '/';
    } else if (!isQueryPattern) {
        trailingSlash = '';
    }

    // Build wrapped regexFilter
    const remainderGroup = hasEndAnchor ? '' : '(.*)';
    const endAnchor = hasEndAnchor ? '$' : '';
    let regexFilter: string;

    if (isQueryPattern) {
        regexFilter = `${prefix}${innerPattern}${remainderGroup}${endAnchor}`;
    } else if (isPathAnchored) {
        regexFilter = `${prefix}/${innerPattern}${trailingSlash}${remainderGroup}${endAnchor}`;
    } else {
        // Floating pattern: no extra slash between prefix and pattern
        regexFilter = `${prefix}${innerPattern}${trailingSlash}${remainderGroup}${endAnchor}`;
    }

    // Unescape filter-syntax escapes in the assembled regex:
    // - \/ → /  (slash escaped for /pattern/replacement/flags delimiter)
    // - \$ → $  (dollar escaped because $ is the modifier separator)
    regexFilter = regexFilter.replace(/\\\//g, '/');
    regexFilter = regexFilter.replace(/\\\$/g, '$');

    // Build regexSubstitution: \\1 (origin) + converted replacement
    // + optional \\(last) (remainder, only when no end anchor)

    // Convert $N refs, shifting by 1 for the origin wrapper group
    let dnrReplacement = convertReplacementToDnr(replacement, 1);

    // Unescape \\/ in replacement to /
    dnrReplacement = dnrReplacement.replace(/\\\//g, '/');

    let regexSubstitution: string;
    if (hasEndAnchor) {
        // No remainder group — substitution is just origin + replacement
        regexSubstitution = `\\1${dnrReplacement}`;
    } else {
        const remainderRef = `\\${userGroupCount + 2}`;
        regexSubstitution = `\\1${dnrReplacement}${remainderRef}`;
    }

    return {
        regexFilter,
        regexSubstitution,
        isUrlFilterCaseSensitive: flags.includes('i') ? false : undefined,
    };
}

/**
 * Splits a $urltransform value into pipeline segments by `|`.
 *
 * Handles `|` inside `/…/…/…/` substitution blocks correctly — those are
 * regex alternation operators, not pipeline separators.
 *
 * NOTE: This is a self-contained copy of the logic from
 * `src/modifiers/url-transform-modifier.ts`. Duplicated intentionally so
 * the declarative converter stays independent for future package extraction.
 *
 * @param value The raw $urltransform modifier value.
 *
 * @returns Array of pipeline segment strings.
 */
function splitPipeline(value: string): string[] {
    const segments: string[] = [];
    let current = '';
    let slashCount = 0;
    let inSubstitute = false;
    let escaped = false;

    for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];

        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            current += ch;
            escaped = true;
            continue;
        }

        if (ch === '|' && !inSubstitute) {
            segments.push(current);
            current = '';
            slashCount = 0;
            continue;
        }

        if (ch === '/') {
            if (!inSubstitute && current.length === 0) {
                inSubstitute = true;
                slashCount = 0;
            }

            if (inSubstitute) {
                slashCount += 1;
                if (slashCount >= 3) {
                    inSubstitute = false;
                }
            }
        }

        current += ch;
    }

    segments.push(current);
    return segments;
}

/**
 * Decode keywords that cannot be converted to DNR.
 */
const DECODE_KEYWORDS = new Set([B64_KEYWORD, PCT_KEYWORD]);

/**
 * Converts a complete $urltransform modifier value (possibly with pipeline)
 * into one or more DNR conversion results.
 *
 * @param value The raw modifier value (e.g. `/pattern/repl/flags` or pipeline).
 *
 * @returns Array of DNR conversion results, one per pipeline stage.
 *
 * @throws Error if the value contains unsupported decode stages.
 */
export function convertUrlTransformToDnr(value: string): UrlTransformDnrResult[] {
    const stages = splitPipeline(value);

    // Check for decode keywords
    for (const stage of stages) {
        const trimmed = stage.trim();
        if (DECODE_KEYWORDS.has(trimmed)) {
            throw new Error(
                `Decode stages (b64/pct) are not supported in DNR conversion: "${trimmed}"`,
            );
        }
    }

    const results: UrlTransformDnrResult[] = [];

    for (const stage of stages) {
        const trimmed = stage.trim();
        if (trimmed.length === 0) {
            continue;
        }

        const parts = parseUrlTransformParts(trimmed);

        if (isFullUrlPattern(parts.pattern)) {
            results.push(convertFullUrlTransform(parts.pattern, parts.replacement, parts.flags));
        } else {
            results.push(convertPathOnlyTransform(parts.pattern, parts.replacement, parts.flags));
        }
    }

    return results;
}
