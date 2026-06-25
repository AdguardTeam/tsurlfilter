/**
 * @typedef {import('../declarative-rule').DeclarativeRule} DeclarativeRule
 */

/* eslint-disable jsdoc/require-description-complete-sentence */
/**
 * @file Implements the unified {@link FilterConverter} class that supports both
 * the simple conversion flow (producing {@link IRuleset}) and the advanced flow
 * with source maps (producing {@link IRulesetWithSourceMap}).
 *
 * The conversion mode is selected via the {@link FilterConverterOptions.withSourceMap}
 * flag: when `true`, source maps, hash maps, and lazy loading are preserved in
 * the output rulesets; when `false` or omitted, only plain declarative rules
 * are returned.
 *
 *                                                  Conversion
 *
 *       Single entry point      │                FilterConverter             │             RulesConverter
 *                               │                                            │
 *                               │       Perform the conversion at the        │      Perform the conversion at the
 *                               │       filter level.                        │      rules level.
 *                               │                                            │
 *  withSourceMap selects the    │       Validate options: resourcesPath,     │
 *  conversion mode:             │       max rule counts, etc.                │
 *  - false/omitted → Ruleset    │      ┌────────────────────────────────┐    │
 *  - true → RulesetWithSourceMap│     ┌┤                                │    │
 * ┌─────────────────────────┐   │     ││      checkConverterOptions()   │    │
 * │  FilterConverter        ├───┼────►│┤                                │    │
 * │     .convert()          │   │     │└────────────────────────────────┘    │
 * └─────────────────────────┘   │     │                                      │
 *                               │     │ Parse filter text into Rules. │
 *                               │     │ When withSourceMap is true and       │
 *                               │     │ options.badFilterRules is provided,  │
 *                               │     │ builds a skipNegatedRulesFn to skip  │
 *                               │     │ rules negated by $badfilter during   │
 *                               │     │ scanning. For simple mode            │
 *                               │     │ no pre-filtering is applied.         │
 *                               │     │┌────────────────────────────────┐    │
 *                               │     └┤                                │    │
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
 *                               │   │   RulesetWithSourceMap when            │
 *                               │   │   withSourceMap is true.               │
 *                               │   │   Otherwise creates a simple Ruleset   │
 *                               │   │   directly, without this step.         │
 *                               │   │  ┌────────────────────────────────┐    │
 *                               │   └─►│                                │    │
 *                               │      │    collectConvertedResult()    │    │
 *                               │      │   (withSourceMap: true only)   │    │
 *                               │      └────────────────────────────────┘    │
 *                               │                                            │
 *─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ─ ─ ─ ─│
 *                               │                                            │
 *  Separate entry point, called │  Matches $badfilter rules from dynamic     │
 *  after convert() via          │  rulesets against all static rulesets and  │
 *  FilterConverter              │  returns the declarative rule IDs to       │
 *  .computeRulesToDisable().    │  disable per static ruleset.               │
 *  Not part of the main         │ ┌────────────────────────────────────────┐ │
 *  conversion flow.             │ │                                        │ │
 * ┌─────────────────────────┐   │ │                                        │ │
 * │ FilterConverter         ├───┼►│  collectDeclarativeRulesToCancel()     │ │
 * │ .computeRulesToDisable  │   │ │  (withSourceMap: true rulesets only)   │ │
 * └─────────────────────────┘   │ │                                        │ │
 *                               │ └────────────────────────────────────────┘ │
 */
/* eslint-enable jsdoc/require-description-complete-sentence */

import {
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRulesError,
    ResourcesPathError,
} from '../errors/converter-options-errors';
import { type IFilter } from '../filter/types';
import { type Rule } from '../rule/rule';
import { type ConvertedRules } from '../rule-converters';
import { RulesConverter } from '../rule-converters/rules-converter';
import { RulesScanner, type ScannedFilter } from '../rules-scanner';
import { RulesHashMap } from '../ruleset/rules-hash-map';
import { type IRuleset, Ruleset } from '../ruleset/ruleset';
import {
    type IRulesetWithSourceMap,
    type RulesetContentProvider,
    RulesetWithSourceMap,
} from '../ruleset/ruleset-with-source-map';
import { SourceMap, type SourceRuleIdxAndFilterId } from '../ruleset/source-map';
import { type SourceRuleAndFilterId, type UpdateStaticRulesOptions } from '../ruleset/types';
import { getErrorMessage } from '../utils/error';
import { isSafeRule } from '../utils/is-safe-rule';
import { getRuleSetId } from '../utils/ruleset-utils';

