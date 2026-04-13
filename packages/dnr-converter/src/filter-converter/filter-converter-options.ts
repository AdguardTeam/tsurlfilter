import { type NetworkRule } from '../network-rule';

/**
 * Interface that represents options for the converter.
 */
export interface FilterConverterOptions {
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

    /**
     * Flat array of `$badfilter` network rules collected from pre-built static
     * rulesets (via {@link IRulesetWithSourceMap.getBadFilterRules}).
     *
     * When provided, `convert()` (in the advanced flow) builds an internal hash
     * map from these rules and skips any dynamic rules that are negated by them
     * **before** conversion (scan-time skip). This avoids the N-to-1 grouping
     * problem that would arise if the skip were applied post-conversion.
     *
     * Only meaningful in the advanced flow (`FilterConverterWithSourceMap`).
     */
    badFilterRules?: NetworkRule[];
}
