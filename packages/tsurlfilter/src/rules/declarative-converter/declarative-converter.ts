import { ERROR_STATUS_CODES } from './../../common/constants';
import { DeclarativeRule } from './declarative-rule';
import { NetworkRule, NetworkRuleOption } from '../network-rule';
import { DeclarativeRuleConverter } from './declarative-rule-converter';
import { IRuleList } from '../../filterlist/rule-list';
import { ScannerType } from '../../filterlist/scanner/scanner-type';
import { IndexedRule } from '../rule';

/**
 * Converter class
 * Provides a functionality of conversion AG rules to declarative rules.
 */
export class DeclarativeConverter {
    /**
     * Converts a set of rules to declarative rules array
     *
     * @param ruleList
     * @param maxLimit - max allowed number of rules in the list
     * @param maxRegexLimit - max allowed number of regular expression rules in the list
     */
    // eslint-disable-next-line class-methods-use-this
    public convert(
        ruleList: IRuleList,
        maxLimit = Number.MAX_SAFE_INTEGER,
        maxRegexLimit = Number.MAX_SAFE_INTEGER,
    ): DeclarativeRule[] {
        const indexedRules: IndexedRule[] = [];
        const badfilterRules: NetworkRule[] = [];

        const scanner = ruleList.newScanner(ScannerType.NetworkRules);
        while (scanner.scan()) {
            const iRule = scanner.getRule();
            if (!iRule) {
                continue;
            }

            const rule = iRule.rule as NetworkRule;

            if (rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
                badfilterRules.push(rule);
            } else if (DeclarativeConverter.isRuleApplicable(rule)) {
                indexedRules.push(iRule);
            }
        }

        const result: DeclarativeRule[] = [];
        indexedRules.forEach((iRule) => {
            const rule = iRule.rule as NetworkRule;

            for (const badfilter of badfilterRules) {
                if (badfilter.negatesBadfilter(rule)) {
                    return;
                }
            }

            const dRule = DeclarativeRuleConverter.convert(
                rule, DeclarativeConverter.createDeclarativeRuleId(iRule.index),
            );
            if (dRule) {
                result.push(dRule);
            }

            if (result.length > maxLimit) {
                // eslint-disable-next-line max-len
                throw new Error(`Status: ${ERROR_STATUS_CODES.RULE_LIMIT} Message: Maximum allowed rules count reached: ${maxLimit}`);
            }

            const regexpRules = result.filter((i) => i.condition.regexFilter);

            if (regexpRules.length > maxRegexLimit) {
                // eslint-disable-next-line max-len
                throw new Error(`Status: ${ERROR_STATUS_CODES.REGEXP_RULE_LIMIT} Message: Maximum allowed regex rules count reached: ${maxRegexLimit}`);
            }
        });

        return result;
    }

    /**
     * A lot of rules don't make any sense in declarative context.
     * So here we check if rule is suitable for declarative syntax or not.
     *
     * We skip some single option rules like ($elemhide, $jsinject, $generichide etc)
     * @param rule
     */
    private static isRuleApplicable(rule: NetworkRule): boolean {
        if (!rule.isAllowlist()) {
            return true;
        }

        if (rule.isSingleOptionEnabled(NetworkRuleOption.Elemhide)
            || rule.isSingleOptionEnabled(NetworkRuleOption.Jsinject)
            || rule.isSingleOptionEnabled(NetworkRuleOption.Cookie)
            || rule.isSingleOptionEnabled(NetworkRuleOption.Csp)
            || rule.isSingleOptionEnabled(NetworkRuleOption.Replace)
            || rule.isSingleOptionEnabled(NetworkRuleOption.Generichide)
            || rule.isSingleOptionEnabled(NetworkRuleOption.Stealth)
            || rule.isSingleOptionEnabled(NetworkRuleOption.Mp4)) {
            return false;
        }

        return true;
    }

    /**
     * Creates declarative rule identifier
     * An id which uniquely identifies a rule. Mandatory and should be >= 1.
     *
     * @param index rule list index
     */
    private static createDeclarativeRuleId(index: number): number {
        return index + 1;
    }
}
