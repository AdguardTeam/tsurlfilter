import { type Rule } from '../rule/rule';

/**
 * Options common to both conversion modes (simple and source-map).
 */
export interface BaseFilterConverterOptions {
    /**
     * Path to web accessible resources, relative to the extension root dir.
     * Should start with leading slash and should not end with trailing slash (`'/'`).
     */
    resourcesPath?: string;

    /**
     * Maximum number of converted rules.
     */
    maxNumberOfRules?: number;

    /**
     * Maximum number of converted unsafe dynamic rules. AG-33779.
     */
    maxNumberOfUnsafeRules?: number;

    /**
     * Maximum number of converted rules with regexps.
     */
    maxNumberOfRegexpRules?: number;

    /**
     * When `true`, all filters passed to `convert()` are merged into a single
     * combined {@link Ruleset} instead of one ruleset per filter.
     *
     * @default false
     */
    combine?: boolean;
}

/**
 * Options for the simple conversion flow.
 * Produces {@link IRuleset} rulesets with synchronous access to declarative
 * rules and no source-map support.
 */
export interface SimpleConverterOptions extends BaseFilterConverterOptions {
    /**
     * Selects simple mode. When omitted or `false`, `convert()` returns
     * {@link IRuleset} rulesets. Source-map-only options such as
     * {@link SourceMapConverterOptions.badFilterRules} are not accepted here.
     *
     * @default false
     */
    withSourceMap?: false;
}

/**
 * Options for the source-map conversion flow.
 * Produces {@link IRulesetWithSourceMap} rulesets that include source maps,
 * hash maps, lazy loading, and full `$badfilter` cross-filter support.
 */
export interface SourceMapConverterOptions extends BaseFilterConverterOptions {
    /**
     * Selects source-map mode. Must be the literal `true` to discriminate
     * from {@link SimpleConverterOptions}.
     */
    withSourceMap: true;

    /**
     * Flat array of `$badfilter` network rules collected from pre-built static
     * rulesets (via {@link IRulesetWithSourceMap.getBadFilterRules}).
     *
     * When provided, `convert()` builds an internal hash map from these rules
     * and skips any dynamic rules that are negated by them **before** conversion
     * (scan-time skip). This avoids the N-to-1 grouping problem that would
     * arise if the skip were applied post-conversion.
     *
     * Only valid in source-map mode (enforced by the discriminated union).
     */
    badFilterRules?: Rule[];
}

/**
 * Interface that represents options for the converter.
 *
 * Discriminated union on {@link BaseFilterConverterOptions} plus the
 * `withSourceMap` flag — this lets TypeScript enforce at compile time that
 * source-map-only options (e.g. `badFilterRules`) are passed only when
 * `withSourceMap: true`.
 */
export type FilterConverterOptions = SimpleConverterOptions | SourceMapConverterOptions;
