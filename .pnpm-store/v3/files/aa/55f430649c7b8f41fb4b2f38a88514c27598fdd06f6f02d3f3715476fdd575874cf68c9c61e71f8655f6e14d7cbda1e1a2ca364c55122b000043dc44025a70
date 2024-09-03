/* eslint-disable jsdoc/require-description-complete-sentence  */
/**
 * @file Describes the conversion from a filter list {@link IFilter}
 * to rule sets {@link IRuleSet} with declarative rules {@link DeclarativeRule}.
 *
 *                                                                           Conversion
 *
 *
 *
 *
 *       Two entry points        │                FilterConverter             │             RulesConverter
 *                               │                                            │
 *                               │       Perform the conversion at the        │      Perform the conversion at the
 *                               │       filter level.                        │      rules level.
 *                               │                                            │
 *  Converting static rules      │       Validate passed number of rules      │
 *  during extension assembly.   │       and path to web accessible resources.│
 * ┌─────────────────────────┐   │      ┌────────────────────────────────┐    │
 * │                         ├─┬─┼─────►│                                │    │
 * │  convertStaticRuleSet() │ │ │      │      checkConverterOptions()   │    │
 * │                         │ │ │  ┌───┤                                │    │
 * └─────────────────────────┘ │ │  │   └────────────────────────────────┘    │
 *                             │ │  │                                         │
 *  On-the-fly conversion      │ │  │    Filter only network rules and create │
 *  for dynamic rules.         │ │  │    indexed rule with hash.              │
 * ┌─────────────────────────┐ │ │  │    In this method, when converting      │
 * │                         │ │ │  │    dynamic rules, the rules canceled by │
 * │ convertDynamicRuleSets()├─┘ │  │    $badfilter rules from static filters │
 * │                         │   │  │    are filtered out - such rules are    │
 * └─────────────────────────┘   │  │    discarded during filter scanning.    │
 *                               │  │   ┌────────────────────────────────┐    │
 *                               │  └──►│                                │    │
 *                               │      │ NetworkRulesScanner.scanRules()│    │
 *                               │  ┌───┤                                │    │
 *                               │  │   └────────────────────────────────┘    │  Filter rules affected by $badfilter
 *                               │  │                                         │  within one filter, then group the rules
 *                               │  │                                         │  based on modifiers, requiring specific
 *                               │  │    Convert our network rule to DNR.     │  conversion processes such as
 *                               │  │   ┌────────────────────────────────┐    │  post-processing for similar rules.
 *                               │  └──►│                                │    │   ┌────────────────────────────────┐
 *                               │      │           convert()            ├────┼───┤                                │
 *                               │      │                                │    │   │        applyBadFilter()        │
 *                               │      └────────────────────────────────┘    │ ┌─┤                                │
 *                               │                                            │ │ └────────────────────────────────┘
 *                               │                                            │ │
 *                               │                                            │ │ Each group of rules within a single
 *                               │                                            │ │ filter has its converter that performs
 *                               │                                            │ │ the conversion, then combines the
 *                               │                                            │ │ results and returns them.
 *                               │                                            │ │
 *                               │                                            │ │ For details, please go to the
 *                               │                                            │ │ abstract-rule-converter.ts schema.
 *                               │                                            │ │ ┌────────────────────────────────┐
 *                               │                                            │ └►│                                │
 *                               │                                            │   │          convertRules()        │
 *                               │                                            │ ┌─┤                                │
 *                               │                                            │ │ └────────────────────────────────┘
 *                               │                                            │ │
 *                               │                                            │ │ The declarative rules are checked to
 *                               │                                            │ │ ensure they meet the specified
 *                               │                                            │ │ constraints, and if necessary,
 *                               │                                            │ │ some rules are removed.
 *                               │                                            │ │ ┌────────────────────────────────┐
 *                               │                                            │ └►│                                │
 *                               │                                            │   │         checkLimitations()     │
 *                               │   ┌────────────────────────────────────────┼───┤                                │
 *                               │   │                                        │   └────────────────────────────────┘
 *                               │   │   Wrap conversion result into RuleSet. │
 *                               │   │  ┌────────────────────────────────┐    │
 *                               │   └─►│                                │    │
 *                               │      │    collectConvertedResult()    │    │
 *                               │  ┌───┤                                │    │
 *                               │  │   └────────────────────────────────┘    │
 *                               │  │                                         │
 *                               │  │    This method is only called during the│
 *                               │  │    conversion of dynamic rules.         │
 *                               │  │    Applies rules with $badfilter        │
 *                               │  │    modifier from dynamic rulesets to    │
 *                               │  │    all rules from static rulesets and   │
 *                               │  │    returns list of ids of declarative   │
 *                               │  │    rules to disable them.               │
 *                               │  │   ┌──────────────────────────────────┐  │
 *                               │  └──►│                                  │  │
 *                               │      │ collectDeclarativeRulesToCancel()│  │
 *                               │      │                                  │  │
 *                               │      └──────────────────────────────────┘  │
 *                               │                                            │
 */
