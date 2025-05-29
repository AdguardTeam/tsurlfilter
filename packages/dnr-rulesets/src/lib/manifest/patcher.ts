import fastGlob from 'fast-glob';
import fs from 'fs';
import path from 'path';
import process from 'process';

import { type ApplyRulesetsOptions, RulesetsInjector, type RulesetsInjectorInterface } from './injector';
import { ManifestLoader, type ManifestLoaderInterface } from './loader';

export type PatchManifestOptions = ApplyRulesetsOptions & {
    /**
     * Match pattern to match filter files.
     *
     * @default `filter_+([0-9]).txt`
     */
    filtersMatch?: string;
};

/**
 * Api for patching manifest.
 */
export class ManifestPatcher {
    /**
     * Default glob patter to match filter files.
     */
    private static readonly DEFAULT_FILTERS_MATCH_GLOB = 'filter_+([0-9]).txt';

    /**
     * Create new instance of {@link ManifestPatcher}.
     *
     * @param loader {@link ManifestLoaderInterface}.
     * @param injector {@link RulesetsInjectorInterface}.
     */
    constructor(
        private loader: ManifestLoaderInterface = new ManifestLoader(),
        private injector: RulesetsInjectorInterface = new RulesetsInjector(),
    ) { }

    /**
     * Append rulesets into manifest `declarative_net_request` property.
     * If {@link options.forceUpdate} flag is enabled, overwrite rulesets with existing id, otherwise throw error.
     *
     * @param manifestPath Path to manifest file.
     * @param filtersPath Path to filters directory.
     * @param options Patch options {@link PatchManifestOptions}.
     *
     * @throws Error if manifest already contains ruleset with the specified ids
     * and {@link options.forceUpdate} is disabled or if manifest file or filters directory are not found.
     */
    public patch(
        manifestPath: string,
        filtersPath: string,
        options?: Partial<PatchManifestOptions>,
    ): void {
        const absoluteManifestPath = ManifestPatcher.getAbsolutePath(manifestPath);
        const absoluteFiltersPath = ManifestPatcher.getAbsolutePath(filtersPath);

        const manifest = this.loader.load(absoluteManifestPath);

        const manifestDirPath = path.dirname(absoluteManifestPath);

        const getPath = (rulesetId: string) => ManifestPatcher.getRelativeRulesetPath(
            absoluteFiltersPath,
            manifestDirPath,
            rulesetId,
        );

        const filtersMatchGlob = options?.filtersMatch ?? ManifestPatcher.DEFAULT_FILTERS_MATCH_GLOB;

        const filterNames = fastGlob.globSync(filtersMatchGlob, {
            onlyFiles: true,
            cwd: absoluteFiltersPath,
        });

        const patchedManifest = this.injector.applyRulesets(
            getPath,
            manifest,
            filterNames,
            options,
        );

        fs.writeFileSync(absoluteManifestPath, JSON.stringify(patchedManifest, null, 4));
    }

    /**
     * Get relative path for manifest ruleset config.
     *
     * @param filtersDirPath Absolute path to filters directory.
     * @param manifestDirPath Absolute path to manifest directory.
     * @param rulesetName Ruleset Name.
     *
     * @returns Relative path to specified ruleset config.
     */
    private static getRelativeRulesetPath(
        filtersDirPath: string,
        manifestDirPath: string,
        rulesetName: string,
    ) {
        return path.relative(
            manifestDirPath,
            `${filtersDirPath}/declarative/${rulesetName}/${rulesetName}.json`,
        );
    }

    /**
     * Gets absolute path for specified file.
     *
     * @param filePath Path to file.
     *
     * @returns Absolute path to file.
     *
     * @throws Error if file is not found.
     */
    private static getAbsolutePath(filePath: string) {
        const absoluteFilePath = !path.isAbsolute(filePath)
            ? path.resolve(process.cwd(), filePath)
            : filePath;

        if (!fs.existsSync(absoluteFilePath)) {
            throw new Error('File is not found!');
        }

        return absoluteFilePath;
    }
}
