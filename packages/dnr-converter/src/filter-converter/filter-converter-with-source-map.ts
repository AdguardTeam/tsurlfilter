/**
 * @typedef {import('../declarative-rule').DeclarativeRule} DeclarativeRule
 */

/* eslint-disable jsdoc/require-description-complete-sentence  */
/**
 * @file Describes the conversion from a filter list {@link IFilterWithSource}
 * to rule sets {@link IRulesetWithSourceMap} with declarative rules {@link DeclarativeRule}.
 *
 * Note: FCWSM = FilterConverterWithSourceMap.
 *
 *                                                  Conversion
 *
 *       Two entry points        │                FilterConverter             │             RulesConverter
 *                               │                                            │
 *                               │       Perform the conversion at the        │      Perform the conversion at the
 *                               │       filter level.                        │      rules level.
 *                               │                                            │
 *  Simple conversion of filter  │       Validate options: resourcesPath,     │
 *  lists to declarative rules.  │       max rule counts, etc.                │
 * ┌─────────────────────────┐   │      ┌────────────────────────────────┐    │
 * │  FilterConverter        ├─┬─┼─────►│                                │    │
 * │     .convert()          │ │ │      │      checkConverterOptions()   │    │
 * └─────────────────────────┘ │ │  ┌───┤                                │    │
 *                             │ │  │   └────────────────────────────────┘    │
 *                             │ │  │                                         │
 *  Advanced conversion with   │ │  │    Parse filter text into NetworkRules. │
 *  source maps. FCWSM builds  │ │  │    FCWSM builds a skipNegatedRulesFn    │
 * ┌─────────────────────────┐ │ │  │    from options.badFilterRules to skip  │
 * │ FilterConverterWith-    │ │ │  │    rules negated by $badfilter during   │
 * │  SourceMap.convert()    ├─┘ │  │    scanning. For simple FilterConverter │
 * │                         │   │  │    no pre-filtering is applied.         │
 * └─────────────────────────┘   │  │   ┌────────────────────────────────┐    │
 *                               │  └──►│                                │    │
 *                               │      │   RulesScanner.scanFilters()   │    │
 *                               │  ┌───┤                                │    │
 *                               │  │   └────────────────────────────────┘    │  Filter rules affected by $badfilter
 *                               │  │                                         │  within one filter, then group the rules
 *                               │  │                                         │  based on modifiers, requiring specific
 *                               │  │    Convert scanned network rules to DNR.│  conversion processes such as
 *                               │  │   ┌────────────────────────────────┐    │  post-processing for similar rules.
 *                               │  └──►│                                │    │   ┌────────────────────────────────┐
 *                               │      │   RulesConverter.convert()     ├────┼───┤                                │
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
 *                               │                                            │ │ regular-rule-converter.ts schema.
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
 *                               │   │   Wrap conversion output into a        │
 *                               │   │   RulesetWithSourceMap (FCWSM only).   │
 *                               │   │   FilterConverter creates a Ruleset    │
 *                               │   │   directly, without this step.         │
 *                               │   │  ┌────────────────────────────────┐    │
 *                               │   └─►│                                │    │
 *                               │      │    collectConvertedResult()    │    │
 *                               │      │        (FCWSM only)            │    │
 *                               │      └────────────────────────────────┘    │
 *                               │                                            │
 *─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ─ ─ ─ ─│
 *                               │                                            │
 *  Separate entry point, called │  Matches $badfilter rules from dynamic     │
 *  after convert() via          │  rulesets against all static rulesets and  │
 *  FCWSM.computeRulesToDisable().  returns the declarative rule IDs to       │
 *  Not part of the main         │  disable per static ruleset.               │
 *  conversion flow.             │ ┌────────────────────────────────────────┐ │
 * ┌─────────────────────────┐   │ │                                        │ │
 * │ FilterConverterWith-    ├───┼►│  collectDeclarativeRulesToCancel()     │ │
 * │  SourceMap              │   │ │        (FCWSM only)                    │ │
 * │  .computeRulesToDisable │   │ └────────────────────────────────────────┘ │
 * └─────────────────────────┘   │                                            │
 */