/* eslint-enable jsdoc/require-description-complete-sentence */

import { getErrorMessage } from '../../common/error';
import type { NetworkRule } from '../network-rule';

import {
    IRuleSet,
    RuleSetContentProvider,
    RuleSet,
    UpdateStaticRulesOptions,
    type SourceRuleAndFilterId,
} from './rule-set';
import { SourceMap, type SourceRuleIdxAndFilterId } from './source-map';
import type { IFilter } from './filter';
import { DeclarativeRulesConverter } from './rules-converter';
import {
    ResourcesPathError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRegexpRulesError,
} from './errors/converter-options-errors';
import type { ConversionResult } from './conversion-result';
import type { DeclarativeConverterOptions } from './declarative-converter-options';
import { RulesHashMap } from './rules-hash-map';
import { IndexedNetworkRuleWithHash } from './network-indexed-rule-with-hash';
import { type ConvertedRules } from './converted-result';
import { NetworkRulesScanner, ScannedFilter } from './network-rules-scanner';

/**
 * The interface for the declarative filter converter describes what the filter
 * converter expects on the input and what should be returned on the output.
 */
interface IFilterConverter {
    /**
     * Extracts content from the provided static filter and converts to a set
     * of declarative rules with error-catching non-convertible rules and
     * checks that converted ruleset matches the constraints (reduce if not).
     *
     * @param filterList List of {@link IFilter} to convert.
     * @param options Options from {@link DeclarativeConverterOptions}.
     *
     * @throws Error {@link UnavailableFilterSourceError} if filter content
     * is not available OR some of {@link ResourcesPathError},
     * {@link EmptyOrNegativeNumberOfRulesError},
     * {@link NegativeNumberOfRegexpRulesError}.
     * @see {@link DeclarativeFilterConverter#checkConverterOptions}
     * for details.
     *
     * @returns Item of {@link ConversionResult}.
     */
    convertStaticRuleSet(
        filterList: IFilter,
        options?: DeclarativeConverterOptions,
    ): Promise<ConversionResult>;

    /**
     * Extracts content from the provided list of dynamic filters and converts
     * all together into one set of rules with declarative rules.
     * During the conversion, it catches unconvertible rules and checks if
     * the converted ruleset matches the constraints (reduce if not).
     *
     * @param filterList List of {@link IFilter} to convert.
     * @param staticRuleSets List of already converted static rulesets. It is
     * needed to apply $badfilter rules from dynamic rules to these rules from
     * converted filters.
     * @param options Options from {@link DeclarativeConverterOptions}.
     *
     * @throws Error {@link UnavailableFilterSourceError} if filter content
     * is not available OR some of {@link ResourcesPathError},
     * {@link EmptyOrNegativeNumberOfRulesError},
     * {@link NegativeNumberOfRegexpRulesError}.
     * @see {@link DeclarativeFilterConverter#checkConverterOptions}
     * for details.
     *
     * @returns Item of {@link ConversionResult}.
     */
    convertDynamicRuleSets(
        filterList: IFilter[],
        staticRuleSets: IRuleSet[],
        options?: DeclarativeConverterOptions,
    ): Promise<ConversionResult>;
}

/**
 * Converts a list of IFilters to a single rule set or to a list of rule sets.
 */
export class DeclarativeFilterConverter implements IFilterConverter {
    /**
     * Same as chrome.declarativeNetRequest.DYNAMIC_RULESET_ID.
     */
    public static readonly COMBINED_RULESET_ID = '_dynamic';

