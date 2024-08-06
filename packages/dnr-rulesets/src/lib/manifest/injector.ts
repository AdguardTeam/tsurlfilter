import type { Manifest } from './parser';

/**
 * Options for patching manifest.
 */
export type PatchManifestOptions = {
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
     * @param options Patch options {@link PatchManifestOptions}.
     *
     * @returns Patched manifest with defined declarative_net_request.
     */
    applyRulesets<T extends Manifest>(
        generateRulesetPath: RulesetPathGenerator,
        manifest: T,
        filterNames: string[],
        options?: Partial<PatchManifestOptions>
    ): T;
}

/**
 * @see {@link RulesetsInjectorInterface}
 */
export class RulesetsInjector implements RulesetsInjectorInterface {
    /**
     * Default prefix for ruleset id.
     */
    private static readonly DEFAULT_RULESET_PREFIX = 'ruleset_';

    /**
     * @inheritdoc
     * @throws Error if manifest already contains ruleset with the specified ids
     * and {@link options.forceUpdate} is `false` or if manifest file or filters directory are not found.
     */
    public applyRulesets<T extends Manifest>(
        generateRulesetPath: RulesetPathGenerator,
        manifest: T,
        filterNames: string[],
        options?: PatchManifestOptions,
    ): T {
        if (!manifest.declarative_net_request) {
            manifest.declarative_net_request = {};
        }

        if (!manifest.declarative_net_request.rule_resources) {
            manifest.declarative_net_request.rule_resources = [];
        }

        const ruleResources = manifest.declarative_net_request.rule_resources;

        for (const filterName of filterNames) {
            const rulesetIndexMatch = filterName.match(/\d+/);

            if (!rulesetIndexMatch) {
                continue;
            }

            const rulesetIndex = rulesetIndexMatch[0];

            if (Array.isArray(options?.ids)
                && options.ids.length > 0
                && !options.ids.includes(rulesetIndex)) {
                continue;
            }

            const rulesetId = `${options?.rulesetPrefix ?? RulesetsInjector.DEFAULT_RULESET_PREFIX}${rulesetIndex}`;

            const isEnabled = Array.isArray(options?.enable)
                && options.enable.length > 0
                && options.enable.includes(rulesetIndex);

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
