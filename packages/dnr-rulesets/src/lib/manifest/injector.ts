import type { Manifest } from './parser';

/**
 * Options for apply rulesets to manifest.
 */
export type ApplyRulesetsOptions = {
    /**
     * Array of filters ids to append. If empty, all filters will be appended.
     * Appended filters will be disabled by default.
     */
    ids?: string[];

    /**
     * Array of filters ids to enable.
     * If empty, all filters will be disabled.
     */
    enable?: string[];

    /**
     * Flag determines whether to overwrite rulesets with existing id.
     *
     * @default false
     */
    forceUpdate?: boolean;

    /**
     * Prefix for ruleset file name.
     *
     * @default 'ruleset_'
     */
    rulesetPrefix?: string;
};

/**
 * Generates relative path for specified ruleset.
 *
 * @param rulesetId Ruleset id.
 */
export type RulesetPathGenerator = (rulesetId: string) => string;

/**
 * Api for injecting rulesets into manifest.
 */
export interface RulesetsInjectorInterface {
    /**
     * Scans filters directory and append rulesets to manifest.
     *
     * @param generateRulesetPath Function that generates relative path for ruleset.
     * @param manifest Manifest record.
     * @param filterNames Array of filter file names.
     * @param options Apply options {@link ApplyRulesetsOptions}.
     *
     * @returns Patched manifest with defined declarative_net_request.
     *
     * @throws Error if manifest already contains ruleset with the specified ids
     * and {@link options.forceUpdate} is `false` or if manifest file or filters directory are not found.
     */
    applyRulesets<T extends Manifest>(
        generateRulesetPath: RulesetPathGenerator,
        manifest: T,
        filterNames: string[],
        options?: Partial<ApplyRulesetsOptions>
    ): T;
}

/**
 * Api for injecting rulesets into manifest.
 *
 * @see {@link RulesetsInjectorInterface}
 */
export class RulesetsInjector implements RulesetsInjectorInterface {
    /**
     * Default prefix for ruleset id.
     */
    private static readonly DEFAULT_RULESET_PREFIX = 'ruleset_';

    /** @inheritdoc */
    public applyRulesets<T extends Manifest>(
        generateRulesetPath: RulesetPathGenerator,
        manifest: T,
        filterNames: string[],
        options?: ApplyRulesetsOptions,
    ): T {
        if (!manifest.declarative_net_request) {
            manifest.declarative_net_request = {};
        }

        if (!manifest.declarative_net_request.rule_resources) {
            manifest.declarative_net_request.rule_resources = [];
        }

        const ruleResources = manifest.declarative_net_request.rule_resources;

        for (const filterName of filterNames) {
            const rulesetIdMatch = filterName.match(/\d+/);

            if (!rulesetIdMatch) {
                continue;
            }

            const matchedRulesetId = rulesetIdMatch[0];

            if (Array.isArray(options?.ids)
                && options.ids.length > 0
                && !options.ids.includes(matchedRulesetId)) {
                continue;
            }

            const rulesetId = `${options?.rulesetPrefix ?? RulesetsInjector.DEFAULT_RULESET_PREFIX}${matchedRulesetId}`;

            const isEnabled = Array.isArray(options?.enable)
                && options.enable.length > 0
                && options.enable.includes(matchedRulesetId);

            const ruleset = {
                id: rulesetId,
                enabled: isEnabled,
                path: generateRulesetPath(rulesetId),
            };

            const existingRulesetIndex = ruleResources.findIndex(({ id }) => id === rulesetId);

            if (existingRulesetIndex !== -1) {
                if (options?.forceUpdate) {
                    ruleResources[existingRulesetIndex] = ruleset;
                } else {
                    throw new Error(`Duplicate ruleset ID: ${rulesetId}`);
                }
            } else {
                ruleResources.push(ruleset);
            }
        }

        return manifest;
    }
}