    /**
     * Checks that provided converter options are correct.
     *
     * @param options Contains path to web accessible resources,
     * maximum number of converter rules and regexp rules. @see
     * {@link DeclarativeConverterOptions} for details.
     *
     * @throws An {@link ResourcesPathError} if the resources path does not
     * start with a slash or it ends with a slash
     * OR an {@link EmptyOrNegativeNumberOfRulesError} if maximum number of
     * rules is equal or less than 0.
     * OR an {@link NegativeNumberOfRegexpRulesError} if maximum number of
     * regexp rules is less than 0.
     */
    private static checkConverterOptions(options: DeclarativeConverterOptions): void {
        const {
            resourcesPath,
            maxNumberOfRules,
            maxNumberOfRegexpRules,
        } = options;

        if (resourcesPath !== undefined) {
            const firstChar = 0;
            const lastChar = resourcesPath.length > 0
                ? resourcesPath.length - 1
                : 0;

            if (resourcesPath[firstChar] !== '/') {
                const msg = 'Path to web accessible resources should '
                    + `be started with leading slash: ${resourcesPath}`;
                throw new ResourcesPathError(msg);
            }

            if (resourcesPath[lastChar] === '/') {
                const msg = 'Path to web accessible resources should '
                    + `not be ended with slash: ${resourcesPath}`;
                throw new ResourcesPathError(msg);
            }
        }

        if (maxNumberOfRules !== undefined && maxNumberOfRules <= 0) {
            const msg = 'Maximum number of rules cannot be equal or less than 0';
            throw new EmptyOrNegativeNumberOfRulesError(msg);
        }

        if (maxNumberOfRegexpRules && maxNumberOfRegexpRules < 0) {
            const msg = 'Maximum number of regexp rules cannot be less than 0';
            throw new NegativeNumberOfRegexpRulesError(msg);
        }
    }

    /** @inheritdoc */
    // eslint-disable-next-line class-methods-use-this
    public async convertStaticRuleSet(
        filter: IFilter,
        options?: DeclarativeConverterOptions,
    ): Promise<ConversionResult> {
        if (options) {
            DeclarativeFilterConverter.checkConverterOptions(options);
        }

        const { errors, filters } = await NetworkRulesScanner.scanRules([filter]);

        const [scannedStaticFilter] = filters;
        const { id, badFilterRules } = scannedStaticFilter;

        const convertedRules = DeclarativeRulesConverter.convert(
            filters,
            options,
        );

        const conversionResult = DeclarativeFilterConverter.collectConvertedResult(
            `ruleset_${id}`,
            [filter],
            filters,
            convertedRules,
            badFilterRules,
        );

        return {
            ruleSet: conversionResult.ruleSet,
            errors: errors.concat(conversionResult.errors),
            limitations: conversionResult.limitations,
        };
    }

    /** @inheritdoc */
    // eslint-disable-next-line class-methods-use-this
    public async convertDynamicRuleSets(
        filterList: IFilter[],
        staticRuleSets: IRuleSet[],
        options?: DeclarativeConverterOptions,
    ): Promise<ConversionResult> {
        if (options) {
            DeclarativeFilterConverter.checkConverterOptions(options);
        }

        const allStaticBadFilterRules = DeclarativeFilterConverter.createBadFilterRulesHashMap(staticRuleSets);

        const skipNegatedRulesFn = (r: IndexedNetworkRuleWithHash): boolean => {
            const fastMatchedBadFilterRules = allStaticBadFilterRules.get(r.hash);

            if (!fastMatchedBadFilterRules) {
                return true;
            }

            for (let i = 0; i < fastMatchedBadFilterRules.length; i += 1) {
                const rule = fastMatchedBadFilterRules[i];

                const badFilterRule = rule.rule;
                const ruleToCheck = r.rule;

                if (badFilterRule.negatesBadfilter(ruleToCheck)) {
                    return false;
                }
            }

            return true;
        };

        // Note: if we drop some rules because of applying $badfilter - we
        // cannot show info about it to user.
        const scanned = await NetworkRulesScanner.scanRules(filterList, skipNegatedRulesFn);

        const convertedRules = DeclarativeRulesConverter.convert(
            scanned.filters,
            options,
        );

        const dynamicBadFilterRules = scanned.filters
            .map(({ badFilterRules }) => badFilterRules)
            .flat();

        const conversionResult = DeclarativeFilterConverter.collectConvertedResult(
            DeclarativeFilterConverter.COMBINED_RULESET_ID,
            filterList,
            scanned.filters,
            convertedRules,
            dynamicBadFilterRules,
        );

        const { declarativeRulesToCancel, errors } = await DeclarativeFilterConverter.collectDeclarativeRulesToCancel(
            staticRuleSets,
            dynamicBadFilterRules,
        );

        conversionResult.errors = conversionResult.errors
            .concat(scanned.errors)
            .concat(errors);
        conversionResult.declarativeRulesToCancel = declarativeRulesToCancel;

        return conversionResult;
    }

