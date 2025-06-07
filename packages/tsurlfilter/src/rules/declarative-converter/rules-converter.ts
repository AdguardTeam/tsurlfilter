/* eslint-disable jsdoc/require-description-complete-sentence  */
/**
 * @file Describes the conversion process from {@link IndexedNetworkRuleWithHash}
 * to declarative rules {@link DeclarativeRule} via applying $badfilter-rules
 * {@link DeclarativeRulesConverter#applyBadFilter} and checks for specified
 * limitations {@link DeclarativeRulesConverter#checkLimitations}.
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

import { RuleActionType, type DeclarativeRule } from './declarative-rule';
import { type ConvertedRules } from './converted-result';
import { RegularRulesConverter } from './grouped-rules-converters/regular-converter';
import { RemoveParamRulesConverter } from './grouped-rules-converters/remove-param-converter';
import { RemoveHeaderRulesConverter } from './grouped-rules-converters/remove-header-converter';
import { CspRulesConverter } from './grouped-rules-converters/csp-converter';
import { type Source } from './source-map';
import type { IndexedNetworkRuleWithHash } from './network-indexed-rule-with-hash';
import {
    type LimitationError,
    TooManyRulesError,
    TooManyRegexpRulesError,
    TooManyUnsafeRulesError,
} from './errors/limitation-errors';
import { BadFilterRulesConverter } from './grouped-rules-converters/bad-filter-converter';
import { DeclarativeRulesGrouper, type GroupedRules, RulesGroup } from './rules-grouper';
import { type DeclarativeConverterOptions } from './declarative-converter-options';
import { type ConversionError, InvalidDeclarativeRuleError } from './errors/conversion-errors';
import { type ScannedFilter } from './network-rules-scanner';

type FiltersIdsWithGroupedRules = [number, GroupedRules][];

/**
 * Describes how to convert {@link IndexedNetworkRuleWithHash|indexed network rules}
 * into list of {@link DeclarativeRule|declarative rules}.
 */
export class DeclarativeRulesConverter {
    /**
     * The declarative identifier of a rule must be a natural number.
     */
    static readonly MIN_DECLARATIVE_RULE_ID = 1;

    /**
     * The declarative identifier of a rule must be less than signed 32-bit
     * integer. The maximum value of a signed 32-bit integer is 2^31 - 1.
     * @see {@link https://groups.google.com/a/chromium.org/g/chromium-extensions/c/yVb56u5Vf0s?}
     */
    static readonly MAX_DECLARATIVE_RULE_ID = 2 ** 31 - 1;

    /**
     * List of declarative rule actions which are considered safe.
     *
     * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#safe_rules}
     */
    static readonly SAFE_RULE_ACTIONS: ReadonlySet<RuleActionType> = new Set([
        RuleActionType.BLOCK,
        RuleActionType.ALLOW,
        RuleActionType.ALLOW_ALL_REQUESTS,
        RuleActionType.UPGRADE_SCHEME,
    ]);

    /**
     * Describes for which group of rules which converter should be used.
     */
    static converters = {
        [RulesGroup.Regular]: RegularRulesConverter,
        [RulesGroup.Csp]: CspRulesConverter,
        [RulesGroup.RemoveParam]: RemoveParamRulesConverter,
        [RulesGroup.RemoveHeader]: RemoveHeaderRulesConverter,
        [RulesGroup.BadFilter]: BadFilterRulesConverter,
    };

