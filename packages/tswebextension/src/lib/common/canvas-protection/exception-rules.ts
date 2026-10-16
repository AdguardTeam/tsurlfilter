import { type Engine } from '@adguard/tsurlfilter';

import { ALLOWLIST_FILTER_ID } from '../constants';

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
}
