import { ERROR_STATUS_CODES } from '../../common/constants';
import { logger } from '../../utils/logger';
import { DeclarativeRule } from './declarative-rule';
import { NetworkRule, NetworkRuleOption } from '../network-rule';
import { DeclarativeRuleConverter } from './declarative-rule-converter';
import { IRuleList } from '../../filterlist/rule-list';
import { ScannerType } from '../../filterlist/scanner/scanner-type';
import { IndexedRule } from '../rule';

interface IConvertOptions {
    resoursesPath?: string,
    maxLimit?: number,
    maxRegexLimit?: number,
}

const defaultOptions: IConvertOptions = {
    maxLimit: Number.MAX_SAFE_INTEGER,
    maxRegexLimit: Number.MAX_SAFE_INTEGER,
};

/**
 * Converter class
 * Provides a functionality of conversion AG rules to declarative rules.
 */
export class DeclarativeConverter {
    /** Storages current extra id which can be used
     * for extra dynamic-created rules, like $denyallow */
    private extraIndex = 0;

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
        options?: IConvertOptions,
    ): DeclarativeRule[] {
        const resoursesPath = options?.resoursesPath;
        const maxLimit = options?.maxLimit || defaultOptions.maxLimit!;
        const maxRegexLimit = options?.maxRegexLimit || defaultOptions.maxRegexLimit!;

        if (resoursesPath) {
            DeclarativeRuleConverter.WebAccesibleResoursesPath = resoursesPath;
        }

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

        // Remembers maximum possible index from all indexed rules
        // for allocate extra id's after these indexes
        if (indexedRules.length > 0) {
            const maxIndex = indexedRules[indexedRules.length - 1].index;
            this.extraIndex = DeclarativeConverter.createDeclarativeRuleId(maxIndex);
        }

        // This function used for allocate extra unique id's for synthetic-created declarative rules
        // for network rules with modificator $denyallow
        const getExtraIndex = (): number => {
            this.extraIndex += 1;
            return this.extraIndex;
        };

        let regexpRulesCounter = 0;

        const result: DeclarativeRule[] = [];
        indexedRules.forEach((iRule) => {
            const rule = iRule.rule as NetworkRule;

            for (const badfilter of badfilterRules) {
                if (badfilter.negatesBadfilter(rule)) {
                    return;
                }
            }

            let dRules;
            try {
                dRules = DeclarativeRuleConverter.convert(
                    rule,
                    DeclarativeConverter.createDeclarativeRuleId(iRule.index),
                    getExtraIndex,
                );
            } catch (e: any) {
                logger.info(e.message);
            }

            if (dRules) {
                dRules.forEach((dRule) => {
                    result.push(dRule);

                    if (dRule.condition.regexFilter) {
                        regexpRulesCounter += 1;
                    }
                });
            }

            if (result.length > maxLimit) {
                // eslint-disable-next-line max-len
                throw new Error(`Status: ${ERROR_STATUS_CODES.RULE_LIMIT} Message: Maximum allowed rules count reached: ${maxLimit}`);
            }

            if (regexpRulesCounter > maxRegexLimit) {
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
