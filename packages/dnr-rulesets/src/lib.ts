import { Logger } from '@adguard/logger';
import path from 'path';
import fs from 'fs';
import { copy } from 'fs-extra';

type Manifest = {
    declarative_net_request?: {
        rule_resources?: Array<{
            id: string,
            enabled: boolean,
            path: string,
        }>,
    },
};

const logger = new Logger(console);

/**
 * Download filters to {@link dest} path.
 * @param dest Path to download filters.
 */
export async function loadAssets(dest: string): Promise<void> {
    const to = path.resolve(process.cwd(), dest);
    const src = path.resolve(__dirname, './filters');

    try {
        await copy(src, to);
        logger.info(`assets was copied to ${dest}`);
    } catch (e) {
        logger.error(e);
    }
}

type PatchManifestOptions = {
    ids: string[],
    forceUpdate: boolean,
};

/**
 * Append rulesets into manifest `declarative_net_request` property.
 * If {@link forceUpdate} flag is enabled, overwrite rulesets with existing id, otherwise throw error.
 * 
 * @param manifestPath Path to manifest file.
 * @param filtersPath Path to filters directory.
 * @param options Patch options.
 * @param options.ids Array of filters ids to append. If empty, all filters will be appended.
 * @param options.forceUpdate Flag determines whether to overwrite rulesets with existing id.
 * 
 * @throws Error if manifest already contains ruleset with the specified ids
 * and {@link options.forceUpdate} is disabled or if manifest file or filters directory are not found.
 */
export async function patchManifest(
    manifestPath: string,
    filtersPath: string,
    options?: Partial<PatchManifestOptions>,
): Promise<void> {
    if (!path.isAbsolute(manifestPath)) {
        manifestPath = path.resolve(process.cwd(), manifestPath);
    }

    if (!path.isAbsolute(filtersPath)) {
        filtersPath = path.resolve(process.cwd(), filtersPath);
    }

    if (!fs.existsSync(manifestPath)) {
        throw new Error('Manifest is not found!');
    }

    if (!fs.existsSync(filtersPath)) {
        throw new Error('Filters are not found!');
    }

    const manifestData = await fs.promises.readFile(manifestPath, { encoding: 'utf-8' });

    const manifest = JSON.parse(manifestData) as Manifest;

    if (!manifest.declarative_net_request) {
        manifest.declarative_net_request = {};
    }

    if (!manifest.declarative_net_request.rule_resources) {
        manifest.declarative_net_request.rule_resources = [];
    }


    const filterNames = fs.readdirSync(filtersPath);
    const ruleResources = manifest.declarative_net_request.rule_resources;


    const manifestDirPath = manifestPath.substring(0, manifestPath.lastIndexOf('/'));

    for (const filterName of filterNames) {
        const rulesetIndex = filterName.match(/\d+/);

        if (!(rulesetIndex && rulesetIndex[0])) {
            continue;
        }

        if (Array.isArray(options?.ids)
            && options.ids.length > 0
            && !options.ids.includes(rulesetIndex[0])) {
            continue;
        }

        const rulesetId = `ruleset_${rulesetIndex}`;

        const ruleset = {
            id: rulesetId,
            enabled: false,
            path: path.relative(
                manifestDirPath,
                `${filtersPath}/declarative/${rulesetId}/${rulesetId}.json`,
            ),
        };

        let existingRuleset = ruleResources.find(({ id }) => id === rulesetId);

        if(existingRuleset) {
            if(options?.forceUpdate) {
                existingRuleset = ruleset;
            } else {
                throw new Error(`Duplicate ruleset ID: ${rulesetId}`);
            }
        } else {
            ruleResources.push(ruleset);
        }
    }

    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 4));
}