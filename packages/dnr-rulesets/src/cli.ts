#!/usr/bin/env node
import { program } from 'commander';
import {
    loadAssets,
    patchManifest,
} from './lib';
import { version } from '../package.json';

program
    .name('dnr-rulesets CLI')
    .version(version);

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
    .option('-f, --force-update', 'force update rulesets with existing id', false)
    .option('-i, --ids <ids...>', 'filters ids to append', [])
    .action(patchManifest);

program.parse(process.argv);