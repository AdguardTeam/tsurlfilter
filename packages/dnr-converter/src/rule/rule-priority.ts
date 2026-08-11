/**
 * @file Priority calculation for {@link ParsedNetworkRule} instances.
 *
 * Extracted from the main rule module so that the priority logic can be
 * reasoned about and tested in isolation.
 */

import { type ConversionMeta } from './rule-types';

/**
 * Calculates DNR rule priority from intermediate {@link ConversionMeta}.
 *
 * Priority mirrors the calculation performed by tsurlfilter's
 * `calculateRulePriority()`:
 *
 * - Category 1 (+1 each): `$third-party`, `$match-case`, `$dnsrewrite`,
 *   restricted domains, restricted methods, denyallow domains, `$to`.
 * - Category 2 (+50 / count): permitted content types.
 * - Category 3 (+100 / count): permitted domains.
 * - Category 4 (+1 000): redirect modifiers.
 * - Category 5 (*10 000): specific exclusion modifiers.
 * - Category 6 (+100 000): allowlist rules.
 * - Category 7 (+1 000 000): `$important`.
 *
 * The final value is rounded up to the nearest integer (≥ 1).
 */
export class RulePriority {
    /**
     * Weight for a single permitted content-type when only one type is set.
     */
    private static readonly CATEGORY_TWO_WEIGHT = 50;

    /**
     * Weight for a single permitted domain.
     */
    private static readonly CATEGORY_THREE_WEIGHT = 100;

    /**
     * Base weight for redirect rules (Category 4).
     */
    private static readonly CATEGORY_FOUR_WEIGHT = 1_000;

    /**
     * Weight per specific-exclusion modifier (Category 5).
     */
    private static readonly CATEGORY_FIVE_WEIGHT = 10_000;

    /**
     * Weight for allowlist rules (Category 6).
     */
    private static readonly CATEGORY_SIX_WEIGHT = 100_000;

    /**
     * Weight for `$important` modifier (Category 7).
     */
    private static readonly CATEGORY_SEVEN_WEIGHT = 1_000_000;

    /**
     * Calculates rule priority from intermediate {@link ConversionMeta}.
     *
     * @param meta Intermediate conversion metadata produced during modifier
     *   processing.
     * @param isAllowlist Whether the rule is an allowlist (exception) rule.
     *
     * @returns Rule priority (positive integer ≥ 1).
     */
    public static calculate(meta: ConversionMeta, isAllowlist: boolean): number {
        // Base weight (1) + category-1 modifier contributions (+1 each).
        let weight = 1 + meta.baseModifierCount;

        // Category 2 — permitted content types
        if (meta.permittedContentTypeCount > 0) {
            weight += RulePriority.CATEGORY_TWO_WEIGHT
                + RulePriority.CATEGORY_TWO_WEIGHT / meta.permittedContentTypeCount;
        }

        // Category 2 — permitted HTTP methods (same formula as content types)
        if (meta.permittedMethodCount > 0) {
            weight += RulePriority.CATEGORY_TWO_WEIGHT
                + RulePriority.CATEGORY_TWO_WEIGHT / meta.permittedMethodCount;
        }

        // Category 2 — $header modifier (flat weight, no /count division)
        if (meta.hasHeader) {
            weight += RulePriority.CATEGORY_TWO_WEIGHT;
        }

        // Category 3 — permitted domains
        if (meta.permittedDomainCount > 0) {
            weight += RulePriority.CATEGORY_THREE_WEIGHT
                + RulePriority.CATEGORY_THREE_WEIGHT / meta.permittedDomainCount;
        }

        // Category 4 — redirect
        if (meta.hasRedirect) {
            weight += RulePriority.CATEGORY_FOUR_WEIGHT;
        }

        // Category 5 — specific exclusions (additive: +10_000 per modifier)
        if (meta.specificExclusionCount > 0) {
            weight += meta.specificExclusionCount * RulePriority.CATEGORY_FIVE_WEIGHT;
        }

        // Category 6 — allowlist
        if (isAllowlist) {
            weight += RulePriority.CATEGORY_SIX_WEIGHT;
        }

        // Category 7 — important
        if (meta.hasImportant) {
            weight += RulePriority.CATEGORY_SEVEN_WEIGHT;
        }

        return Math.max(1, Math.ceil(weight));
    }
}