/* eslint-enable jsdoc/require-description-complete-sentence */

import { type IFilterWithSource } from '../filter/types';
import { type NetworkRule } from '../network-rule';
import { type ConvertedRules } from '../rule-converters';
import { RulesConverter } from '../rule-converters/rules-converter';
import { RulesScanner, type ScannedFilter } from '../rules-scanner';
import { RulesHashMap } from '../ruleset/rules-hash-map';
import {
    type IRulesetWithSourceMap,
    type RulesetContentProvider,
    RulesetWithSourceMap,
} from '../ruleset/ruleset-with-source-map';
import { SourceMap, type SourceRuleIdxAndFilterId } from '../ruleset/source-map';
import { type SourceRuleAndFilterId, type UpdateStaticRulesOptions } from '../ruleset/types';
import { getErrorMessage } from '../utils/error';
import { isSafeRule } from '../utils/is-safe-rule';

import { AbstractFilterConverter } from './abstract-filter-converter';
import { type ConversionResult } from './conversion-result';
import { type FilterConverterOptions } from './filter-converter-options';

/**
 * Converts a list of IFiltersWithSource to declarative rule sets with source
 * maps, hash maps, and lazy loading. Implements the advanced conversion flow.
 */
export class FilterConverterWithSourceMap extends AbstractFilterConverter<IFilterWithSource, IRulesetWithSourceMap> {
    /**
     * Converts the provided list of filters into declarative rule sets with
     * source maps.
     *
     * By default returns one {@link ConversionResult} per filter. When
     * `options.combine` is `true`, all filters are merged into a single result.
     * When `options.badFilterRules` is provided, rules negated by those
     * `$badfilter` entries are skipped during scanning (pre-conversion).
     *
     * @param filters List of {@link IFilterWithSource} to convert.
     * @param options Options from {@link FilterConverterOptions}.
     *
     * @returns Array of {@link ConversionResult} items with source maps.
     *
     * @throws Some of {@link ResourcesPathError},
     * {@link EmptyOrNegativeNumberOfRulesError},
     * {@link NegativeNumberOfRulesError}.
     */
    // eslint-disable-next-line class-methods-use-this
    public override async convert(
        filters: IFilterWithSource[],
        options?: FilterConverterOptions,
    ): Promise<ConversionResult<IRulesetWithSourceMap>[]> {
        if (options) {
            FilterConverterWithSourceMap.checkConverterOptions(options);
        }

        let skipNegatedRulesFn: ((r: NetworkRule) => boolean) | undefined;

        if (options?.badFilterRules && options.badFilterRules.length > 0) {
            const badFilterHashMap = FilterConverterWithSourceMap.buildNetworkRulesBadFilterHashMap(
                options.badFilterRules,
            );

            skipNegatedRulesFn = (r: NetworkRule): boolean => {
                const fastMatched = badFilterHashMap.get(r.getHash());

                if (!fastMatched) {
                    return true;
                }

                for (let i = 0; i < fastMatched.length; i += 1) {
                    if (fastMatched[i].negatesBadfilter(r)) {
                        return false;
                    }
                }

                return true;
            };
        }

        const scannedLimit = options?.maxNumberOfRules
            ? Math.ceil(
                options.maxNumberOfRules
                * FilterConverterWithSourceMap.SCANNED_NETWORK_RULES_MULTIPLICATOR,
            )
            : undefined;

        if (options?.combine) {
            const {
                errors: scanErrors,
                filters: scannedFilters,
            } = await RulesScanner.scanFilters(
                filters,
                skipNegatedRulesFn,
                scannedLimit,
            );
            const convertedRules = await RulesConverter.convert(scannedFilters, options);
            const badFilterRules = scannedFilters.flatMap(({ badFilterRules: rules }) => rules);
            const result = FilterConverterWithSourceMap.collectConvertedResult(
                FilterConverterWithSourceMap.COMBINED_RULESET_ID,
                filters,
                scannedFilters,
                convertedRules,
                badFilterRules,
            );
            result.errors = scanErrors.concat(result.errors);
            return [result];
        }

        // In the per-filter path, scan each filter individually so that scan
        // errors are attributed to the correct result instead of all being
        // dumped onto results[0].
        const results = await Promise.all(filters.map(async (filter) => {
            const {
                errors: scanErrors,
                filters: [scannedFilter],
            } = await RulesScanner.scanFilters(
                [filter],
                skipNegatedRulesFn,
                scannedLimit,
            );
            const convertedRules = await RulesConverter.convert([scannedFilter], options);
            const result = FilterConverterWithSourceMap.collectConvertedResult(
                FilterConverterWithSourceMap.getRuleSetId(scannedFilter.id),
                [filter],
                [scannedFilter],
                convertedRules,
                scannedFilter.badFilterRules,
            );
            result.errors = scanErrors.concat(result.errors);
            return result;
        }));

        return results;
    }