    /**
     * Converts list of filters ids with indexed rules to declarative rules:
     * applies $badfilter rules, then for each group of rules (inside one
     * filter) runs specified converter.
     *
     * TODO: The $removeparam, $removeheader, $csp converters can also combine
     * rules across multiple filters.
     *
     * @see {@link DeclarativeRulesConverter.converters}.
     *
     * @param filtersWithRules List of filters ids with indexed rules.
     * @param options Options for conversion.
     *
     * @returns A list of declarative rules, a regexp rule counter,
     * and a list of sourcemap values that contain the relationship between the
     * transformed declarative rule and the source rule.
     */
    public static async convert(
        filtersWithRules: ScannedFilter[],
        options?: DeclarativeConverterOptions,
    ): Promise<ConvertedRules> {
        const filters = this.applyBadFilter(filtersWithRules);

        let converted: ConvertedRules = {
            sourceMapValues: [],
            declarativeRules: [],
            errors: [],
        };

        // Set to store unique IDs of declarative rules, it will be modified
        // during the conversion process after each converted rule.
        //
        // Note: since we apply post-converting processing via grouping similar
        // rules for some modifiers, we may have some "released" IDs, but we
        // suppose that 2^31-1 is enough for all rules even with such not used
        // IDs, so to keep the code simple we don't delete them from the set
        // after conversion.
        const uniqueIds = new Set<number>();

        for (const [filterId, groupedRules] of filters) {
            const {
                sourceMapValues,
                declarativeRules,
                errors,
                // eslint-disable-next-line no-await-in-loop
            } = await this.convertRules(
                filterId,
                groupedRules,
                uniqueIds,
                options,
            );

            converted.sourceMapValues = converted.sourceMapValues.concat(sourceMapValues);
            converted.declarativeRules = converted.declarativeRules.concat(declarativeRules);
            converted.errors = converted.errors.concat(errors);
        }

        converted = this.checkLimitations(
            converted,
            options?.maxNumberOfRules,
            options?.maxNumberOfUnsafeRules,
            options?.maxNumberOfRegexpRules,
        );

        if (!this.checkRulesHaveUniqueIds(converted.declarativeRules)) {
            throw new Error('Declarative rules have non-unique identifiers.');
        }

        if (!this.checkRulesHaveCorrectIds(converted.declarativeRules)) {
            throw new Error('Declarative rules have incorrect identifiers.');
        }

        return converted;
    }

    /**
     * Converts filter's indexed rules into declarative rules.
     *
     * @param filterId Filed id.
     * @param groupsRules Grouped rules.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     * @param options Options for conversion.
     *
     * @returns A list of declarative rules, a regexp rule counter,
     * and a list of sourcemap values that contain the relationship between the
     * transformed declarative rule and the source rule.
     */
    private static async convertRules(
        filterId: number,
        groupsRules: GroupedRules,
        usedIds: Set<number>,
        options?: DeclarativeConverterOptions,
    ): Promise<ConvertedRules> {
        const converted: ConvertedRules = {
            sourceMapValues: [],
            declarativeRules: [],
            errors: [],
        };

        // Map because RulesGroup values are numbers
        const groups = Object.keys(groupsRules).map(Number);
        await Promise.all(groups.map(async (key: RulesGroup) => {
            const converter = new DeclarativeRulesConverter.converters[key](options?.resourcesPath);
            const {
                sourceMapValues,
                declarativeRules,
                errors,
            } = await converter.convert(
                filterId,
                groupsRules[key],
                usedIds,
            );

            converted.sourceMapValues = converted.sourceMapValues.concat(sourceMapValues);
            converted.declarativeRules = converted.declarativeRules.concat(declarativeRules);
            converted.errors = converted.errors.concat(errors);
        }));

        return converted;
    }

    /**
     * Checks that IDs of declarative rules fit into the range of 1 to 2^31-1.
     *
     * This check is needed because we have post-converting grouping rules,
     * where some code could easily change any part of an already converted DNR
     * rule, and we would receive a critical error.
     * That's why we added post-processing checks.
     *
     * @see {@link https://groups.google.com/a/chromium.org/g/chromium-extensions/c/yVb56u5Vf0s?}
     *
     * @param rules List of declarative rules.
     *
     * @returns True if all rules identifiers which fit in allowed range,
     * otherwise false.
     */
    private static checkRulesHaveCorrectIds(rules: DeclarativeRule[]): boolean {
        return rules.every(({ id }) => {
            return id >= this.MIN_DECLARATIVE_RULE_ID && id <= this.MAX_DECLARATIVE_RULE_ID;
        });
    }

    /**
     * Checks that declarative rules have unique identifiers.
     *
     * This check is needed because we have post-converting grouping rules,
     * where some code could easily change any part of an already converted DNR
     * rule, and we would receive a critical error.
     * That's why we added post-processing checks.
     *
     * @param rules List of declarative rules.
     *
     * @returns True if all rules have unique identifiers, otherwise false.
     */
    private static checkRulesHaveUniqueIds(rules: DeclarativeRule[]): boolean {
        const ids = rules.map(({ id }) => id);

        const uniqueIds = new Set(ids);

        return uniqueIds.size === rules.length;
    }

    /**
     * Checks whether the declarative rule is safe.
     *
     * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#safe_rules}
     *
     * @param rule Declarative rule to check.
     *
     * @returns True if the rule is safe, otherwise false.
     */
    public static isSafeRule(rule: DeclarativeRule): boolean {
        return this.SAFE_RULE_ACTIONS.has(rule.action.type);
    }

    /**
     * Checks whether the declarative rule is regex.
     *
     * @see {@link https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-regexFilter}
     *
     * @param rule Declarative rule to check.
     *
     * @returns True if the rule is regex, otherwise false.
     */
    public static isRegexRule(rule: DeclarativeRule): boolean {
        return rule.condition.regexFilter !== undefined;
    }

