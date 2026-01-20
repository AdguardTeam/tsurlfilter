import { type NetworkRule, type CosmeticRule, RULE_INDEX_NONE } from '@adguard/tsurlfilter';

/**
 * Rule text provider interface for retrieving rule texts from the engine.
 */
export interface RuleTextProvider {
    /**
     * Retrieves rule text by filter list id and rule index.
     *
     * @param filterListId Filter list id.
     * @param ruleIndex Rule index.
     *
     * @returns Rule text or `null` if rule is not found.
     */
    retrieveRuleText(filterListId: number, ruleIndex: number): string | null;

    /**
     * Retrieves the original rule text by its filter list identifier and rule index.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule text or `null`.
     */
    retrieveOriginalRuleText(filterId: number, ruleIndex: number): string | null;
}

/**
 * Result of rule text extraction.
 */
export interface RuleInfoText {
    /**
     * Applied (converted to AdGuard syntax) rule text.
     */
    appliedRuleText: string;

    /**
     * Original rule text as it appears in the filter list.
     */
    originalRuleText: string | null;
}

/**
 * Gets rule texts by filterId and ruleIndex using the provided RuleTextProvider.
 * This is used when you only have the rule identifiers (e.g., from CSS content markers)
 * and need to retrieve the full rule texts from the engine.
 *
 * @param filterId - Filter list identifier.
 * @param ruleIndex - Rule index.
 * @param provider - The provider that implements retrieveRuleText and retrieveOriginalRuleText.
 *
 * @returns Object containing appliedRuleText (non-null string with fallback) and originalRuleText (nullable).
 */
export function getRuleTextsByIndex(
    filterId: number,
    ruleIndex: number,
    provider: RuleTextProvider,
): RuleInfoText {
    // For negative indices (shouldn't happen during normal operation)
    if (ruleIndex < 0) {
        return {
            appliedRuleText: `<could not get rule text> (${filterId}:${ruleIndex})`,
            originalRuleText: null,
        };
    }

    const appliedRuleText = provider.retrieveRuleText(filterId, ruleIndex);
    const originalRuleText = provider.retrieveOriginalRuleText(filterId, ruleIndex);

    return {
        // fallback should never happen during normal operation
        appliedRuleText: appliedRuleText ?? `<rule text is not specified> (${filterId}:${ruleIndex})`,
        originalRuleText,
    };
}

/**
 * Gets rule texts from a rule using the provided RuleTextProvider.
 *
 * Handles both dynamic rules (index -1) and indexed rules.
 *
 * @param rule - The rule to extract texts from.
 * @param provider - The provider that implements retrieveRuleText and retrieveOriginalRuleText.
 *
 * @returns Object containing appliedRuleText (non-null string, empty if not found) and originalRuleText (nullable).
 */
export function getRuleTexts(
    rule: NetworkRule | CosmeticRule,
    provider: RuleTextProvider,
): RuleInfoText {
    if (!rule) {
        // should never happen during normal operation
        return {
            appliedRuleText: '<rule is not specified>',
            originalRuleText: null,
        };
    }

    const filterId = rule.getFilterListId();
    const ruleIndex = rule.getIndex();

    // For dynamic rules (index -1), use getText() directly
    if (ruleIndex === RULE_INDEX_NONE) {
        const appliedRuleText = rule.getText();

        return {
            // fallback should never happen during normal operation
            appliedRuleText: appliedRuleText ?? `<dynamic rule text is not specified> (${filterId}:${ruleIndex})`,
            originalRuleText: null,
        };
    }

    // For indexed rules, retrieve from provider
    const appliedRuleText = provider.retrieveRuleText(filterId, ruleIndex);
    const originalRuleText = provider.retrieveOriginalRuleText(filterId, ruleIndex);

    return {
        // fallback should never happen during normal operation
        appliedRuleText: appliedRuleText ?? `<rule text is not specified> (${filterId}:${ruleIndex})`,
        originalRuleText,
    };
}
