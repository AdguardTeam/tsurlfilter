/**
 * @file Regex value regions of a network rule.
 *
 * A network rule modifier can carry a regex value, e.g.
 * `$replace=/(a)/$1/` or `$removeparam=/x$y/`. The `$` characters inside
 * such a value are part of the regex or its replacement string, not modifier
 * separators.
 */

import {
    BACKSLASH,
    COMMA,
    DOLLAR_SIGN,
    MODIFIER_ASSIGN_OPERATOR,
    NEGATION_MARKER,
    REGEX_MARKER,
} from './constants';

/**
 * A `=/.../` regex value region.
 *
 * `start` is the index of the opening `/`, `end` is one past the closing `/`.
 */
export type RegexValueRegion = readonly [start: number, end: number];

/**
 * Shared result for ranges without a regex value, so the common path does not
 * allocate.
 */
const NO_REGEX_VALUE_REGIONS: readonly RegexValueRegion[] = [];

/**
 * Checks whether the character code belongs to a modifier name.
 *
 * Modifier names are `[A-Za-z0-9_-]*`, the same character set the structural
 * modifier parser accepts.
 *
 * @param code Character code to check.
 *
 * @returns `true` for a modifier-name character.
 */
function isModifierNameChar(code: number): boolean {
    return (code >= 0x41 && code <= 0x5a) // A-Z
        || (code >= 0x61 && code <= 0x7a) // a-z
        || (code >= 0x30 && code <= 0x39) // 0-9
        || code === 0x5f // _
        || code === 0x2d; // -
}

/**
 * Checks whether the character code is a space or a tab.
 *
 * The structural modifier parser skips these between the modifier separator,
 * the optional `~`, the name, and the `=`, so the region scan must skip them
 * too.
 *
 * @param code Character code to check.
 *
 * @returns `true` for a space or a tab.
 */
function isHorizontalWhitespace(code: number): boolean {
    return code === 0x20 || code === 0x09;
}

/**
 * Checks whether the `=` at `index` assigns a value to a modifier name, i.e.
 * it belongs to `$name=`, `,name=`, `$~name=`, or `,~name=`, with optional
 * spaces or tabs around the `~` and before the `=`.
 *
 * This keeps a `=/` sequence that belongs to the rule pattern (for example
 * `?ver=/` or `combo/f=/`) from being mistaken for a regex value opener.
 *
 * @param rule Rule text, or a source string containing the rule.
 * @param index Index of the `=`.
 * @param start Inclusive scan start.
 *
 * @returns `true` if the `=` follows a modifier name.
 */
function isModifierAssignment(rule: string, index: number, start: number): boolean {
    let i = index - 1;

    // Whitespace is allowed between the modifier name and `=`.
    while (i >= start && isHorizontalWhitespace(rule.charCodeAt(i))) {
        i -= 1;
    }

    const nameEnd = i;

    while (i >= start && isModifierNameChar(rule.charCodeAt(i))) {
        i -= 1;
    }

    // The `=` must follow at least one name character.
    if (i === nameEnd) {
        return false;
    }

    // Whitespace is allowed between the optional `~` and the name.
    while (i >= start && isHorizontalWhitespace(rule.charCodeAt(i))) {
        i -= 1;
    }

    // Optional negation marker before the name.
    if (rule[i] === NEGATION_MARKER) {
        i -= 1;

        // Whitespace is allowed between the separator and `~`.
        while (i >= start && isHorizontalWhitespace(rule.charCodeAt(i))) {
            i -= 1;
        }
    }

    return i >= start && (rule[i] === DOLLAR_SIGN || rule[i] === COMMA);
}

/**
 * Collects the `=/.../` regex value regions of a rule in a single forward pass.
 *
 * A region opens only at a `=` that follows a modifier name (`$name=/…/` or
 * `,name=/…/`), so a `=/` sequence inside the rule pattern is ignored. A
 * region covers the pattern part and, when present, the replacement part
 * (`$replace=/(a)/$1/`). Escaped characters are skipped, and the replacement
 * scan stops at `,` because a comma starts the next modifier.
 *
 * `start` and `end` bound the scan. When the source string holds a whole
 * filter list, pass the rule's range so the scan stays per-rule instead of
 * per-list. Returned indices are absolute.
 *
 * @param rule Rule text, or a source string containing the rule.
 * @param start Inclusive scan start.
 * @param end Exclusive scan end.
 *
 * @returns Regions in ascending order, or a shared empty array when the range
 *   contains no regex value.
 */
export function collectRegexValueRegions(
    rule: string,
    start = 0,
    end = rule.length,
): readonly RegexValueRegion[] {
    // Most rules have no regex value at all, so allocate the result array
    // lazily and return the shared empty array for them.
    let regions: RegexValueRegion[] | null = null;

    for (let i = start; i < end; i += 1) {
        if (rule[i] === BACKSLASH) {
            i += 1;
            continue;
        }

        if (i + 1 >= end
            || rule[i] !== MODIFIER_ASSIGN_OPERATOR
            || rule[i + 1] !== REGEX_MARKER
            || !isModifierAssignment(rule, i, start)) {
            continue;
        }

        // Opening `/` of the regex value.
        const opening = i + 1;

        // Closing `/` of the pattern.
        let closing = opening + 1;
        while (closing < end) {
            if (rule[closing] === BACKSLASH) {
                closing += 2;
                continue;
            }
            if (rule[closing] === REGEX_MARKER) {
                break;
            }
            closing += 1;
        }

        // No closing `/` — not a regex value.
        if (closing >= end) {
            continue;
        }

        // Optional replacement part: `/<replacement>/`.
        let regionEnd = closing + 1;
        for (let r = closing + 1; r < end; r += 1) {
            if (rule[r] === BACKSLASH) {
                r += 1;
                continue;
            }
            if (rule[r] === REGEX_MARKER) {
                regionEnd = r + 1;
                break;
            }
            if (rule[r] === COMMA) {
                break;
            }
        }

        (regions ??= []).push([opening, regionEnd]);

        // Skip past the region so `=/` sequences inside it are not treated
        // as separate regions.
        i = regionEnd - 1;
    }

    return regions ?? NO_REGEX_VALUE_REGIONS;
}
