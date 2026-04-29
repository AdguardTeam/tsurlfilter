import {
    type MatchingResult,
    type NetworkRule,
    type RemoveParamModifier,
    RequestType,
} from '@adguard/tsurlfilter';

import { type MatchQuery } from '../interfaces';

/**
 * Minimal interface for the engine API required by {@link getRemoveParamUrl}.
 * Both MV2 and MV3 `EngineApi` satisfy this contract.
 */
interface EngineApiLike {
    matchRequest(matchQuery: MatchQuery): MatchingResult | null;
}

/**
 * Minimal interface for a tab context required by {@link getRemoveParamUrl}.
 * Both MV2 and MV3 `TabContext` satisfy this contract.
 */
interface TabContextLike {
    info: { url?: string };
    mainFrameRule: NetworkRule | null;
}

/**
 * Callback invoked for each `$removeparam` rule that is evaluated.
 *
 * @param rule The network rule being applied.
 * @param url The URL **after** the rule has been applied (for blocking rules)
 * or the original URL (for allowlist rules).
 */
export type OnRemoveParamRuleApplied = (rule: NetworkRule, url: string) => void;

/**
 * Evaluates `$removeparam` rules against a URL from a History API call
 * and returns the sanitized URL.
 *
 * @param url URL to evaluate (absolute).
 * @param tabContext Tab context with the current page URL and frame rule.
 * @param engineApi Engine API instance with `matchRequest`.
 * @param onRuleApplied Optional callback invoked for each evaluated rule,
 * used by callers to publish filtering log events.
 *
 * @returns Purged URL string, or `null` if no rules matched or the URL
 * is unchanged.
 */
export function getRemoveParamUrl(
    url: string,
    tabContext: TabContextLike,
    engineApi: EngineApiLike,
    onRuleApplied?: OnRemoveParamRuleApplied,
): string | null {
    if (!tabContext.info.url) {
        return null;
    }

    const matchQuery: MatchQuery = {
        requestUrl: url,
        frameUrl: tabContext.info.url,
        requestType: RequestType.Document,
        frameRule: tabContext.mainFrameRule,
    };

    const matchingResult = engineApi.matchRequest(matchQuery);
    if (!matchingResult) {
        return null;
    }

    const removeParamRules = matchingResult.getRemoveParamRules();
    if (removeParamRules.length === 0) {
        return null;
    }

    let purgedUrl = url;

    for (const rule of removeParamRules) {
        if (rule.isAllowlist()) {
            onRuleApplied?.(rule, purgedUrl);
            continue;
        }

        const modifier = rule.getAdvancedModifier() as RemoveParamModifier;
        const modifiedUrl = modifier.removeParameters(purgedUrl);

        if (modifiedUrl !== purgedUrl) {
            onRuleApplied?.(rule, modifiedUrl);
        }

        purgedUrl = modifiedUrl;
    }

    if (purgedUrl === url) {
        return null;
    }

    return purgedUrl;
}
