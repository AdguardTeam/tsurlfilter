/**
 * @file Implements the simple {@link FilterConverter} class for the simple
 * conversion flow. Converts adblock filter lists into declarative rules without
 * source maps or lazy loading.
 */

import { type IFilter } from '../filter/types';
import { RulesConverter } from '../rule-converters/rules-converter';
import { RulesScanner } from '../rules-scanner';
import { type IRuleset as IRulesetSimple, Ruleset } from '../ruleset/ruleset';

import { AbstractFilterConverter } from './abstract-filter-converter';
import { type ConversionResult } from './conversion-result';
import { type FilterConverterOptions } from './filter-converter-options';

/**
 * Simple filter-to-rules converter. Converts adblock filter lists into
 * declarative rules.
 *
 * Use this class for the simple conversion flow when only `DeclarativeRule[]`
 * output is needed. For the advanced conversion flow requiring source maps and
 * `$badfilter` cross-filter application, use {@link FilterConverterWithSourceMap}.
 */
export class FilterConverter extends AbstractFilterConverter<IFilter, IRulesetSimple> {
    /**
     * Converts the provided list of filters into declarative rule sets.
     *
     * By default returns one {@link ConversionResult} per filter. When
     * `options.combine` is `true`, all filters are merged into a single result.
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
    public override async convert(
        filters: IFilter[],
        options?: FilterConverterOptions,
    ): Promise<ConversionResult<IRulesetSimple>[]> {
        if (options) {
            FilterConverter.checkConverterOptions(options);
        }

        const scannedLimit = options?.maxNumberOfRules
            ? Math.ceil(
                options.maxNumberOfRules
                * FilterConverter.SCANNED_NETWORK_RULES_MULTIPLICATOR,
            )
            : undefined;

        if (options?.combine) {
            const result = await FilterConverter.convertFilters(
                filters,
                FilterConverter.COMBINED_RULESET_ID,
                options,
                scannedLimit,
            );
            return [result];
        }

        const conversionTasks = filters.map((filter) => FilterConverter.convertFilters(
            [filter],
            FilterConverter.getRuleSetId(filter.getId()),
            options,
            scannedLimit,
        ));

        return Promise.all(conversionTasks);
    }

    /**
     * Scans and converts the given filters into a single {@link ConversionResult}
     * identified by `ruleSetId`.
     *
     * @param filters Filters to scan and convert.
     * @param ruleSetId ID to assign to the produced {@link Ruleset}.
     * @param options Converter options.
     * @param scannedLimit Optional limit on the number of scanned rules.
     *
     * @returns Conversion result for the given filters.
     */
    private static async convertFilters(
        filters: IFilter[],
        ruleSetId: string,
        options: FilterConverterOptions | undefined,
        scannedLimit: number | undefined,
    ): Promise<ConversionResult<IRulesetSimple>> {
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
}
