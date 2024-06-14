#!/usr/bin/env node
import { Logger } from '@adguard/logger';
import { program } from 'commander';
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

async function loadAssets(dest: string): Promise<void> {
    const to = path.resolve(process.cwd(), dest);
    const src = path.resolve(__dirname, './filters');

    try {
        await copy(src, to);
        logger.info(`assets was copied to ${dest}`);
    } catch (e) {
        logger.error(e);
    }
}

async function patchManifest(
    manifestPath: string,
    filtersPath: string,
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

        const rulesetId = `ruleset_${rulesetIndex}`;

        if(ruleResources.some(({ id }) => id === rulesetId)) {
            throw new Error(`Duplicate ruleset ID: ${rulesetId}`);
        }

        const filterPath = path.relative(
            manifestDirPath,
            `${filtersPath}/declarative/${rulesetId}/${rulesetId}.json`,
        );
    
        ruleResources.push({
            id: rulesetId,
            enabled: false,
            path: filterPath,
        });
    }

    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 4));
}

async function main(): Promise<void> {
    program
        .name('dnr-rulesets CLI')
        .version('0.0.1');

    program
        .command('load')
        .description('Downloads rule sets for MV3 extension')
        .argument('[path-to-output]', 'rule sets download path')
        .action(loadAssets);

    program
        .command('manifest')
        .description('Patch MV3 manifest file')
        .argument('[path-to-manifest]', 'manifest src path')
        .argument('[path-to-filters]', 'filters src path')
        .action(patchManifest);

    await program.parseAsync(process.argv);
}

main();