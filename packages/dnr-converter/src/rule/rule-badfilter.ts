/**
 * @file Helper class for badfilter rule negation checks.
 *
 * Extracted from the main rule module so that the badfilter comparison
 * logic can be reasoned about and tested in isolation.
 */

import { NetworkRuleParser } from '@adguard/agtree/parser';

import { OPTIONS_DELIMITER } from '../constants';
import { POPULAR_TLDS } from '../constants/popular-tlds';
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
     * Permitted `$domain` entries as written in the rule text, before any
     * badfilter narrowed the rule. Equal to `permittedDomains` for a parsed rule.
     */
    readonly originalPermittedDomains?: string[] | null;
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
 * Suffix of a wildcard TLD entry, e.g. `example.*`.
 */
const WILDCARD_TLD_SUFFIX = '.*';

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
 * Outcome of matching a `$badfilter` rule against a target rule.
 */
export enum BadfilterNegationKind {
    /**
     * The badfilter rule does not affect the target rule.
     */
    None = 'none',

    /**
     * The badfilter rule cancels the target rule for every domain.
     */
    Full = 'full',

    /**
     * The badfilter rule cancels the target rule only for the domains present in
     * both `$domain` lists.
     */
    Partial = 'partial',
}

/**
 * Result of {@link RuleBadfilter.negationScope}.
 */
export type BadfilterNegation =
    | { readonly kind: BadfilterNegationKind.None }
    | { readonly kind: BadfilterNegationKind.Full }
    | {
        readonly kind: BadfilterNegationKind.Partial;

        /**
         * Domains that stay in the target rule's permitted `$domain` list.
         */
        readonly permittedDomains: string[];

        /**
         * Domains that the kept permitted entries still cover, but that the
         * badfilter cancels. The target rule must exclude them.
         */
        readonly excludedDomains: string[];
    };

/**
 * Helper class for checking whether a `$badfilter` rule negates another rule.
 */
export class RuleBadfilter {
    /**
     * Determines how `badfilterRule` affects `targetRule`.
     *
     * A `$badfilter` rule negates another rule when the text of the two rules, as
     * written in the rule text, matches: the whole text is taken, `$badfilter` is
     * dropped from it, and the rest must be equal. That covers the pattern, the
     * allowlist flag and every modifier with its value, order and repeats — rules
     * that only look equal after parsing (for example `$removeheader=Set-Cookie`
     * against `set-cookie`, or `$queryprune` against `$removeparam`) do not match.
     *
     * A rule with `$domain` and without negated domains is an exception: it
     * negates the target rule only for the domains that the badfilter covers, so
     * the `$domain` entries are dropped from both texts and the rest is compared.
     * The badfilter entries are then subtracted from the target list: an empty
     * result means {@link BadfilterNegationKind.Full}, no removed entry and no
     * exclusion means {@link BadfilterNegationKind.None}, and the entries that
     * stay mean {@link BadfilterNegationKind.Partial}. A badfilter entry that is
     * a subdomain of a kept target entry becomes an exclusion, because the kept
     * entry still covers it in DNR.
     *
     * @param badfilterRule The rule that carries the `$badfilter` modifier.
     * @param targetRule The rule to test for negation.
     * @param currentPermittedDomains Permitted domains that the target rule still
     *   has after earlier badfilters narrowed it. Defaults to the target rule's
     *   own list. The intersection check always uses the original list, because
     *   MV2 compares the written rule text.
     *
     * @returns How `badfilterRule` affects `targetRule`.
     */
    public static negationScope(
        badfilterRule: BadfilterTarget,
        targetRule: BadfilterTarget,
        currentPermittedDomains: readonly string[] | null = targetRule.permittedDomains,
    ): BadfilterNegation {
        if (!badfilterRule.enabledModifiers.has(OPTION_NAMES.BADFILTER)) {
            return { kind: BadfilterNegationKind.None };
        }

        const withoutBadfilter = stripWrittenModifiers(badfilterRule.originalText, isBadfilterModifier);

        if (!RuleBadfilter.isPartialDomainCase(badfilterRule, targetRule)) {
            return withoutBadfilter === targetRule.originalText
                ? { kind: BadfilterNegationKind.Full }
                : { kind: BadfilterNegationKind.None };
        }

        if (stripWrittenModifiers(withoutBadfilter, isDomainModifier)
            !== stripWrittenModifiers(targetRule.originalText, isDomainModifier)) {
            return { kind: BadfilterNegationKind.None };
        }

        const writtenPermittedDomains = targetRule.originalPermittedDomains ?? targetRule.permittedDomains;

        // A missing list matches any domain, so the other list is cancelled
        // everywhere. When the target rule has no `$domain`, MV2 does not cancel
        // it everywhere: this branch keeps the whole-rule cancellation, which is
        // a known limitation of the converter.
        if (badfilterRule.permittedDomains === null || writtenPermittedDomains === null) {
            return { kind: BadfilterNegationKind.Full };
        }

        // MV2 negates only when the two lists share an identically written
        // entry. A wildcard entry does not intersect a concrete entry there,
        // even when it covers it.
        if (!RuleBadfilter.haveIntersection(writtenPermittedDomains, badfilterRule.permittedDomains)) {
            return { kind: BadfilterNegationKind.None };
        }

        const { permittedDomains, excludedDomains } = RuleBadfilter.narrowDomains(
            currentPermittedDomains ?? writtenPermittedDomains,
            badfilterRule.permittedDomains,
        );

        if (permittedDomains.length === 0) {
            return { kind: BadfilterNegationKind.Full };
        }

        // No entry was removed and no entry needs an exclusion, so the two
        // lists do not overlap.
        if (
            permittedDomains.length === (currentPermittedDomains ?? writtenPermittedDomains).length
            && excludedDomains.length === 0
        ) {
            return { kind: BadfilterNegationKind.None };
        }

        return { kind: BadfilterNegationKind.Partial, permittedDomains, excludedDomains };
    }