import { type ConversionResult } from './conversion-result';
import {
    type BaseFilterConverterOptions,
    type FilterConverterOptions,
    type SimpleConverterOptions,
    type SourceMapConverterOptions,
} from './filter-converter-options';

/**
 * Unified filter-to-rules converter. Converts adblock filter lists into
 * declarative rule sets.
 *
 * Supports two conversion modes controlled by the
 * {@link FilterConverterOptions.withSourceMap} flag:
 *
 * - **Simple mode** (`withSourceMap` omitted or `false`): produces
 *   {@link IRuleset} with synchronous access to declarative rules.
 *
 * - **Source-map mode** (`withSourceMap: true`): produces
 *   {@link IRulesetWithSourceMap} with source maps, hash maps, lazy loading,
 *   and full `$badfilter` cross-filter support.
 */
export class FilterConverter {
    /**
     * Same as chrome.declarativeNetRequest.DYNAMIC_RULESET_ID.
     * Used as the combined ruleset ID when `combine: true`.
     */
    public static readonly COMBINED_RULESET_ID = '_dynamic';

    /**
     * Returns the rule set ID for a given filter ID.
     *
     * @param filterId Filter ID.
     *
     * @returns Rule set ID string.
     */
    public static getRuleSetId(filterId: number): string {
        return getRuleSetId(filterId);
    }

    /**
     * Number of scanned rules can be limited via converter options. In this
     * case we increase the limit by 10% to scan more rules in case of some
     * network rules will be combined into one declarative rule. It is safe,
     * because we have double check for maxNumberOfRules on the converted DNR
     * rules.
     */
    private static readonly SCANNED_RULES_MULTIPLICATOR = 1.1;

    /**
     * Converts the provided list of filters into declarative rule sets with
     * source maps, hash maps, and lazy loading.
     *
     * @param filters List of {@link IFilter} to convert.
     * @param options Options with `withSourceMap: true`.
     *
     * @returns Array of {@link ConversionResult} items with source maps.
     */
    public convert(
        filters: IFilter[],
        options: SourceMapConverterOptions,
    ): Promise<ConversionResult<IRulesetWithSourceMap>[]>;

    /**
     * Converts the provided list of filters into simple declarative rule sets.
     *
     * @param filters List of {@link IFilter} to convert.
     * @param options Converter options (optional).
     *
     * @returns Array of {@link ConversionResult} items.
     */
    public convert(
        filters: IFilter[],
        options?: SimpleConverterOptions,
    ): Promise<ConversionResult<IRuleset>[]>;

    /**
     * Fallback overload for callers that compute `withSourceMap` at runtime
     * (e.g. from a config flag typed as `boolean`). The return type is the
     * union of both ruleset types, forcing the caller to narrow on
     * `ruleSet`'s methods. Use a literal `true`/`false` to select a specific
     * overload and get a precise return type.
     *
     * @param filters List of {@link IFilter} to convert.
     * @param options Converter options with a computed `withSourceMap` flag.
     *
     * @returns Array of {@link ConversionResult} items (union of both modes).
     */
    public convert(
        filters: IFilter[],
        options: BaseFilterConverterOptions & { withSourceMap: boolean; badFilterRules?: Rule[] },
    ): Promise<ConversionResult<IRuleset | IRulesetWithSourceMap>[]>;

    /**
     * Converts the provided list of filters into declarative rule sets.
     *
     * By default returns one {@link ConversionResult} per filter. When
     * `options.combine` is `true`, all filters are merged into a single result.
     * When `options.withSourceMap` is `true`, the returned rulesets include
     * source maps, hash maps, and lazy loading.
     *
     * @param filters List of {@link IFilter} to convert.
     * @param options Options from {@link FilterConverterOptions}.
     *
     * @returns Array of {@link ConversionResult} items.
     *
     * @throws Some of {@link ResourcesPathError},
     * {@link EmptyOrNegativeNumberOfRulesError},
     * {@link NegativeNumberOfRulesError}.
     */
    // eslint-disable-next-line class-methods-use-this
    public async convert(
        filters: IFilter[],
        options?: FilterConverterOptions,
    ): Promise<ConversionResult<IRuleset | IRulesetWithSourceMap>[]> {
        if (options) {
            FilterConverter.checkConverterOptions(options);
        }

        if (options?.withSourceMap) {
            return FilterConverter.convertWithSourceMap(filters, options);
        }

        return FilterConverter.convertSimple(filters, options);
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
        const dynamicBadFilterRules = dynamicRulesets
            .flatMap((rs) => rs.getBadFilterRules());

        const { declarativeRulesToCancel = [] } = await FilterConverter
            .collectDeclarativeRulesToCancel(staticRulesets, dynamicBadFilterRules);

        return declarativeRulesToCancel;
    }

