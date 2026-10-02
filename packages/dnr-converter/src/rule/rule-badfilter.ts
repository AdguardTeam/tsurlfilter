/**
 * @file Helper class for badfilter rule negation checks.
 *
 * Extracted from the main rule module so that the badfilter comparison
 * logic can be reasoned about and tested in isolation.
 */

import { OPTION_NAMES } from './option-names';
import { stringArraysEqual, stringArraysHaveIntersection } from './string-utils';

/**
 * Minimal structural interface required by {@link RuleBadfilter.negates}.
 * Any object that has these fields (including {@link ParsedNetworkRule}) can be
 * passed without creating a circular module dependency.
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
