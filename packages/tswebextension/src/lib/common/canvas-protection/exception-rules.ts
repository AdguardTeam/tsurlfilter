import { type Engine, type MatchingResult, type NetworkRule } from '@adguard/tsurlfilter';

import { ALLOWLIST_FILTER_ID } from '../constants';
import { getRuleTexts as resolveRuleTexts, type RuleTextProvider } from '../utils/rule-text-provider';

import { CanvasPolicyCompiler } from './policy-compiler';

/**
 * Retrieves filter exception texts for canvas policy compilation.
 */
export class CanvasExceptionRules {
    /**
     * Retrieves active document or stealth exceptions, excluding generated allowlist rules.
     *
     * @param engine Engine with badfilter cancellations applied to exception candidates.
     *
     * @returns Available rule texts from filters other than the allowlist.
     */
    public static getRuleTexts(engine: Engine): string[] {
        const ruleTexts: string[] = [];
        for (const rule of engine.getDocumentOrStealthExceptionRules()) {
            const filterListId = rule.getFilterListId();
            if (filterListId !== ALLOWLIST_FILTER_ID) {
                const ruleText = engine.retrieveRuleText(filterListId, rule.getIndex());
                if (ruleText !== null) {
                    ruleTexts.push(ruleText);
                }
            }
        }
        return ruleTexts;
    }

    /**
     * Finds the `$stealth` exception that keeps canvas protection off for a document,
     * so the filtering log can show it. The page decides on its own, and only rules
     * that the policy compiler accepts reach it.
     *
     * @param matchingResult Matching result of a main frame or subframe request.
     * @param provider Rule text provider of the engine.
     *
     * @returns The exception, or `null` when no accepted `$stealth` exception matches the document.
     */
    public static findStealthException(
        matchingResult: MatchingResult,
        provider: RuleTextProvider,
    ): NetworkRule | null {
        return matchingResult.stealthRules?.find((rule) => (
            CanvasPolicyCompiler.parseRule(resolveRuleTexts(rule, provider).appliedRuleText)?.stealth === true
        )) ?? null;
    }
}
