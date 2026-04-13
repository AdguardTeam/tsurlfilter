/**
 * @file Defines the {@link AbstractFilterConverter} abstract base class shared
 * by {@link FilterConverter} and {@link FilterConverterWithSourceMap}.
 */

import {
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRulesError,
    ResourcesPathError,
} from '../errors/converter-options-errors';
import { type IFilter } from '../filter/types';

import { type ConversionResult } from './conversion-result';
import { type FilterConverterOptions } from './filter-converter-options';

/**
 * Abstract base class for filter converters. Provides shared constants,
 * utilities, and option validation used by both {@link FilterConverter} and
 * {@link FilterConverterWithSourceMap}.
 *
 * @template TFilter The filter type accepted by {@link convert}.
 * @template TRuleset The ruleset type returned by {@link convert}.
 */
// TODO: Consider moving common $badfilter scan-time logic to this class to
// avoid duplication between FilterConverter and FilterConverterWithSourceMap.
// Both flows need to skip negated rules before passing them to the converter,
// and the current hook point (skipNegatedRulesFn in FCWSM) is advanced-flow-only.
export abstract class AbstractFilterConverter<
    TFilter extends IFilter<string | Promise<string>>,
    TRuleset,
> {
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
        return `ruleset_${filterId}`;
    }

    /**
     * Number of scanned rules can be limited via converter options. In this
     * case we increase the limit by 10% to scan more rules in case of some
     * network rules will be combined into one declarative rule. It is safe,
     * because we have double check for maxNumberOfRules on the converted DNR
     * rules.
     */
    protected static readonly SCANNED_NETWORK_RULES_MULTIPLICATOR = 1.1;

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
    protected static checkConverterOptions(options: FilterConverterOptions): void {
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

    /**
     * Converts the provided list of filters into declarative rule sets.
     *
     * @param filters List of filters to convert.
     * @param options Converter options.
     *
     * @returns Array of {@link ConversionResult} items.
     */
    public abstract convert(
        filters: TFilter[],
        options?: FilterConverterOptions,
    ): Promise<ConversionResult<TRuleset>[]>;
}
