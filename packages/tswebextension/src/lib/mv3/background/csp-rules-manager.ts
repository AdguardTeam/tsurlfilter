import {
    type ConversionResult,
    type DeclarativeRule,
    FilterConverter,
    type IFilter,
    type IRulesetWithSourceMap,
    isConversionError,
    isRuleScanError,
    isUnavailableFilterSourceError,
} from '@adguard/dnr-converter';

import { logger } from '../../common/utils/logger';

/**
 * Result of rebuilding CSP rules from all active filters.
 *
 * `limitations` is omitted: `convertCspRules()` runs without quota options, so
 * the field is always empty.
 */
export type CspRulesResult = Omit<ConversionResult<IRulesetWithSourceMap>, 'limitations'> & {
    /**
     * CSP rules originating from static filters.
     */
    staticRules: DeclarativeRule[];

    /**
     * CSP rules originating from dynamic filters.
     */
    dynamicRules: DeclarativeRule[];

    /**
     * Ids of unreadable static filters.
     *
     * Their content cannot be read, so their CSP rules are absent from
     * `staticRules` and the caller must keep them from the static rulesets
     * instead of dropping them with the stale ones.
     */
    unreadableStaticFilterIds: number[];

    /**
     * CSP conversion errors originating from static filters.
     *
     * Errors of user rules are reported separately, in `dynamicErrors`, so a
     * consumer that reads both channels does not see the same error twice.
     */
    staticErrors: ConversionResult<IRulesetWithSourceMap>['errors'];

    /**
     * CSP conversion errors originating from dynamic filters.
     *
     * Both kinds of errors are included: a conversion error carries the rule,
     * while a scan error of a rule which failed to parse carries the filter id.
     */
    dynamicErrors: ConversionResult<IRulesetWithSourceMap>['errors'];
};

/**
 * Rebuilds CSP rules from their original filtering rules.
 */
export class CspRulesManager {
    /**
     * Resolves, converts, and separates CSP rules by DNR storage scope.
     *
     * @param staticFilters Enabled built-in filters.
     * @param dynamicFilters User-controlled filters.
     * @param resourcesPath Path to web-accessible resources.
     *
     * @returns Rebuilt CSP rules split by DNR storage scope.
     *
     * @throws If a generated rule has no source, an unknown source filter, or
     * combines static and dynamic sources.
     */
    public static async build(
        staticFilters: IFilter[],
        dynamicFilters: IFilter[],
        resourcesPath?: string,
    ): Promise<CspRulesResult> {
        const converter = new FilterConverter();
        const conversionResult = await converter.convertCspRules(
            [...staticFilters, ...dynamicFilters],
            resourcesPath,
        );
        const staticFilterIds = new Set(staticFilters.map((filter) => filter.getId()));
        const dynamicFilterIds = new Set(dynamicFilters.map((filter) => filter.getId()));

        // A filter whose content could not be read is absent from the rebuilt
        // rules, so the caller must keep its rules from the static rulesets.
        const unreadableStaticFilterIds = conversionResult.errors
            .filter(isUnavailableFilterSourceError)
            .map(({ filterId }) => filterId)
            .filter((filterId) => staticFilterIds.has(filterId));

        // A plain `Error` carries no filter id - `groupConvertedRules()` pushes
        // one when a source mapping is missing - so `filterErrors()` can route
        // it to neither channel: report it instead of dropping it silently.
        conversionResult.errors
            .filter((error) => (
                !isConversionError(error)
                && !isRuleScanError(error)
                && !isUnavailableFilterSourceError(error)
            ))
            .forEach((error) => {
                logger.warn('[tsweb.CspRulesManager.build]: cannot route a CSP conversion error:', error);
            });

        const declarativeRules = await conversionResult.ruleset.getDeclarativeRules();
        const staticRules: DeclarativeRule[] = [];
        const dynamicRules: DeclarativeRule[] = [];

        // Only the filter of each source is needed, so the source map is read
        // instead of the rule text: it neither splits the filter content nor
        // rebuilds the whole offset map on every configuration.
        const rulesWithSources = await Promise.all(declarativeRules.map(async (rule) => ({
            rule,
            sources: await conversionResult.ruleset.getSourceRuleIndexes(rule.id),
        })));

        rulesWithSources.forEach(({ rule, sources }) => {
            if (sources.length === 0) {
                throw new Error(`Cannot find source for rebuilt CSP rule ${rule.id}`);
            }

            const hasStaticSource = sources.some(({ filterId }) => staticFilterIds.has(filterId));
            const hasDynamicSource = sources.some(({ filterId }) => dynamicFilterIds.has(filterId));
            if (hasStaticSource && hasDynamicSource) {
                throw new Error(`Rebuilt CSP rule ${rule.id} combines static and dynamic sources`);
            }

            // A source which belongs to neither set would be classified as
            // dynamic here and then dropped by both error channels.
            if (!hasStaticSource && !hasDynamicSource) {
                throw new Error(`Rebuilt CSP rule ${rule.id} has no known source filter`);
            }

            if (hasStaticSource) {
                staticRules.push(rule);
            } else {
                dynamicRules.push(rule);
            }
        });

        return {
            ...conversionResult,
            staticRules,
            dynamicRules,
            unreadableStaticFilterIds,
            staticErrors: CspRulesManager.filterErrors(conversionResult.errors, staticFilterIds),
            dynamicErrors: CspRulesManager.filterErrors(conversionResult.errors, dynamicFilterIds),
        };
    }

    /**
     * Filters conversion, scan and source errors by the filters they belong to.
     *
     * Every error which carries a filter id must be routed here: an unreadable
     * filter reports an error without a parsed rule, so classifying it by the
     * error kind alone would drop it from both channels.
     *
     * @param errors Errors of the CSP conversion.
     * @param filterIds Ids of the filters to keep.
     *
     * @returns Errors of the given filters.
     */
    private static filterErrors(
        errors: ConversionResult<IRulesetWithSourceMap>['errors'],
        filterIds: Set<number>,
    ): ConversionResult<IRulesetWithSourceMap>['errors'] {
        return errors.filter((error) => {
            if (isConversionError(error)) {
                return filterIds.has(error.rule.filterListId);
            }

            if (isRuleScanError(error) || isUnavailableFilterSourceError(error)) {
                return filterIds.has(error.filterId);
            }

            return false;
        });
    }
}
