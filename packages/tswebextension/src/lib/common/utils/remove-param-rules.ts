import {
    type MatchingResult,
    type NetworkRule,
    NetworkRuleOption,
    RequestType,
} from '@adguard/tsurlfilter';

import { type MatchQuery } from '../interfaces';
import { type RemoveParamDescriptor } from '../message';

import { getRuleTexts, type RuleTextProvider } from './rule-text-provider';

/**
 * Interface for the engine API subset needed for removeparam descriptor computation.
 */
interface RemoveParamEngineApi extends RuleTextProvider {
    /**
     * Matches a request against the engine's filter rules.
     *
     * @param matchQuery The match query.
     *
     * @returns Matching result or null.
     */
    matchRequest(matchQuery: MatchQuery): MatchingResult | null;
}

/**
 * Parameters for computing $removeparam descriptors.
 */
interface GetRemoveParamDescriptorsParams {
    /**
     * URL of the document being navigated to.
     */
    requestUrl: string;

    /**
     * URL of the main frame (tab URL).
     */
    frameUrl: string;

    /**
     * Main frame rule from tab context (may be null).
     */
    frameRule: MatchQuery['frameRule'];

    /**
     * Engine API instance for matching requests.
     */
    engineApi: RemoveParamEngineApi;
}

/**
 * Computes $removeparam rule descriptors for a given document URL by querying
 * the engine API.
 *
 * @param params Parameters for descriptor computation.
 *
 * @returns Array of descriptors, or null if no rules match.
 */
export function getRemoveParamDescriptors(
    params: GetRemoveParamDescriptorsParams,
): RemoveParamDescriptor[] | null {
    const {
        requestUrl,
        frameUrl,
        frameRule,
        engineApi,
    } = params;

    const matchingResult = engineApi.matchRequest({
        requestUrl,
        frameUrl,
        requestType: RequestType.Document,
        frameRule,
    });

    if (!matchingResult) {
        return null;
    }

    const removeParamRules = matchingResult.getRemoveParamRules();
    if (removeParamRules.length === 0) {
        return null;
    }

    return removeParamRules.map((rule: NetworkRule) => {
        const { appliedRuleText } = getRuleTexts(rule, engineApi);
        const modifierValue = rule.getAdvancedModifierValue();
        return {
            value: modifierValue || '',
            isAllowlist: rule.isAllowlist(),
            isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
            filterId: rule.getFilterListId(),
            ruleIndex: rule.getIndex(),
            ruleText: appliedRuleText,
            advancedModifier: modifierValue,
        };
    });
}