    /**
     * Runs the simple conversion flow: scans, converts, wraps in {@link Ruleset}.
     *
     * @param filters Filters to convert.
     * @param options Converter options.
     *
     * @returns Array of simple conversion results.
     */
    private static async convertSimple(
        filters: IFilter[],
        options: FilterConverterOptions | undefined,
    ): Promise<ConversionResult<IRuleset>[]> {
        const scannedLimit = options?.maxNumberOfRules
            ? Math.ceil(
                options.maxNumberOfRules
                * FilterConverter.SCANNED_RULES_MULTIPLICATOR,
            )
            : undefined;

        if (options?.combine) {
            const result = await FilterConverter.convertFiltersSimple(
                filters,
                FilterConverter.COMBINED_RULESET_ID,
                options,
                scannedLimit,
            );
            return [result];
        }

        const conversionTasks = filters.map((filter) => FilterConverter.convertFiltersSimple(
            [filter],
            FilterConverter.getRuleSetId(filter.getId()),
            options,
            scannedLimit,
        ));

        return Promise.all(conversionTasks);
    }

    /**
     * Scans and converts the given filters into a single simple
     * {@link ConversionResult} identified by `ruleSetId`.
     *
     * @param filters Filters to scan and convert.
     * @param ruleSetId ID to assign to the produced {@link Ruleset}.
     * @param options Converter options.
     * @param scannedLimit Optional limit on the number of scanned rules.
     *
     * @returns Conversion result for the given filters.
     */
    private static async convertFiltersSimple(
        filters: IFilter[],
        ruleSetId: string,
        options: FilterConverterOptions | undefined,
        scannedLimit: number | undefined,
    ): Promise<ConversionResult<IRuleset>> {
        const {
            errors: scanErrors,
            filters: scannedFilters,
        } = await RulesScanner.scanFilters(
            filters,
            undefined,
            scannedLimit,
        );

        const convertedRules = await RulesConverter.convert(scannedFilters, options);

        const {
            declarativeRules,
            errors: convertErrors,
            limitations = [],
        } = convertedRules;

        const ruleSet = new Ruleset(ruleSetId, declarativeRules);

        return {
            ruleSet,
            errors: scanErrors.concat(convertErrors),
            limitations,
        };
    }

