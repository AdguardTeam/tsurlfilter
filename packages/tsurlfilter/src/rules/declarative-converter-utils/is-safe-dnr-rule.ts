/**
 * @file Separate file for the `isSafeRule` function, because it can be used
 * outside of the declarative converter to check if a rule is safe, e.g. for
 * passing rules to "skip review" in CWS.
 */
import { type DeclarativeRule, RuleActionType } from '../declarative-converter/declarative-rule';

/**
 * List of declarative rule actions which are considered safe.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#safe_rules}
 */
const SAFE_RULE_ACTIONS: ReadonlySet<RuleActionType> = new Set([
    RuleActionType.BLOCK,
    RuleActionType.ALLOW,
    RuleActionType.ALLOW_ALL_REQUESTS,
    RuleActionType.UPGRADE_SCHEME,
]);

/**
 * Checks whether the declarative rule is safe.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#safe_rules}
 *
 * @param rule Declarative rule to check.
 *
 * @returns True if the rule is safe, otherwise false.
 */
export const isSafeRule = (rule: DeclarativeRule): boolean => {
    return SAFE_RULE_ACTIONS.has(rule.action.type);
};
