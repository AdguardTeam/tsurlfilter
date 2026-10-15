/**
 * @file Helper class for badfilter rule negation checks.
 *
 * Extracted from the main rule module so that the badfilter comparison
 * logic can be reasoned about and tested in isolation.
 */

import { NetworkRuleParser } from '@adguard/agtree/parser';

import { OPTIONS_DELIMITER } from '../constants';
import { isRegexPattern } from '../utils/string';

import { OPTION_NAMES } from './option-names';

/**
 * Minimal structural interface required by {@link RuleBadfilter.negates}.
 * Any object that has these fields (including {@link Rule}) can be passed
 * without creating a circular module dependency.
 */
interface BadfilterTarget {
    /**
     * Enabled modifiers, used to check that the rule carries `$badfilter`.
     */
    readonly enabledModifiers: ReadonlySet<string>;
    readonly permittedDomains: string[] | null;
    readonly restrictedDomains: string[] | null;
    /**
     * Rule text as written in the filter list, before conversion to AG syntax.
     */
    readonly originalText: string;
}

/**
 * Separates the entries of a written modifier list.
 *
 * A separator escaped with a backslash belongs to the value, not to the list.
 */
const WRITTEN_MODIFIER_SEPARATOR_REGEXP = /(?<!\\),/;

/**
 * Name of the `$domain` alias of other syntaxes, as it appears in the written
 * rule text.
 */
const DOMAIN_ALIAS_OPTION_NAME = 'from';

/**
 * Returns the name of a written modifier entry, without the negation mark.
 *
 * @param entry Written modifier entry, e.g. `~third-party` or `csp=script-src`.
 *
 * @returns Modifier name.
 */
const getWrittenModifierName = (entry: string): string => entry.replace(/^~/, '').split('=')[0] ?? '';

/**
 * Removes the given modifiers from the rule text as written.
 *
 * `$badfilter` requires the text to match, so the modifiers that take part in
 * the match are dropped from the text instead of being compared separately.
 *
 * The modifier list starts after the separator, found the same way as in the
 * parser: the last unescaped `$` that is not followed by a regexp marker, so an
 * end anchor in a regexp pattern is not taken for it. The text is rebuilt as it
 * was apart from the dropped entries.
 *
 * @param text Rule text as written.
 * @param shouldStrip Predicate selecting the modifier names to remove.
 *
 * @returns Rule text without the selected modifiers.
 */
const stripWrittenModifiers = (text: string, shouldStrip: (name: string) => boolean): string => {
    const delimiterIndex = NetworkRuleParser.findNetworkRuleSeparatorIndex(text);

    if (delimiterIndex === -1) {
        return text;
    }

    const pattern = text.slice(0, delimiterIndex);
    const kept = text
        .slice(delimiterIndex + 1)
        .split(WRITTEN_MODIFIER_SEPARATOR_REGEXP)
        .filter((entry) => !shouldStrip(getWrittenModifierName(entry)));

    return kept.length === 0 ? pattern : `${pattern}${OPTIONS_DELIMITER}${kept.join(',')}`;
};

/**
 * Checks whether the modifier name is `$badfilter`.
 *
 * @param name Modifier name.
 *
 * @returns True for the `$badfilter` modifier.
 */
const isBadfilterModifier = (name: string): boolean => name === OPTION_NAMES.BADFILTER;

/**
 * Checks whether the modifier name restricts a rule by domain.
 *
 * `$domain` has the `$from` alias in other syntaxes, and both are dropped when a
 * rule with `$domain` disables the target rule only partially.
 *
 * @param name Modifier name.
 *
 * @returns True for `$domain` and its alias.
 */
const isDomainModifier = (name: string): boolean => name === OPTION_NAMES.DOMAIN
    || name === DOMAIN_ALIAS_OPTION_NAME;

/**
 * Helper class for checking whether a `$badfilter` rule negates another rule.
 */
export class RuleBadfilter {
    /**
     * Checks whether `badfilterRule` negates `targetRule`.
     *
     * A `$badfilter` rule negates another rule when the text of the two rules, as
     * written in the rule text, matches: the whole text is taken, `$badfilter` is
     * dropped from it, and the rest must be equal. That covers the pattern, the
     * allowlist flag and every modifier with its value, order and repeats — rules
     * that only look equal after parsing (for example `$removeheader=Set-Cookie`
     * against `set-cookie`, or `$queryprune` against `$removeparam`) do not match.
     *
     * A rule with `$domain` and without negated domains is an exception: it
     * negates the target rule only for the domains present in both lists, so the
     * `$domain` entries are dropped from both texts and the rest is compared,
     * together with an intersection check of the two domain lists.
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

        const withoutBadfilter = stripWrittenModifiers(badfilterRule.originalText, isBadfilterModifier);

        if (!RuleBadfilter.isPartialDomainCase(badfilterRule, targetRule)) {
            return withoutBadfilter === targetRule.originalText;
        }

        return stripWrittenModifiers(withoutBadfilter, isDomainModifier)
                === stripWrittenModifiers(targetRule.originalText, isDomainModifier)
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
