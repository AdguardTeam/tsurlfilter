import { type IAdvancedModifier } from './advanced-modifier';
import { parseRegexSubstitution } from './parse-regex-substitution';

/**
 * Prefix that identifies full-URL mode patterns.
 * When the regex pattern starts with this prefix, the substitution
 * is applied to the entire URL (not just path+query+hash).
 */
const FULL_URL_PATTERN_PREFIX = '^http';

/**
 * Allowed URL protocols for full-URL transform results.
 * Dangerous schemes (javascript:, data:, file:, etc.) are rejected.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);

/**
 * Keyword for Base64 decode transform.
 */
export const B64_KEYWORD = 'b64';

/**
 * Keyword for percent-decode transform.
 */
export const PCT_KEYWORD = 'pct';

/**
 * UTF-8 decoder with fatal mode — throws on invalid byte sequences.
 */
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Decodes a Base64-encoded string to UTF-8 text.
 *
 * Supports standard Base64.
 * Padding is optional. Returns the input unchanged on failure.
 *
 * @param input The Base64-encoded string.
 *
 * @returns Decoded UTF-8 string, or the original input on failure.
 */
function decodeBase64(input: string): string {
    if (input.length === 0) {
        return '';
    }

    try {
        // Normalize URL-safe characters to standard Base64
        let normalized = input.replace(/-/g, '+').replace(/_/g, '/');

        // Add padding if missing
        const remainder = normalized.length % 4;
        if (remainder === 2) {
            normalized += '==';
        } else if (remainder === 3) {
            normalized += '=';
        }

        // Decode Base64 to binary string
        const binaryString = atob(normalized);

        // Convert binary string to Uint8Array
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i += 1) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Interpret as UTF-8 (fatal mode throws on invalid sequences)
        return utf8Decoder.decode(bytes);
    } catch {
        return input;
    }
}

/**
 * Decodes a percent-encoded string.
 *
 * Equivalent to `decodeURIComponent()`. Returns the input unchanged if
 * decoding fails (e.g., invalid `%XX` sequences like `%GG`).
 *
 * @param input The percent-encoded string.
 *
 * @returns Decoded string, or the original input on failure.
 */
function decodePercent(input: string): string {
    try {
        return decodeURIComponent(input);
    } catch {
        return input;
    }
}

/**
 * Splits a `$urltransform` value into pipeline segments by `|`.
 *
 * Handles `|` inside `/…/…/…/` substitution blocks correctly — those are
 * regex alternation operators, not pipeline separators.
 *
 * @param value The raw `$urltransform` modifier value.
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
 * Compiles a single pipeline segment into a transform function.
 *
 * @param segment The segment text.
 *
 * @returns A `(input: string) => string` transform function.
 */
function compileSegment(segment: string): (input: string) => string {
    const trimmed = segment.trim();

    if (trimmed.length === 0) {
        return (input: string): string => input;
    }

    if (trimmed === B64_KEYWORD) {
        return decodeBase64;
    }

    if (trimmed === PCT_KEYWORD) {
        return decodePercent;
    }

    // In AdGuard filter syntax `$` is the modifier separator, so rule
    // authors write `\$` inside regex patterns.  Unescape before passing
    // to parseRegexSubstitution so that `$` works as the end-of-string
    // anchor (or `$1`-style backreference) in the compiled regex.
    const unescaped = trimmed.replace(/\\\$/g, '$');
    const parsed = parseRegexSubstitution(unescaped);
    return parsed.apply;
}

/**
 * Checks if a pipeline segment is a substitute transform (as opposed to a
 * decode keyword or empty segment).
 *
 * @param segment The trimmed segment text.
 *
 * @returns `true` if the segment is a substitute transform.
 */
function isSubstitute(segment: string): boolean {
    if (segment.length === 0) {
        return false;
    }
    if (segment === B64_KEYWORD || segment === PCT_KEYWORD) {
        return false;
    }
    return true;
}

/**
 * Detects full-URL mode by checking the first substitute transform in
 * the pipeline.
 *
 * A substitute's regex starts with `^http` when:
 * - The segment is `/^http...` (leading `/` before the pattern), or
 * - The segment is `^http...` (no leading `/`, also valid for parseRegexSubstitution).
 *
 * @param segments Array of pipeline segment strings.
 *
 * @returns `true` if the first substitute's regex starts with `^http`.
 */
function detectFullUrlMode(segments: string[]): boolean {
    for (const seg of segments) {
        const trimmed = seg.trim();
        if (isSubstitute(trimmed)) {
            // Pattern starts after optional leading '/'
            if (trimmed.startsWith('/')) {
                return trimmed.startsWith(`/${FULL_URL_PATTERN_PREFIX}`);
            }
            return trimmed.startsWith(FULL_URL_PATTERN_PREFIX);
        }
    }
    return false;
}

