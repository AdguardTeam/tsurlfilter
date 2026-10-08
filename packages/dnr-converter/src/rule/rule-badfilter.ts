/**
 * @file Helper class for badfilter rule negation checks.
 *
 * Extracted from the main rule module so that the badfilter comparison
 * logic can be reasoned about and tested in isolation.
 */

import { isRegexPattern } from '../utils/string';

import { OPTION_NAMES } from './option-names';

/**
 * Modifiers of a rule as written in the rule text, used by the `$badfilter`
 * comparison.
 *
 * A `$badfilter` rule disables a rule only when the rule text matches, so the
 * modifiers are kept as written instead of the parsed (normalized) state.
 */
export interface WrittenModifiersKeys {
    /**
     * All modifiers as written, except `$badfilter` itself.
     */
    readonly full: string;

    /**
     * The same list without `$domain`, used when a rule with `$domain` disables
     * the target rule only partially.
     */
    readonly withoutDomain: string;
}

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
    readonly writtenKeys: WrittenModifiersKeys;
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
     * - the same permitted/restricted resource types, and
     * - the same text, as written in the rule text (same modifier names, values,
     *   order and repeats), except that a rule with `$domain` and without negated
     *   domains negates the target rule for the domains present in both lists.
     *
     * The structural checks above the text comparison are redundant once the
     * written text is available — the same text implies the same parsed state —
     * but they still discriminate when the text could not be captured, so they
     * are kept.
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

        return RuleBadfilter.matchesWrittenRuleText(badfilterRule, targetRule);
    }

    /**
     * Checks whether the two rules have the same text, as written in the filter
     * list.
     *
     * Written text is used on purpose: a `$badfilter` rule disables a rule only
     * when the rule text matches, so rules that differ as written must not negate
     * each other even if they are equivalent after parsing (for example
     * `$removeheader=Set-Cookie` and `$removeheader=set-cookie`, or `$queryprune`
     * and `$removeparam`). The order of the modifiers is part of the rule text as
     * well, so a reordered rule does not match.
     *
     * A rule with `$domain` and without negated domains is an exception: it
     * disables the target rule only for the domains present in both lists, so the
     * domain values are left out of the comparison and the lists are checked for
     * an intersection instead. The position of `$domain` among the other
     * modifiers is therefore not compared in this case, unlike the position of
     * every other modifier.
     *
     * @param badfilterRule The rule that carries the `$badfilter` modifier.
     * @param targetRule The rule to test for negation.
     *
     * @returns True when the written text matches.
     */
    private static matchesWrittenRuleText(badfilterRule: BadfilterTarget, targetRule: BadfilterTarget): boolean {
        if (!RuleBadfilter.isPartialDomainCase(badfilterRule, targetRule)) {
            return badfilterRule.writtenKeys.full === targetRule.writtenKeys.full;
        }

        return badfilterRule.writtenKeys.withoutDomain === targetRule.writtenKeys.withoutDomain
            && RuleBadfilter.haveIntersection(
                badfilterRule.permittedDomains,
                targetRule.permittedDomains,
            );
    }

    /**
     * Checks whether a `$badfilter` rule disables the target rule only partially.
     *
     * This is the case when at least one of the two rules restricts itself by
     * `$domain` and neither rule negates a domain: negated domains cannot be
     * expressed as an intersection, so such rules are compared by the whole text
     * instead. A rule without `$domain` restricts nothing, so it keeps cancelling
     * the other rule everywhere the two rules overlap.
     *
     * @param badfilterRule The rule that carries the `$badfilter` modifier.
     * @param targetRule The rule to test for negation.
     *
     * @returns True when the partial cancellation case applies.
     */
    private static isPartialDomainCase(badfilterRule: BadfilterTarget, targetRule: BadfilterTarget): boolean {
        return (targetRule.permittedDomains !== null || badfilterRule.permittedDomains !== null)
            && targetRule.restrictedDomains === null
            && badfilterRule.restrictedDomains === null;
    }

    /**
     * Checks whether two domain lists can match the same request domain.
     *
     * Entries are compared as written, as `$badfilter` matches the rule text; a
     * plain domain name is compared case-insensitively, because a domain name is
     * case-insensitive, while a regexp pattern keeps its case.
     *
     * The MV2 twin receives values already normalized by `DomainModifier`, which
     * resolves the separator escape, so an escaped separator in a regexp entry
     * compares equal to the unescaped one there — a pre-existing divergence that
     * the `$domain` decision has to settle.
     *
     * A wildcard TLD entry (`example.*`) therefore overlaps only an identically
     * written entry: matching it against the domains it stands for needs the
     * public suffix list, which this package does not have, and a prefix-based
     * approximation cancels rules for domains the wildcard does not cover.
     *
     * @param left First domain list.
     * @param right Second domain list.
     *
     * @returns True when at least one entry of one list equals an entry of the
     *   other list. A missing list matches any domain, the same way a
     *   `$badfilter` without `$domain` disables a rule everywhere it applies.
     */
    private static haveIntersection(
        left: readonly string[] | null,
        right: readonly string[] | null,
    ): boolean {
        if (left === null || right === null) {
            return true;
        }

        return left.some((leftDomain) => right.some(
            (rightDomain) => RuleBadfilter.normalizeForComparison(leftDomain)
                === RuleBadfilter.normalizeForComparison(rightDomain),
        ));
    }

    /**
     * Brings a domain entry to the form used by the `$badfilter` comparison:
     * domain names are case-insensitive, while regexp patterns are compared as
     * written.
     *
     * @param domain Domain entry.
     *
     * @returns Domain entry to compare.
     */
    private static normalizeForComparison(domain: string): string {
        return isRegexPattern(domain) ? domain : domain.toLowerCase();
    }
}