    /**
     * Applies `$badfilter` rules from dynamic rulesets to static rulesets and
     * returns the list of declarative rule IDs that should be disabled.
     *
     * This handles the **dynamic → static** direction of cross-ruleset
     * `$badfilter` application. The reverse direction (static → dynamic) is
     * handled via `options.badFilterRules` during `convert()`.
     *
     * @param dynamicRulesets Converted dynamic rulesets containing potential
     * `$badfilter` rules.
     * @param staticRulesets Already-built static rulesets to match against.
     *
     * @returns Array of {@link UpdateStaticRulesOptions} describing which
     * static ruleset IDs should have which declarative rule IDs disabled.
     */
    // eslint-disable-next-line class-methods-use-this
    public async computeRulesToDisable(
        dynamicRulesets: IRulesetWithSourceMap[],
        staticRulesets: IRulesetWithSourceMap[],
    ): Promise<UpdateStaticRulesOptions[]> {
        // Rules from different rulesets are always distinct object references, so a Set would
        // not deduplicate anything useful here. The downstream hash map handles collisions.
        const dynamicBadFilterRules = dynamicRulesets
            .flatMap((rs) => rs.getBadFilterRules());

        const { declarativeRulesToCancel = [] } = await FilterConverterWithSourceMap
            .collectDeclarativeRulesToCancel(staticRulesets, dynamicBadFilterRules);

        return declarativeRulesToCancel;
    }

    /**
     * Collects {@link ConversionResult} from provided list of raw filters,
     * scanned filters, converted rules and bad filter rules.
     * Creates new {@link RulesetWithSourceMap} and wrap all data for {@link RulesetContentProvider}.
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
        filterList: IFilterWithSource[],
        scannedFilters: ScannedFilter[],
        convertedRules: ConvertedRules,
        badFilterRules: NetworkRule[],
    ): ConversionResult<IRulesetWithSourceMap> {
        const {
            sourceMapValues,
            declarativeRules,
            errors,
            limitations = [],
        } = convertedRules;

        const ruleSetContent: RulesetContentProvider = {
            loadSourceMap: async () => new SourceMap(sourceMapValues),
            loadFilterList: async () => filterList,
            loadDeclarativeRules: async () => declarativeRules,
        };

        const listOfRulesWithHash = scannedFilters
            .flatMap(({ id, rules }) => {
                return rules.map((r) => ({
                    hash: r.getHash(),
                    source: {
                        sourceRuleIndex: r.getIndex(),
                        filterId: id,
                    },
                }));
            });

        const rulesHashMap = new RulesHashMap(listOfRulesWithHash);

        const unsafeRulesCount = declarativeRules.filter((r) => !isSafeRule(r)).length;

        const regexRulesCount = declarativeRules.filter((r) => RulesConverter.isRegexRule(r)).length;

        const ruleSet = new RulesetWithSourceMap(
            ruleSetId,
            declarativeRules.length,
            unsafeRulesCount,
            regexRulesCount,
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
     * Creates dictionary where key is hash of network rule and value is array
     * of rules with this hash.
     *
     * @param badFilterRules A flat list of `$badfilter` network rules.
     *
     * @returns Dictionary with all $badfilter rules indexed by hash.
     */
    private static buildNetworkRulesBadFilterHashMap(
        badFilterRules: NetworkRule[],
    ): Map<number, NetworkRule[]> {
        const result: Map<number, NetworkRule[]> = new Map();

        badFilterRules.forEach((r) => {
            const hash = r.getHash();
            const existing = result.get(hash);
            if (existing) {
                existing.push(r);
            } else {
                result.set(hash, [r]);
            }
        });

        return result;
    }

