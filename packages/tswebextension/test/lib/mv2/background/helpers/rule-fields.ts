import { type NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';

import { type ApplyBasicRuleEventData } from '../../../../../src/lib/common/filtering-log';

type Fields = Pick<
    ApplyBasicRuleEventData,
    | 'isAllowlist'
    | 'isImportant'
    | 'isDocumentLevel'
    | 'isCsp'
    | 'isCookie'
    | 'advancedModifier'
> & {
    // filterId and ruleIndex can be null in ApplyBasicRuleEventData
    // but here we assume that they are always present (for test purposes)
    filterId: number;
    ruleIndex: number;
};

/**
 * This helper function retrieves associated fields from network rules pertinent to network rule events.
 *
 * @param rule Network rule instance to extract fields from.
 * @returns Fields extracted from the network rule.
 */
export const getNetworkRuleFields = (rule: NetworkRule): Fields => ({
    filterId: rule.getFilterListId(),
    ruleIndex: rule.getIndex(),
    isAllowlist: rule.isAllowlist(),
    isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
    isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
    isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
    isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
    advancedModifier: rule.getAdvancedModifierValue(),
});
