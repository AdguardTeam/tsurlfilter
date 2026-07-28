import {
    type NetworkRule,
    NetworkRuleOption,
    RemoveParamModifier,
    RequestType,
} from '@adguard/tsurlfilter';

import { type RemoveParamEngineApi } from '../abstract-remove-param-injection-service';
import { type MatchQuery } from '../interfaces';

import { getRuleTexts } from './rule-text-provider';

/**
 * Serialized representation of a single $removeparam rule descriptor.
 */
export interface RemoveParamDescriptor {
    value: string;
    isAllowlist: boolean;
    isImportant: boolean;
    filterId: number;
    ruleIndex: number;
    ruleText: string;
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
 * Result of $removeparam descriptor computation.
 */
export interface RemoveParamDescriptorsResult {
    /**
     * Descriptors for injection into the main world.
     */
    descriptors: RemoveParamDescriptor[];

    /**
     * Network rules corresponding 1:1 to descriptors (same order).
     * Used by callers for filtering log event publishing.
     */
    rules: NetworkRule[];
}

/**
 * Computes $removeparam rule descriptors for a given document URL by querying
 * the engine API.
 *
 * @param params Parameters for descriptor computation.
 *
 * @returns Object with descriptors and rules, or null if no rules match.
 */
export function getRemoveParamDescriptors(
    params: GetRemoveParamDescriptorsParams,
): RemoveParamDescriptorsResult | null {
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

    const descriptors = removeParamRules.map((rule: NetworkRule) => {
        const { appliedRuleText } = getRuleTexts(rule, engineApi);
        const modifierValue = rule.getAdvancedModifierValue();
        return {
            value: modifierValue || '',
            isAllowlist: rule.isAllowlist(),
            isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
            filterId: rule.getFilterListId(),
            ruleIndex: rule.getIndex(),
            ruleText: appliedRuleText,
        };
    });

    return { descriptors, rules: removeParamRules };
}

/**
 * Filters $removeparam rules to only those that would actually modify the URL.
 * Excludes allowlist rules and rules whose targeted parameter is not present.
 *
 * @param url The request URL to check against.
 * @param rules Array of NetworkRule instances with $removeparam modifier.
 *
 * @returns Subset of rules that would effectively remove at least one parameter.
 */
export function filterEffectiveRemoveParamRules(
    url: string,
    rules: NetworkRule[],
): NetworkRule[] {
    return rules.filter((rule) => {
        if (rule.isAllowlist()) {
            return false;
        }

        const modifier = rule.getAdvancedModifier();
        if (!modifier || !RemoveParamModifier.isRemoveParamModifier(modifier)) {
            return false;
        }

        return modifier.removeParameters(url) !== url;
    });
}