    /**
     * Checks if some rules (fastMatchedRulesByHash) from the staticRuleSet,
     * which have been fast matched by hash, can be negated with the provided
     * badFilterRule via the `$badfilter` option.
     *
     * @param badFilterRule Network rule with `$badfilter` option.
     * @param staticRuleSet Static rule set which contains fast matched rules.
     * @param fastMatchedRulesByHash Rules that have been fast matched by hash
     * for potential negation.
     *
     * @returns List of declarative rule IDs that have been canceled by
     * the provided badFilterRule.
     */
    private static async checkFastMatchedRulesCanBeCancelled(
        badFilterRule: NetworkRule,
        staticRuleSet: IRulesetWithSourceMap,
        fastMatchedRulesByHash: SourceRuleIdxAndFilterId[],
    ): Promise<number[]> {
        const fastMatchedDeclarativeRulesIds: number[] = [];

        try {
            const promises = fastMatchedRulesByHash.map(async (source) => {
                return staticRuleSet.getDeclarativeRulesIdsBySourceRuleIndex(source);
            });
            const ids = await Promise.all(promises);

            fastMatchedDeclarativeRulesIds.push(...ids.flat());
        } catch (e) {
            // eslint-disable-next-line max-len
            throw new Error(`Not found declarative rule ids for sources: ${JSON.stringify(fastMatchedRulesByHash)}: ${getErrorMessage(e)}`);
        }

        const disableRuleIds: number[] = [];

        for (let i = 0; i < fastMatchedDeclarativeRulesIds.length; i += 1) {
            const id = fastMatchedDeclarativeRulesIds[i];

            let matchedSourceRules: SourceRuleAndFilterId[] = [];
            try {
                // eslint-disable-next-line no-await-in-loop
                matchedSourceRules = await staticRuleSet.getRulesById(id);
            } catch (e) {
                throw new Error(`Not found sources for declarative rule with id "${id}": ${getErrorMessage(e)}`);
            }

            const networkRules = matchedSourceRules
                .flatMap((source) => {
                    return RulesetWithSourceMap.getNetworkRuleBySourceRule(source);
                });

            // NOTE: Here we use .some but not .every to simplify first
            // version of applying $badfilter rules.
            const someRulesMatched = networkRules
                .flat()
                .some((rule) => badFilterRule.negatesBadfilter(rule));

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
        staticRuleSets: IRulesetWithSourceMap[],
        dynamicBadFilterRules: NetworkRule[],
    ): Promise<Pick<ConversionResult<IRulesetWithSourceMap>, 'errors' | 'declarativeRulesToCancel'>> {
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
                const fastMatchedRulesByHash = hashMap.findRules(badFilterRule.getHash());

                if (fastMatchedRulesByHash.length === 0) {
                    continue;
                }

                try {
                    // eslint-disable-next-line no-await-in-loop
                    const ids = await FilterConverterWithSourceMap.checkFastMatchedRulesCanBeCancelled(
                        badFilterRule,
                        staticRuleSet,
                        fastMatchedRulesByHash,
                    );

                    disableRuleIds.push(...ids);
                } catch (e) {
                    errors.push(new Error(`Cannot apply badfilter: ${getErrorMessage(e)}`));
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