    /**
     * Checks whether `badfilterRule` negates `targetRule` at least partly.
     *
     * @param badfilterRule The rule that carries the `$badfilter` modifier.
     * @param targetRule The rule to test for negation.
     *
     * @returns `true` if `badfilterRule` negates `targetRule`.
     */
    public static negates(badfilterRule: BadfilterTarget, targetRule: BadfilterTarget): boolean {
        return RuleBadfilter.negationScope(badfilterRule, targetRule).kind
            !== BadfilterNegationKind.None;
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
     * Checks whether the two lists share an identically written entry.
     *
     * This is the same check that `DomainModifier.haveIntersection` applies in
     * MV2: a plain domain name is compared case-insensitively, while a regexp
     * pattern keeps its case. A wildcard entry does not intersect a concrete
     * entry, even when it covers it.
     *
     * @param left First domain list.
     * @param right Second domain list.
     *
     * @returns True when the lists share an entry.
     */
    private static haveIntersection(left: readonly string[], right: readonly string[]): boolean {
        const normalizedRight = new Set(right.map(RuleBadfilter.normalizeForComparison));

        return left.some((entry) => normalizedRight.has(RuleBadfilter.normalizeForComparison(entry)));
    }

    /**
     * Splits the target domain list into the entries that stay and the
     * exclusions that the kept entries need.
     *
     * A target entry is removed when a badfilter entry covers every domain that
     * the target entry matches. A badfilter entry that a kept target entry
     * covers is added to the exclusions, because the kept entry still matches it
     * in DNR.
     *
     * Entries are compared as written, as `$badfilter` matches the rule text; a
     * plain domain name is compared case-insensitively, because a domain name is
     * case-insensitive, while a regexp pattern keeps its case. A regexp entry
     * covers only an identically written entry, because the package cannot
     * reason about pattern coverage.
     *
     * The MV2 twin receives values already normalized by `DomainModifier`, which
     * resolves the separator escape, so an escaped separator in a regexp entry
     * compares equal to the unescaped one there — a pre-existing divergence that
     * the `$domain` decision has to settle.
     *
     * @param targetDomains Domains permitted by the target rule.
     * @param badfilterDomains Domains permitted by the badfilter rule.
     *
     * @returns Target domains that stay and domains to exclude from them.
     */
    private static narrowDomains(
        targetDomains: readonly string[],
        badfilterDomains: readonly string[],
    ): { permittedDomains: string[]; excludedDomains: string[] } {
        const badfilterEntries = badfilterDomains.map(RuleBadfilter.normalizeForComparison);

        const permittedDomains = targetDomains.filter((targetDomain) => {
            const normalizedTarget = RuleBadfilter.normalizeForComparison(targetDomain);

            return !badfilterEntries.some(
                (badfilterDomain) => RuleBadfilter.isEntryUnder(normalizedTarget, badfilterDomain),
            );
        });

        const excludedDomains = badfilterDomains.filter((badfilterDomain) => {
            const normalizedBadfilter = RuleBadfilter.normalizeForComparison(badfilterDomain);

            return permittedDomains.some((targetDomain) => RuleBadfilter.isEntryUnder(
                normalizedBadfilter,
                RuleBadfilter.normalizeForComparison(targetDomain),
            ));
        });

        return {
            permittedDomains,
            excludedDomains: [...new Set(excludedDomains)],
        };
    }

    /**
     * Checks whether `parent` covers every domain that `child` matches.
     *
     * A plain domain covers itself and its subdomains. A wildcard TLD entry is
     * expanded with {@link POPULAR_TLDS}, the same list that
     * `RegularRuleConverter.prepareDeclarativeDomains` uses for
     * `initiatorDomains`, so the check matches the converted rule. A regexp
     * entry covers only an identically written entry.
     *
     * @param child Domain entry to check.
     * @param parent Domain entry that may cover it.
     *
     * @returns True when `parent` covers `child`.
     */
    private static isEntryUnder(child: string, parent: string): boolean {
        if (isRegexPattern(child) || isRegexPattern(parent)) {
            return child === parent;
        }

        if (parent.endsWith(WILDCARD_TLD_SUFFIX)) {
            const prefix = parent.slice(0, -WILDCARD_TLD_SUFFIX.length);

            if (child.endsWith(WILDCARD_TLD_SUFFIX)) {
                return child === parent || child.endsWith(`.${parent}`);
            }

            return POPULAR_TLDS.some((tld) => {
                const expanded = `${prefix}.${tld}`;

                return child === expanded || child.endsWith(`.${expanded}`);
            });
        }

        // A wildcard covers many TLDs, so a plain parent cannot cover it.
        if (child.endsWith(WILDCARD_TLD_SUFFIX)) {
            return false;
        }

        return child === parent || child.endsWith(`.${parent}`);
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
