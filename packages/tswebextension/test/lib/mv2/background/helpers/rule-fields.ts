import { type NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';
import { type ApplyBasicRuleEventData } from '@lib/common';

type Fields = Pick<
    ApplyBasicRuleEventData,
    | 'filterId'
    | 'ruleIndex'
    | 'isAllowlist'
    | 'isImportant'
    | 'isDocumentLevel'
    | 'isCsp'
    | 'isCookie'
    | 'advancedModifier'
>;

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