    /**
     * Collects {@link ConversionResult} from provided list of raw filters,
     * scanned filters, converted rules and bad filter rules.
     * Creates new {@link RuleSet} and wrap all data for {@link RuleSetContentProvider}.
     *
     * @param ruleSetId Rule set id.
     * @param filterList List of raw filters.
     * @param scannedFilters Already scanned filters.
     * @param convertedRules Converted rules.
     * @param badFilterRules List of rules with $badfilter modifier.
     *
     * @returns Item of {@link ConversionResult}.
     */
    private static collectConvertedResult(
        ruleSetId: string,
        filterList: IFilter[],
        scannedFilters: ScannedFilter[],
        convertedRules: ConvertedRules,
        badFilterRules: IndexedNetworkRuleWithHash[],
    ): ConversionResult {
        const {
            sourceMapValues,
            declarativeRules,
            errors,
            limitations = [],
        } = convertedRules;

        const ruleSetContent: RuleSetContentProvider = {
            loadSourceMap: async () => new SourceMap(sourceMapValues),
            loadFilterList: async () => filterList,
            loadDeclarativeRules: async () => declarativeRules,
        };

        const listOfRulesWithHash = scannedFilters
            .map(({ id, rules }) => {
                return rules.map((r) => ({
                    hash: r.hash,
                    source: {
                        sourceRuleIndex: r.index,
                        filterId: id,
                    },
                }));
            })
            .flat();

        const rulesHashMap = new RulesHashMap(listOfRulesWithHash);

        const ruleSet = new RuleSet(
            ruleSetId,
            declarativeRules.length,
            declarativeRules.filter((d) => d.condition.regexFilter).length,
            ruleSetContent,
            badFilterRules,
            rulesHashMap,
        );

        return {
            ruleSet,
            errors,
            limitations,
        };
    }

    /**
     * Creates dictionary where key is hash of indexed rule and value is array
     * of rules with this hash.
     *
     * @param ruleSets A list of IRuleSets for each of which a list of
     * $badfilter rules.
     *
     * @returns Dictionary with all $badfilter rules which are extracted from
     * rulesets.
     */
    private static createBadFilterRulesHashMap(
        ruleSets: IRuleSet[],
    ): Map<number, IndexedNetworkRuleWithHash[]> {
        const allStaticBadFilterRules: Map<number, IndexedNetworkRuleWithHash[]> = new Map();

        ruleSets.forEach((ruleSet) => {
            ruleSet.getBadFilterRules().forEach((r) => {
                const existingValue = allStaticBadFilterRules.get(r.hash);
                if (existingValue) {
                    existingValue.push(r);
                } else {
                    allStaticBadFilterRules.set(r.hash, [r]);
                }
            });
        });

        return allStaticBadFilterRules;
    }

