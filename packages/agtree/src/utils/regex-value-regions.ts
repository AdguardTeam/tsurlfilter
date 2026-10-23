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
    MODIFIER_ASSIGN_OPERATOR,
    REGEX_MARKER,
} from './constants';

/**
 * A `=/.../` regex value region.
 *
 * `start` is the index of the opening `/`, `end` is one past the closing `/`.
 */
export type RegexValueRegion = readonly [start: number, end: number];

/**
 * Collects the `=/.../` regex value regions of a rule in a single forward pass.
 *
 * A region covers the pattern part and, when present, the replacement part
 * (`$replace=/(a)/$1/`). Escaped characters are skipped, and the replacement
 * scan stops at `,` because a comma starts the next modifier.
 *
 * @param rule Rule text.
 *
 * @returns Regions in ascending order.
 */
export function collectRegexValueRegions(rule: string): RegexValueRegion[] {
    const regions: RegexValueRegion[] = [];
    const { length } = rule;

    for (let i = 0; i < length; i += 1) {
        if (rule[i] === BACKSLASH) {
            i += 1;
            continue;
        }

        if (rule[i] !== MODIFIER_ASSIGN_OPERATOR || rule[i + 1] !== REGEX_MARKER) {
            continue;
        }

        // Opening `/` of the regex value.
        const start = i + 1;

        // Closing `/` of the pattern.
        let closing = start + 1;
        while (closing < length) {
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
        if (closing >= length) {
            continue;
        }

        // Optional replacement part: `/<replacement>/`.
        let end = closing + 1;
        for (let r = closing + 1; r < length; r += 1) {
            if (rule[r] === BACKSLASH) {
                r += 1;
                continue;
            }
            if (rule[r] === REGEX_MARKER) {
                end = r + 1;
                break;
            }
            if (rule[r] === COMMA) {
                break;
            }
        }

        regions.push([start, end]);

        // Skip past the region so `=/` sequences inside it are not treated
        // as separate regions.
        i = end - 1;
    }

    return regions;
}