    /**
     * Runs the advanced conversion flow: scans with optional `$badfilter`
     * pre-filtering, converts, wraps in {@link RulesetWithSourceMap}.
     *
     * @param filters Filters to convert.
     * @param options Converter options.
     *
     * @returns Array of source-map conversion results.
     */
    private static async convertWithSourceMap(
        filters: IFilter[],
        options: SourceMapConverterOptions,
    ): Promise<ConversionResult<IRulesetWithSourceMap>[]> {
        let skipNegatedRulesFn: ((r: Rule) => boolean) | undefined;

        if (options?.badFilterRules && options.badFilterRules.length > 0) {
            const badFilterHashMap = FilterConverter.buildRulesBadFilterHashMap(
                options.badFilterRules,
            );

            skipNegatedRulesFn = (r: Rule): boolean => {
                const fastMatched = badFilterHashMap.get(r.hash);

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
                * FilterConverter.SCANNED_RULES_MULTIPLICATOR,
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
            const result = FilterConverter.collectConvertedResult(
                FilterConverter.COMBINED_RULESET_ID,
                filters,
                scannedFilters,
                convertedRules,
                badFilterRules,
            );
            result.errors = scanErrors.concat(result.errors);
            return [result];
        }

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
            const result = FilterConverter.collectConvertedResult(
                FilterConverter.getRuleSetId(scannedFilter.id),
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
     * Collects {@link ConversionResult} from provided list of raw filters,
     * scanned filters, converted rules and bad filter rules.
     * Creates new {@link RulesetWithSourceMap} and wraps all data for
     * {@link RulesetContentProvider}.
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
        badFilterRules: Rule[],
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
                    hash: r.hash,
                    source: {
                        sourceRuleIndex: r.index,
                        filterId: id,
                    },
                }));
            });

        const rulesHashMap = new RulesHashMap(listOfRulesWithHash);

        const unsafeRulesCount = declarativeRules.filter((r) => !isSafeRule(r)).length;
        const safeRulesCount = declarativeRules.length - unsafeRulesCount;

        const regexRulesCount = declarativeRules.filter((r) => RulesConverter.isRegexRule(r)).length;

        const ruleSet = new RulesetWithSourceMap(
            ruleSetId,
            safeRulesCount,
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
    private static buildRulesBadFilterHashMap(
        badFilterRules: Rule[],
    ): Map<number, Rule[]> {
        const result: Map<number, Rule[]> = new Map();

        badFilterRules.forEach((r) => {
            const { hash } = r;
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
        badFilterRule: Rule,
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

            const rules = matchedSourceRules
                .flatMap((source) => {
                    return RulesetWithSourceMap.getRuleBySourceRule(source);
                });

            // NOTE: Here we use .some but not .every to simplify first
            // version of applying $badfilter rules.
            const someRulesMatched = rules
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
        dynamicBadFilterRules: Rule[],
    ): Promise<Pick<ConversionResult<IRulesetWithSourceMap>, 'errors' | 'declarativeRulesToCancel'>> {
        const declarativeRulesToCancel: UpdateStaticRulesOptions[] = [];

        const errors: Error[] = [];

        for (let i = 0; i < staticRuleSets.length; i += 1) {
            const staticRuleSet = staticRuleSets[i];

            const disableRuleIds: number[] = [];

            for (let j = 0; j < dynamicBadFilterRules.length; j += 1) {
                const badFilterRule = dynamicBadFilterRules[j];
                const hashMap = staticRuleSet.getRulesHashMap();
                const fastMatchedRulesByHash = hashMap.findRules(badFilterRule.hash);

                if (fastMatchedRulesByHash.length === 0) {
                    continue;
                }

                try {
                    // eslint-disable-next-line no-await-in-loop
                    const ids = await FilterConverter.checkFastMatchedRulesCanBeCancelled(
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

    // -------------------------------------------------------------------------
    // Option validation
    // -------------------------------------------------------------------------

    /**
     * Checks that provided converter options are correct.
     *
     * @param options Contains path to web accessible resources,
     * maximum number of converter rules and regexp rules. @see
     * {@link FilterConverterOptions} for details.
     *
     * @throws An {@link ResourcesPathError} if the resources path does not
     * start with a slash or it ends with a slash
     * OR an {@link EmptyOrNegativeNumberOfRulesError} if maximum number of
     * rules is equal or less than 0.
     * OR an {@link NegativeNumberOfRulesError} if maximum number of
     * regexp rules is less than 0.
     */
    private static checkConverterOptions(options: FilterConverterOptions): void {
        const {
            resourcesPath,
            maxNumberOfRules,
            maxNumberOfUnsafeRules,
            maxNumberOfRegexpRules,
        } = options;

        if (resourcesPath !== undefined) {
            const firstChar = 0;
            const lastChar = resourcesPath.length > 0
                ? resourcesPath.length - 1
                : 0;

            if (resourcesPath[firstChar] !== '/') {
                const msg = 'Path to web accessible resources should '
                    + `start with a leading slash: ${resourcesPath}`;
                throw new ResourcesPathError(msg);
            }

            if (resourcesPath[lastChar] === '/') {
                const msg = 'Path to web accessible resources should '
                    + `not end with a slash: ${resourcesPath}`;
                throw new ResourcesPathError(msg);
            }
        }

        if (maxNumberOfRules !== undefined && maxNumberOfRules <= 0) {
            const msg = 'Maximum number of rules cannot be equal or less than 0';
            throw new EmptyOrNegativeNumberOfRulesError(msg);
        }

        if (maxNumberOfUnsafeRules !== undefined && maxNumberOfUnsafeRules < 0) {
            const msg = 'Maximum number of unsafe rules cannot be less than 0';
            throw new NegativeNumberOfRulesError(msg);
        }

        if (maxNumberOfRegexpRules !== undefined && maxNumberOfRegexpRules < 0) {
            const msg = 'Maximum number of regexp rules cannot be less than 0';
            throw new NegativeNumberOfRulesError(msg);
        }
    }
}