/**
 * UrlTransform modifier class.
 *
 * Parses a `$urltransform` value that may be a single transform or a
 * `|`-separated pipeline of transforms.
 *
 * Two modes of operation:
 * - **Path-only mode** (default): the pipeline input is `pathname+search+hash`,
 *   origin (scheme+host+port) is preserved.
 * - **Full-URL mode**: when the first substitute's regex starts with `^http`,
 *   the pipeline input is the entire URL string, allowing origin changes.
 */
export class UrlTransformModifier implements IAdvancedModifier {
    /**
     * Raw option text (e.g. `/\/old\//\/new\//` or `/X/Y/|pct`).
     */
    private readonly optionText: string;

    /**
     * Composed pipeline function that applies all transforms in sequence.
     */
    private readonly applyFn: (input: string) => string;

    /**
     * Whether this modifier operates in full-URL mode.
     * True when the first substitute's regex starts with `^http`.
     */
    private readonly fullUrlMode: boolean;

    /**
     * Constructor.
     *
     * @param value UrlTransform modifier value (may contain `|` pipeline separators).
     */
    constructor(value: string) {
        this.optionText = value;

        if (!value) {
            this.applyFn = (x: string): string => x;
            this.fullUrlMode = false;
            return;
        }

        const segments = splitPipeline(value);

        this.fullUrlMode = detectFullUrlMode(segments);

        const transforms = segments.map(compileSegment);

        if (transforms.length === 1) {
            [this.applyFn] = transforms;
        } else {
            this.applyFn = (input: string): string => {
                let result = input;
                for (const transform of transforms) {
                    result = transform(result);
                }
                return result;
            };
        }
    }

    /**
     * Returns the raw modifier value (including pipeline `|` separators).
     *
     * @returns The option text.
     */
    public getValue(): string {
        return this.optionText;
    }

    /**
     * Returns the composed pipeline function.
     * Operates on raw strings — for URL-aware application use
     * {@link applyToUrl} instead.
     *
     * @returns The function to apply the pipeline.
     */
    public getApplyFunc(): (input: string) => string {
        return this.applyFn;
    }

    /**
     * Whether this modifier operates in full-URL mode.
     * In full-URL mode the pipeline is applied to the entire URL string,
     * allowing origin-changing redirects.
     *
     * @returns True if the first substitute's regex starts with `^http`.
     */
    public isFullUrlMode(): boolean {
        return this.fullUrlMode;
    }

    /**
     * Applies the url transform pipeline to the given URL.
     *
     * In path-only mode (default): only the path+query+hash portion is
     * subject to the pipeline. If the result would change the origin
     * (scheme+host+port), the original URL is returned unchanged.
     *
     * In full-URL mode (first substitute starts with `^http`): the entire URL
     * is subject to the pipeline. The result must be a valid URL with an
     * allowed scheme (http/https/ws/wss).
     *
     * @param url The full URL string to transform.
     *
     * @returns The transformed URL, or the original if no change,
     *          invalid result, or disallowed scheme.
     */
    public applyToUrl(url: string): string {
        if (this.fullUrlMode) {
            return this.applyFullUrl(url);
        }

        return this.applyPathOnly(url);
    }

    /**
     * Full-URL mode: apply pipeline to the entire URL string.
     *
     * @param url The full URL string.
     *
     * @returns Transformed URL or original on failure.
     */
    private applyFullUrl(url: string): string {
        const transformed = this.applyFn(url);

        // No change
        if (transformed === url) {
            return url;
        }

        // Validate the result is a proper URL with an allowed scheme
        try {
            const resultParsed = new URL(transformed);
            if (!ALLOWED_PROTOCOLS.has(resultParsed.protocol)) {
                return url;
            }
        } catch {
            return url;
        }

        return transformed;
    }

    /**
     * Path-only mode: apply pipeline to path+query+hash only, preserving origin.
     *
     * @param url The full URL string.
     *
     * @returns Transformed URL or original on failure.
     */
    private applyPathOnly(url: string): string {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return url;
        }

        const originalOrigin = parsed.origin;

        const target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        const transformed = this.applyFn(target);

        if (transformed === target) {
            return url;
        }

        const result = `${originalOrigin}${transformed}`;

        try {
            const resultParsed = new URL(result);
            if (resultParsed.origin !== originalOrigin) {
                return url;
            }
        } catch {
            return url;
        }

        return result;
    }
}
