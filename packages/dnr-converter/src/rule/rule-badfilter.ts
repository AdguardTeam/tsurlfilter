/**
 * @file Helper class for badfilter rule negation checks.
 *
 * Extracted from the main rule module so that the badfilter comparison
 * logic can be reasoned about and tested in isolation.
 */

import { OPTION_NAMES, SOURCE_SYNTAX_ALIASES } from './option-names';
import { stringArraysEqual, stringArraysHaveIntersection } from './string-utils';

/**
 * A single value-bearing modifier exactly as written in the rule text.
 */
export type WrittenModifier = readonly [name: string, value: string];

/**
 * Modifiers whose written value must match for a `$badfilter` rule to negate
 * another rule. Values are compared as written, because the rule text must match.
 * `$domain` and `$denyallow` are compared separately, with domain normalization.
 *
 * Source-syntax aliases are listed as well: the collection happens before the
 * converter resolves them, so `$queryprune` and `$rewrite` arrive here under
 * their original names.
 *
 * Keep in sync with `VALUE_BEARING_OPTIONS` in `@adguard/tsurlfilter` (duplicated:
 * tsurlfilter is a devDependency here). `$xmlprune` is listed only here.
 */
export const VALUE_BEARING_MODIFIERS: ReadonlySet<string> = new Set([
    OPTION_NAMES.CSP,
    OPTION_NAMES.REPLACE,
    OPTION_NAMES.URLTRANSFORM,
    OPTION_NAMES.COOKIE,
    OPTION_NAMES.REDIRECT,
    OPTION_NAMES.REDIRECTRULE,
    OPTION_NAMES.REMOVEPARAM,
    OPTION_NAMES.REMOVEHEADER,
    OPTION_NAMES.PERMISSIONS,
    OPTION_NAMES.CLIENT,
    OPTION_NAMES.DNSREWRITE,
    OPTION_NAMES.DNSTYPE,
    OPTION_NAMES.CTAG,
    OPTION_NAMES.HEADER,
    OPTION_NAMES.METHOD,
    OPTION_NAMES.TO,
    OPTION_NAMES.STEALTH,
    OPTION_NAMES.APP,
    OPTION_NAMES.JSONPRUNE,
    OPTION_NAMES.XMLPRUNE,
    OPTION_NAMES.HLS,
    OPTION_NAMES.REFERRERPOLICY,
    SOURCE_SYNTAX_ALIASES.QUERYPRUNE,
    SOURCE_SYNTAX_ALIASES.REWRITE,
]);

/**
 * Minimal structural interface required by {@link RuleBadfilter.negates}.
 * Any object that has these fields (including {@link Rule}) can be passed
 * without creating a circular module dependency.
 */
interface BadfilterTarget {
    readonly enabledModifiers: ReadonlySet<string>;
    readonly disabledModifiers: ReadonlySet<string>;
    readonly allowlist: boolean;
    readonly pattern: string;
    readonly permittedResourceTypes: readonly string[];
    readonly restrictedResourceTypes: readonly string[];
    readonly restrictedDomains: string[] | null;
    readonly permittedDomains: string[] | null;
    readonly denyAllowDomains: string[] | null;
    readonly writtenModifiers: readonly WrittenModifier[];
}

/**
 * Checks whether two written-modifier lists are equal. Order and multiplicity
 * are part of the rule text, so the comparison is element-wise.
 *
 * @param left First list.
 * @param right Second list.
 *
 * @returns `true` when both lists hold the same entries in the same order.
 */
function writtenModifiersEqual(
    left: readonly WrittenModifier[],
    right: readonly WrittenModifier[],
): boolean {
    return left.length === right.length
        && left.every(([name, value], index) => (
            right[index][0] === name && right[index][1] === value
        ));
}

/**
 * Joins sorted elements of an array into a comma-separated string.
 *
 * @param arr Input array.
 *
 * @returns Sorted, comma-joined string.
 */
function sortedJoin(arr: readonly string[]): string {
    return [...arr].sort().join(',');
}

/**
 * Helper class for checking whether a `$badfilter` rule negates another rule.
 */
export class RuleBadfilter {
    /**
     * Checks whether `badfilterRule` negates `targetRule`.
     *
     * A `$badfilter` rule negates another rule when both rules have:
     * - the same allowlist flag,
     * - the same pattern,
     * - the same enabled modifiers (excluding `$badfilter` itself),
     * - the same value-bearing modifiers, written exactly as in the rule text
     *   (same entries, same order, repeats preserved),
     * - the same disabled modifiers,
     * - the same permitted/restricted resource types,
     * - the same restricted domains,
     * - overlapping permitted domains, and
     * - the same denyallow domains.
     *
     * @param badfilterRule The rule that carries the `$badfilter` modifier.
     * @param targetRule The rule to test for negation.
     *
     * @returns `true` if `badfilterRule` negates `targetRule`.
     */
    public static negates(badfilterRule: BadfilterTarget, targetRule: BadfilterTarget): boolean {
        if (!badfilterRule.enabledModifiers.has(OPTION_NAMES.BADFILTER)) {
            return false;
        }

        if (badfilterRule.allowlist !== targetRule.allowlist) {
            return false;
        }

        if (badfilterRule.pattern !== targetRule.pattern) {
            return false;
        }

        // Compare resource type arrays (order-independent).
        if (sortedJoin(badfilterRule.permittedResourceTypes) !== sortedJoin(targetRule.permittedResourceTypes)) {
            return false;
        }
        if (sortedJoin(badfilterRule.restrictedResourceTypes) !== sortedJoin(targetRule.restrictedResourceTypes)) {
            return false;
        }

        // Compare enabled modifiers excluding $badfilter itself.
        const badfilterEnabled = new Set(badfilterRule.enabledModifiers);
        badfilterEnabled.delete(OPTION_NAMES.BADFILTER);

        const sameSize = badfilterEnabled.size === targetRule.enabledModifiers.size;
        const sameModifiers = [...badfilterEnabled].every((m) => targetRule.enabledModifiers.has(m));
        if (!sameSize || !sameModifiers) {
            return false;
        }

        // Compare the value-bearing modifiers as written: the modifier sets
        // above do not cover their values, and the parsed state may be
        // normalized (for example `$method` is lowercased), while `$badfilter`
        // requires the rule text to match.
        if (!writtenModifiersEqual(badfilterRule.writtenModifiers, targetRule.writtenModifiers)) {
            return false;
        }

        // Compare disabled modifiers.
        if (
            badfilterRule.disabledModifiers.size !== targetRule.disabledModifiers.size
            || ![...badfilterRule.disabledModifiers].every((m) => targetRule.disabledModifiers.has(m))
        ) {
            return false;
        }

        if (!stringArraysEqual(badfilterRule.restrictedDomains, targetRule.restrictedDomains)) {
            return false;
        }

        if (!stringArraysHaveIntersection(badfilterRule.permittedDomains, targetRule.permittedDomains)) {
            return false;
        }

        if (!stringArraysEqual(badfilterRule.denyAllowDomains, targetRule.denyAllowDomains)) {
            return false;
        }

        return true;
    }
}
