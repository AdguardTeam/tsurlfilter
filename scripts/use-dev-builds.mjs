#!/usr/bin/env node
/**
 * @file Pins (or removes) tsurlfilter PR dev builds in a browser-extension
 * checkout, so the extension can be built and QA'd against unmerged
 * tsurlfilter work published by devex-bridge.yml to the internal Artifact
 * Keeper npm registry.
 *
 * Usage:
 *   node scripts/use-dev-builds.mjs --pr <N> --extension <path> [--registry <url>]
 *   node scripts/use-dev-builds.mjs --remove --extension <path>
 *
 * Pin mode resolves the six extension-consumed @adguard/* packages' dev
 * versions (`<next-patch>-dev.pr<N>`) from the registry, upserts
 * pnpm.overrides entries in the extension's package.json pointing at the AK
 * tarball URLs (dependencies stay untouched), and refreshes pnpm-lock.yaml.
 * Re-pinning after the dev builds were overwritten takes a two-phase path
 * (strip overrides -> install -> re-pin -> install) so the lockfile's stale
 * tarball integrity is dropped. --remove strips the dev pins and restores
 * registry resolutions.
 *
 * Requires pnpm on PATH (extension repo pins pnpm >=10.33.4 <11).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

// Deliberate second copy of devex-bridge.yml's BRIDGED_PACKAGES env — kept in
// agreement (and a subset of publishable packages) by
// scripts/ci/check-package-lists.mjs.
const BRIDGED_PACKAGES = 'logger css-tokenizer agtree tsurlfilter dnr-rulesets tswebextension'.split(' ');
const DEFAULT_REGISTRY = 'https://ak.int.agrd.dev/npm/npm-internal';
const DEV_MARK = '-dev.pr';

const fail = (message) => {
    console.error(`error: ${message}`);
    process.exit(1);
};

const args = process.argv.slice(2);
const readArg = (name) => {
    const index = args.indexOf(name);
    if (index === -1 || index + 1 >= args.length) {
        fail(`missing required argument ${name} <value>`);
    }
    return args[index + 1];
};

const removeMode = args.includes('--remove');
if (removeMode && args.includes('--pr')) {
    fail('--remove does not take --pr');
}
const extensionDir = readArg('--extension');
const pr = removeMode ? null : readArg('--pr');
if (!removeMode && !/^\d+$/.test(pr)) {
    fail(`--pr must be a pull request number, got '${pr}'`);
}
const registry = args.includes('--registry') ? readArg('--registry') : DEFAULT_REGISTRY;

const packageJsonPath = path.join(extensionDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
    fail(`${packageJsonPath} does not exist — --extension must point at a browser-extension checkout`);
}

const readManifest = () => {
    const source = fs.readFileSync(packageJsonPath, 'utf8');
    const indentMatch = source.match(/^{\n([ \t]+)/);
    return { manifest: JSON.parse(source), indentation: indentMatch ? indentMatch[1] : '  ' };
};

const writeManifest = (manifest, indentation) => {
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, indentation)}\n`);
};

const bridgedOverrides = (manifest) => {
    const overrides = manifest.pnpm?.overrides ?? {};
    return BRIDGED_PACKAGES.filter((dir) => {
        const url = overrides[`@adguard/${dir}`];
        return typeof url === 'string' && url.includes(DEV_MARK);
    });
};

const stripDevPins = () => {
    const { manifest, indentation } = readManifest();
    const present = bridgedOverrides(manifest);
    if (present.length === 0) {
        return false;
    }
    for (const dir of present) {
        delete manifest.pnpm.overrides[`@adguard/${dir}`];
    }
    writeManifest(manifest, indentation);
    return true;
};

const pnpmInstall = () => {
    console.log('> pnpm install --no-frozen-lockfile --ignore-scripts');
    // --no-frozen-lockfile: package.json just changed and the lockfile must be
    // regenerated (pnpm defaults to frozen when a lockfile exists).
    execFileSync('pnpm', ['install', '--no-frozen-lockfile', '--ignore-scripts'], {
        cwd: extensionDir,
        stdio: 'inherit',
    });
};

const npmView = (spec, field) => {
    const viewArgs = field
        ? ['view', `${spec}`, field, `--registry=${registry}`, '--silent']
        : ['view', `${spec}`, 'versions', '--json', `--registry=${registry}`, '--silent'];
    return execFileSync('npm', viewArgs, { encoding: 'utf8' }).trim();
};

if (removeMode) {
    if (stripDevPins()) {
        pnpmInstall();
        console.log('Dev pins removed and lockfile restored to registry versions.');
    } else {
        console.log('No dev pins present — nothing to do.');
    }
    process.exit(0);
}

// Pin mode: resolve each package's dev version for this PR.
const suffix = `${DEV_MARK}${pr}`;
const urls = {};
for (const dir of BRIDGED_PACKAGES) {
    const name = `@adguard/${dir}`;
    const raw = JSON.parse(npmView(name) || '[]');
    const versions = Array.isArray(raw) ? raw : [raw];
    const matches = versions.filter((v) => v.endsWith(suffix));
    if (matches.length !== 1) {
        fail(
            `${name}: expected exactly one version ending '${suffix}', found ${matches.length}`
            + ` — has devex-bridge.yml finished for PR #${pr}, or was it cleaned up?`,
        );
    }
    urls[name] = npmView(`${name}@${matches[0]}`, 'dist.tarball');
    if (!urls[name]) {
        fail(`${name}@${matches[0]}: registry returned no dist.tarball URL`);
    }
}

// Two-phase refresh when dev pins already exist: strip + install drops the
// lockfile's stale tarball integrity (the AK tarball was overwritten in
// place), then re-pin + install records the fresh one.
const refresh = stripDevPins();
if (refresh) {
    pnpmInstall();
}
const { manifest, indentation } = readManifest();
manifest.pnpm = manifest.pnpm ?? {};
manifest.pnpm.overrides = manifest.pnpm.overrides ?? {};
for (const [name, url] of Object.entries(urls)) {
    manifest.pnpm.overrides[name] = url;
}
writeManifest(manifest, indentation);
pnpmInstall();

console.log(`\nPinned ${Object.keys(urls).length} dev builds for PR #${pr}:`);
for (const [name, url] of Object.entries(urls)) {
    console.log(`  ${name} -> ${url.split('/').pop()}`);
}
console.log('\nCommit package.json and pnpm-lock.yaml. Re-run this command after every push to the tsurlfilter PR.');
