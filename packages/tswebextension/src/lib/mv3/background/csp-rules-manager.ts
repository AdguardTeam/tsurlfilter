import {
    type ConversionResult,
    type DeclarativeRule,
    FilterConverter,
    type IFilter,
    type IRulesetWithSourceMap,
    isConversionError,
} from '@adguard/dnr-converter';

/**
 * Result of rebuilding CSP rules from all active filters.
 */
export type CspRulesResult = ConversionResult<IRulesetWithSourceMap> & {
    /**
     * CSP rules originating from static filters.
     */
    staticRules: DeclarativeRule[];

    /**
     * CSP rules originating from dynamic filters.
     */
    dynamicRules: DeclarativeRule[];

    /**
     * CSP conversion errors originating from dynamic filters.
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
     * @throws If a generated rule has no source or combines static and dynamic sources.
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
        const declarativeRules = await conversionResult.ruleset.getDeclarativeRules();
        const staticFilterIds = new Set(staticFilters.map((filter) => filter.getId()));
        const dynamicFilterIds = new Set(dynamicFilters.map((filter) => filter.getId()));
        const staticRules: DeclarativeRule[] = [];
        const dynamicRules: DeclarativeRule[] = [];

        const rulesWithSources = await Promise.all(declarativeRules.map(async (rule) => ({
            rule,
            sources: await conversionResult.ruleset.getRulesById(rule.id),
        })));

        rulesWithSources.forEach(({ rule, sources }) => {
            if (sources.length === 0) {
                throw new Error(`Cannot find source for rebuilt CSP rule ${rule.id}`);
            }

            const hasStaticSource = sources.some(({ filterId }) => staticFilterIds.has(filterId));
            const hasDynamicSource = sources.some(({ filterId }) => !staticFilterIds.has(filterId));
            if (hasStaticSource && hasDynamicSource) {
                throw new Error(`Rebuilt CSP rule ${rule.id} combines static and dynamic sources`);
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
            dynamicErrors: conversionResult.errors.filter((error) => (
                isConversionError(error) && dynamicFilterIds.has(error.rule.filterListId)
            )),
        };
    }
}
