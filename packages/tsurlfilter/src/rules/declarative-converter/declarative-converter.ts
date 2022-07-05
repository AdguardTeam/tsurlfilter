import { ERROR_STATUS_CODES } from '../../common/constants';
import { logger } from '../../utils/logger';
import { DeclarativeRule } from './declarative-rule';
import { NetworkRule, NetworkRuleOption } from '../network-rule';
import { DeclarativeRuleConverter } from './declarative-rule-converter';
import { IRuleList } from '../../filterlist/rule-list';
import { ScannerType } from '../../filterlist/scanner/scanner-type';
import { IndexedRule } from '../rule';
import { RemoveParamModifier } from '../../modifiers/remove-param-modifier';

interface IConvertOptions {
    // Path to web accessible resources, relative to the extension root dir. Should start with leading slash '/'
    resourcesPath?: string,
    // Max allowed number of rules in the list
    maxLimit?: number,
    // Max allowed number of regular expression rules in the list
    maxRegexLimit?: number,
    // Offset for generated identifiers of new declarative rules
    offsetId?: number,
    // Should the filter ID be stored in the source map value or not
    saveFilterId?: boolean,
}

const defaultOptions: IConvertOptions = {
    maxLimit: Number.MAX_SAFE_INTEGER,
    maxRegexLimit: Number.MAX_SAFE_INTEGER,
};

export type ConvertedRuleId = number;
export type HashOriginalRule = number;
export type { DeclarativeRule };

type ConvertedResult = {
    declarativeRules: DeclarativeRule[],
    convertedSourceMap: Map<ConvertedRuleId, HashOriginalRule>,
};

// Because for all static filters we have ID's less than 1000,
// and for customs filters we start ID from 1000
const LIST_ID_MAX_VALUE_MV3 = 10000;

/**
 * Converter class
 * Provides a functionality of conversion AG rules to declarative rules.
 */
export class DeclarativeConverter {
    /**
     * Converts a set of rules to declarative rules array
     *
     * @param ruleList
     * @param IConvertOptions - different options for convert
     */
    // eslint-disable-next-line class-methods-use-this
    public convert(
        ruleList: IRuleList,
        options?: IConvertOptions,
    ): ConvertedResult {
        const resourcesPath = options?.resourcesPath;
        const maxLimit = options?.maxLimit || defaultOptions.maxLimit!;
        const maxRegexLimit = options?.maxRegexLimit || defaultOptions.maxRegexLimit!;
        // TODO: Discuss with a.meshkov
        const offsetId = options?.offsetId;
        const saveFilterId = options?.saveFilterId;

        if (resourcesPath) {
            DeclarativeRuleConverter.WebAccessibleResourcesPath = resourcesPath;
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

        const declarativeRules: DeclarativeRule[] = [];
        const convertedSourceMap: Map<ConvertedRuleId, HashOriginalRule> = new Map();
        const rulesetId = ruleList.getId();

        let regexpRulesCounter = 0;

        indexedRules.forEach((iRule) => {
            const rule = iRule.rule as NetworkRule;

            for (const badfilter of badfilterRules) {
                if (badfilter.negatesBadfilter(rule)) {
                    return;
                }
            }

            let dRule;
            try {
                const id = offsetId ? offsetId + iRule.index : iRule.index;
                dRule = DeclarativeRuleConverter.convert(
                    rule,
                    DeclarativeConverter.createDeclarativeRuleId(id),
                );
            } catch (e: any) {
                logger.info(e.message);
            }

            if (dRule) {
                declarativeRules.push(dRule);
                // For static filters, we do not need to save the filter identifier
                // This is only necessary for dynamic rules: custom filters and user rules
                const hashOriginalRule = saveFilterId
                    ? DeclarativeConverter.ruleListIdxToStorageIdx(rulesetId, iRule.index)
                    : iRule.index;
                convertedSourceMap.set(dRule.id, hashOriginalRule);

                if (dRule.condition.regexFilter) {
                    regexpRulesCounter += 1;
                }
            }

            if (declarativeRules.length > maxLimit) {
                // eslint-disable-next-line max-len
                throw new Error(`Status: ${ERROR_STATUS_CODES.RULE_LIMIT} Message: Maximum allowed rules count reached: ${maxLimit}`);
            }

            if (regexpRulesCounter > maxRegexLimit) {
                // eslint-disable-next-line max-len
                throw new Error(`Status: ${ERROR_STATUS_CODES.REGEXP_RULE_LIMIT} Message: Maximum allowed regex rules count reached: ${maxRegexLimit}`);
            }
        });

        return {
            declarativeRules,
            convertedSourceMap,
        };
    }

    /**
     * A lot of rules don't make any sense in declarative context.
     * So here we check if rule is suitable for declarative syntax or not.
     *
     * We skip some single option rules like ($elemhide, $jsinject, $generichide etc)
     * @param rule
     */
    private static isRuleApplicable(rule: NetworkRule): boolean {
        if (rule.isSingleOptionEnabled(NetworkRuleOption.RemoveParam)) {
            const removeParam = rule.getAdvancedModifier() as RemoveParamModifier;

            return removeParam.getmv3Validity();
        }

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

    /**
     * ruleListIdxToStorageIdx converts pair of listID and rule list index
     * to "storage index" number
     *
     * @param listId
     * @param ruleIdx
     */
    public static ruleListIdxToStorageIdx(listId: number, ruleIdx: number): number {
        return listId / LIST_ID_MAX_VALUE_MV3 + ruleIdx;
    }

    /**
     * Converts the "storage index" to two integers:
     * listID -- rule list identifier
     * ruleIdx -- index of the rule in the list
     *
     * @param storageIdx
     * @return [listId, ruleIdx]
     */
    public static storageIdxToRuleListIdx(storageIdx: number): [number, number] {
        const listId = Math.round((storageIdx % 1) * LIST_ID_MAX_VALUE_MV3);
        const ruleIdx = Math.trunc(storageIdx);

        return [listId, ruleIdx];
    }
}
