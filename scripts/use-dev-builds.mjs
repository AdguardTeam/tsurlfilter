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
    const value = args[index + 1];
    if (value.startsWith('-')) {
        fail(`argument ${name} expects a value, got flag-like value '${value}' — put it before the positional values?`);
    }
    return value;
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
    // Tolerate CRLF manifests (the shared set-dev-version action uses the same
    // /^{\r?\n(...)/ probe when preserving indentation).
    const indentMatch = source.match(/^{\r?\n([ \t]+)/);
    return {
        manifest: JSON.parse(source),
        indentation: indentMatch ? indentMatch[1] : '  ',
        crlf: source.includes('\r\n'),
    };
};

const writeManifest = (manifest, indentation, crlf) => {
    // Preserve the manifest's original line endings (CRLF vs LF) so a rewrite
    // never normalizes the whole file and pollutes the diff.
    const content = `${JSON.stringify(manifest, null, indentation)}\n`;
    fs.writeFileSync(packageJsonPath, crlf ? content.replace(/\n/g, '\r\n') : content);
};

const bridgedOverrides = (manifest) => {
    const overrides = manifest.pnpm?.overrides ?? {};
    return BRIDGED_PACKAGES.filter((dir) => {
        const url = overrides[`@adguard/${dir}`];
        return typeof url === 'string' && url.includes(DEV_MARK);
    });
};

const stripDevPins = () => {
    const { manifest, indentation, crlf } = readManifest();
    const present = bridgedOverrides(manifest);
    if (present.length === 0) {
        return false;
    }
    for (const dir of present) {
        delete manifest.pnpm.overrides[`@adguard/${dir}`];
    }
    writeManifest(manifest, indentation, crlf);
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
    try {
        return execFileSync('npm', viewArgs, { encoding: 'utf8' }).trim();
    } catch (error) {
        // A failed registry round-trip (auth, network, E404) must produce a
        // curated, actionable message — never a raw Node stack trace.
        const detail = (error.stderr?.toString?.() || error.stdout?.toString?.() || error.message || '').trim();
        fail(
            `npm view ${spec}${field ? ` ${field}` : ' versions'} failed`
            + ` (registry ${registry}): ${detail || String(error)}`,
        );
    }
};

// compareNumericCore — semver-ish comparator over the X.Y.Z core that precedes
// the -dev.pr suffix; all candidates share the same suffix, so the core alone
// orders them. Used to pick the newest dev version when a mid-PR release bump
// left several -dev.pr<N> versions behind.
const compareNumericCore = (a, b) => {
    const core = (version) => version.split('-dev.')[0].split('.').map((n) => Number(n));
    const ca = core(a);
    const cb = core(b);
    for (let i = 0; i < 3; i += 1) {
        if (ca[i] !== cb[i]) {
            return ca[i] - cb[i];
        }
    }
    return 0;
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
    const raw = npmView(name);
    let versions;
    try {
        const parsed = JSON.parse(raw || '[]');
        versions = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        fail(
            `${name}: npm view returned unexpected output (expected a JSON array of versions), got:`
            + ` ${JSON.stringify(raw)} — check the registry URL ${registry}`,
        );
    }
    const matches = versions.filter((v) => typeof v === 'string' && v.endsWith(suffix));
    if (matches.length === 0) {
        fail(
            `${name}: no version ending '${suffix}' found — has devex-bridge.yml finished for PR #${pr}, or was it cleaned up?`,
        );
    }
    // A mid-PR release bump can legitimately leave several -dev.pr<N> versions
    // behind after the bridge's suffix-scan unpublish races a republish; pin
    // the newest core rather than failing on ambiguity.
    const pick = matches.slice().sort(compareNumericCore).pop();
    urls[name] = npmView(`${name}@${pick}`, 'dist.tarball');
    if (!urls[name]) {
        fail(`${name}@${pick}: registry returned no dist.tarball URL (run 'npm view ${name}@${pick} dist.tarball --registry=${registry}' to debug)`);
    }
}

// Two-phase refresh when dev pins already exist: strip + install drops the
// lockfile's stale tarball integrity (the AK tarball was overwritten in
// place), then re-pin + install records the fresh one.
const refresh = stripDevPins();
if (refresh) {
    pnpmInstall();
}
const { manifest, indentation, crlf } = readManifest();
manifest.pnpm = manifest.pnpm ?? {};
manifest.pnpm.overrides = manifest.pnpm.overrides ?? {};
for (const [name, url] of Object.entries(urls)) {
    // Never silently clobber a hand-written override the developer did not set
    // up for dev builds (e.g. a deliberate @adguard/tsurlfilter: '6.0.2'). Only
    // existing dev pins (URLs containing -dev.pr) and absent entries are taken
    // over.
    const existing = manifest.pnpm.overrides[name];
    const isDevPin = typeof existing === 'string' && existing.includes(DEV_MARK);
    if (existing !== undefined && !isDevPin) {
        console.warn(
            `warning: keeping existing manual override ${name}=${JSON.stringify(existing)} `
            + '(it is not a dev pin; re-run with --remove to drop it before pinning)',
        );
        continue;
    }
    manifest.pnpm.overrides[name] = url;
}
writeManifest(manifest, indentation, crlf);
pnpmInstall();

console.log(`\nPinned ${Object.keys(urls).length} dev builds for PR #${pr}:`);
for (const [name, url] of Object.entries(urls)) {
    console.log(`  ${name} -> ${url.split('/').pop()}`);
}
console.log('\nCommit package.json and pnpm-lock.yaml. Re-run this command after every push to the tsurlfilter PR.');