    /**
     * Checks if some rules (fastMatchedRulesByHash) from the staticRuleSet,
     * which have been fast matched by hash, can be negated with the provided
     * badFilterRule via the `$badfilter` option.
     *
     * @param badFilterRule Network rule with hash {@link IndexedNetworkRuleWithHash}
     * and `$badfilter` option.
     * @param staticRuleSet Static rule set which contains fast matched rules.
     * @param fastMatchedRulesByHash Rules that have been fast matched by hash
     * for potential negation.
     *
     * @returns List of declarative rule IDs that have been canceled by
     * the provided badFilterRule.
     */
    private static async checkFastMatchedRulesCanBeCancelled(
        badFilterRule: IndexedNetworkRuleWithHash,
        staticRuleSet: IRuleSet,
        fastMatchedRulesByHash: SourceRuleIdxAndFilterId[],
    ): Promise<number[]> {
        const fastMatchedDeclarativeRulesIds: number [] = [];

        try {
            const promises = fastMatchedRulesByHash.map(async (source) => {
                return staticRuleSet.getDeclarativeRulesIdsBySourceRuleIndex(source);
            });
            const ids = await Promise.all(promises);

            fastMatchedDeclarativeRulesIds.push(...ids.flat());
        } catch (e) {
            // eslint-disable-next-line max-len
            throw new Error(`Not found declarative rule id for some source from list: ${JSON.stringify(fastMatchedDeclarativeRulesIds)}: ${getErrorMessage(e)}`);
        }

        const disableRuleIds: number[] = [];

        for (let k = 0; k < fastMatchedDeclarativeRulesIds.length; k += 1) {
            const id = fastMatchedDeclarativeRulesIds[k];

            let matchedSourceRules: SourceRuleAndFilterId[] = [];
            try {
                // eslint-disable-next-line no-await-in-loop
                matchedSourceRules = await staticRuleSet.getRulesById(id);
            } catch (e) {
                throw new Error(`Not found sources for declarative rule with id "${id}": ${getErrorMessage(e)}`);
            }

            let indexedNetworkRulesWithHash: NetworkRule[] = [];
            try {
                // eslint-disable-next-line no-await-in-loop
                const arrayWithRules = await Promise.all(
                    matchedSourceRules.map((source) => {
                        return RuleSet.getNetworkRuleBySourceRule(source);
                    }),
                );

                indexedNetworkRulesWithHash = arrayWithRules.flat();
            } catch (e) {
                // eslint-disable-next-line max-len
                throw new Error(`Not found network rules from matched sources "${JSON.stringify(matchedSourceRules)}": ${getErrorMessage(e)}`);
            }

            // NOTE: Here we use .some but not .every to simplify first
            // version of applying $badfilter rules.
            const someRulesMatched = indexedNetworkRulesWithHash
                .flat()
                .some((rule) => badFilterRule.rule.negatesBadfilter(rule));

            if (someRulesMatched) {
                disableRuleIds.push(id);
            }
        }

        return disableRuleIds;
    }

    /**
     * Applies rules with $badfilter modifier from dynamic rulesets to all rules
     * from static rulesets and returns list of ids of declarative rules to
     * disable them.
     *
     * @param staticRuleSets List of converted static rulesets.
     * @param dynamicBadFilterRules List of rules with $badfilter.
     *
     * @returns List of ids of declarative rules to disable them.
     */
    private static async collectDeclarativeRulesToCancel(
        staticRuleSets: IRuleSet[],
        dynamicBadFilterRules: IndexedNetworkRuleWithHash[],
    ): Promise<Pick<ConversionResult, 'errors' | 'declarativeRulesToCancel'>> {
        const declarativeRulesToCancel: UpdateStaticRulesOptions[] = [];

        const errors: Error[] = [];

        // Check every static ruleset.
        for (let i = 0; i < staticRuleSets.length; i += 1) {
            const staticRuleSet = staticRuleSets[i];

            const disableRuleIds: number[] = [];

            // Check every rule with $badfilter from dynamic filters
            // (custom filter and user rules).
            for (let j = 0; j < dynamicBadFilterRules.length; j += 1) {
                const badFilterRule = dynamicBadFilterRules[j];
                const hashMap = staticRuleSet.getRulesHashMap();
                const fastMatchedRulesByHash = hashMap.findRules(badFilterRule.hash);

                if (fastMatchedRulesByHash.length === 0) {
                    continue;
                }

                try {
                    // eslint-disable-next-line no-await-in-loop
                    const ids = await DeclarativeFilterConverter.checkFastMatchedRulesCanBeCancelled(
                        badFilterRule,
                        staticRuleSet,
                        fastMatchedRulesByHash,
                    );

                    disableRuleIds.push(...ids);
                } catch (e) {
                    // eslint-disable-next-line max-len
                    errors.push(new Error(`Cannot apply badfilter rule ${badFilterRule.rule.getText()}: ${getErrorMessage(e)}`));
                }
            }

            if (disableRuleIds.length > 0) {
                declarativeRulesToCancel.push({
                    rulesetId: staticRuleSet.getId(),
                    disableRuleIds,
                });
            }
        }

        return {
            errors,
            declarativeRulesToCancel,
        };
    }
}