    /**
     * Removes sources and errors associated with a truncated rule.
     *
     * @param ruleId The ID of the truncated rule.
     * @param sourcesIndex The index of sources.
     * @param errorsIndex The index of errors.
     * @param excludedRulesIds The list of excluded rule IDs.
     */
    private static removeTruncatedRuleSourcesAndErrors(
        ruleId: number,
        sourcesIndex: Map<number, Source[]>,
        errorsIndex: Map<number, ConversionError[]>,
        excludedRulesIds: number[],
    ): void {
        // Removing a source for a truncated rule
        const sources = sourcesIndex.get(ruleId) || [];
        const sourcesRulesIds = sources.map(({ sourceRuleIndex }) => sourceRuleIndex);
        sourcesIndex.set(ruleId, []);

        // Removing an error for a truncated rule
        errorsIndex.set(ruleId, []);

        // Note: be sure, that sourceRulesIds are not too much to overflow stack.
        excludedRulesIds.push(...sourcesRulesIds);
    }

    /**
     * Check that declarative rules matches the specified constraints and
     * cuts rules if needed as from list also from source map.
     *
     * @param converted Converted rules, errors, sourcemap and counters.
     * @param maxNumberOfRules Maximum number of converted rules.
     * @param maxNumberOfUnsafeRules Maximum number of converted unsafe rules.
     * @param maxNumberOfRegexpRules Maximum number of converted regexp rules.
     *
     * @returns Transformed converted rules with modified (if abbreviated)
     * counters, declarative rules list, source map and errors.
     */
    private static checkLimitations(
        converted: ConvertedRules,
        maxNumberOfRules?: number,
        maxNumberOfUnsafeRules?: number,
        maxNumberOfRegexpRules?: number,
    ): ConvertedRules {
        const limitations: LimitationError[] = [];

        // We apply restrictions only to transformed rules, so we need to filter
        // rule conversion errors if we remove the transformed rule associated
        // with those errors
        let {
            declarativeRules, sourceMapValues, errors,
        } = converted;

        const convertedRulesErrors: InvalidDeclarativeRuleError[] = [];
        const otherErrors: Error[] = [];

        for (let i = 0; i < errors.length; i += 1) {
            const e = errors[i];

            // Checks only errors of converted declarative rules
            if (e instanceof InvalidDeclarativeRuleError) {
                convertedRulesErrors.push(e);
            } else {
                otherErrors.push(e);
            }
        }

        // TODO: Lazy creation of index
        // Create index of errors for fast search and filtering
        const convertedRulesErrorsIndex = new Map<number, ConversionError[]>();
        convertedRulesErrors.forEach((e) => {
            // Checks only errors of converted declarative rules
            const errorsList = convertedRulesErrorsIndex.get(e.declarativeRule.id);
            const newValue = errorsList
                ? errorsList.concat(e)
                : [e];

            convertedRulesErrorsIndex.set(e.declarativeRule.id, newValue);
        });

        // TODO: Lazy creation of index
        // Create index of sources for fast search and filtering
        const sourcesIndex = new Map<number, Source[]>();
        sourceMapValues.forEach((source) => {
            const sources = sourcesIndex.get(source.declarativeRuleId);
            const newValue = sources
                ? sources.concat(source)
                : [source];

            sourcesIndex.set(source.declarativeRuleId, newValue);
        });

        // Checks and, if necessary, trims the maximum number of rules
        if (maxNumberOfRules && declarativeRules.length > 0) {
            const filteredRules: DeclarativeRule[] = [];
            const excludedRulesIds: number[] = [];

            let unsafeRulesCounter = 0;

            for (let i = 0; i < declarativeRules.length; i += 1) {
                const rule = declarativeRules[i];

                if (maxNumberOfUnsafeRules && !this.isSafeRule(rule)) {
                    unsafeRulesCounter += 1;

                    if (unsafeRulesCounter > maxNumberOfUnsafeRules) {
                        this.removeTruncatedRuleSourcesAndErrors(
                            rule.id,
                            sourcesIndex,
                            convertedRulesErrorsIndex,
                            excludedRulesIds,
                        );

                        continue;
                    }
                }

                if (i < maxNumberOfRules) {
                    filteredRules.push(rule);
                    continue;
                }

                this.removeTruncatedRuleSourcesAndErrors(
                    rule.id,
                    sourcesIndex,
                    convertedRulesErrorsIndex,
                    excludedRulesIds,
                );
            }

            if (
                maxNumberOfUnsafeRules
                && unsafeRulesCounter > maxNumberOfUnsafeRules
            ) {
                const msg = 'After conversion, too many unsafe rules remain: '
                    + `${unsafeRulesCounter} exceeds `
                    + `the limit provided - ${maxNumberOfUnsafeRules}`;
                const err = new TooManyUnsafeRulesError(
                    msg,
                    excludedRulesIds,
                    maxNumberOfUnsafeRules,
                    unsafeRulesCounter - maxNumberOfUnsafeRules,
                );
                limitations.push(err);
            }

            if (declarativeRules.length > maxNumberOfRules) {
                const msg = 'After conversion, too many declarative rules remain: '
                    + `${declarativeRules.length} exceeds `
                    + `the limit provided - ${maxNumberOfRules}`;
                const err = new TooManyRulesError(
                    msg,
                    excludedRulesIds,
                    maxNumberOfRules,
                    declarativeRules.length - maxNumberOfRules,
                );

                limitations.push(err);
            }

            declarativeRules = filteredRules;
        }

        // Checks and, if necessary, trims the maximum number of regexp rules
        if (maxNumberOfRegexpRules) {
            const filteredRules: DeclarativeRule[] = [];
            const excludedRulesIds: number[] = [];
            let regexpRulesCounter = 0;

            for (let i = 0; i < declarativeRules.length; i += 1) {
                const rule = declarativeRules[i];

                if (this.isRegexRule(rule)) {
                    regexpRulesCounter += 1;

                    if (regexpRulesCounter > maxNumberOfRegexpRules) {
                        this.removeTruncatedRuleSourcesAndErrors(
                            rule.id,
                            sourcesIndex,
                            convertedRulesErrorsIndex,
                            excludedRulesIds,
                        );

                        continue;
                    }
                }

                filteredRules.push(rule);
            }

            if (regexpRulesCounter > maxNumberOfRegexpRules) {
                const msg = 'After conversion, too many regexp rules remain: '
                    + `${regexpRulesCounter} exceeds `
                    + `the limit provided - ${maxNumberOfRegexpRules}`;
                const err = new TooManyRegexpRulesError(
                    msg,
                    excludedRulesIds,
                    maxNumberOfRegexpRules,
                    regexpRulesCounter - maxNumberOfRegexpRules,
                );
                limitations.push(err);
            }

            declarativeRules = filteredRules;
        }

        // Make array from index
        sourceMapValues = Array.from(sourcesIndex.values())
            .filter((arr) => arr.length > 0)
            .flat();

        // Make array from index
        errors = Array.from(convertedRulesErrorsIndex.values())
            .filter((arr) => arr.length > 0)
            .flat();

        return {
            sourceMapValues,
            declarativeRules,
            errors: errors.concat(otherErrors),
            limitations,
        };
    }

    /**
     * Filters rules that have been affected by $badfilter rules and
     * groups them by modifiers.
     *
     * @param filtersWithRules List with filters ids and indexed rules.
     *
     * @returns List with filters ids and grouped indexed rules.
     */
    private static applyBadFilter(filtersWithRules: ScannedFilter[]): FiltersIdsWithGroupedRules {
        let allBadFilterRules: IndexedNetworkRuleWithHash[] = [];

        // Group rules
        const filterIdsWithGroupedRules = filtersWithRules
            .map(({ id, rules }) => {
                const rulesToProcess = DeclarativeRulesGrouper.splitRulesByGroups(rules);
                allBadFilterRules = allBadFilterRules.concat(rulesToProcess[RulesGroup.BadFilter]);
                const tuple: [number, GroupedRules] = [id, rulesToProcess];

                return tuple;
            });

        // Define filter function
        const filterByBadFilterFn = (ruleToTest: IndexedNetworkRuleWithHash): boolean => {
            const networkRuleToTest = ruleToTest.rule;

            for (const { rule } of allBadFilterRules) {
                if (rule.rule.negatesBadfilter(networkRuleToTest.rule)) {
                    return false;
                }
            }

            return true;
        };

        // For each group of filters' rules apply filter function
        return filterIdsWithGroupedRules.map(([filterId, groupedRules]) => {
            const filtered = groupedRules;
            // Map because RulesGroup values are numbers
            const groups = Object.keys(filtered).map(Number);
            groups.forEach((key: RulesGroup) => {
                filtered[key] = filtered[key].filter(filterByBadFilterFn);
            });

            // Clean up bad filters rules
            filtered[RulesGroup.BadFilter] = [];

            return [filterId, filtered];
        });
    }
}
