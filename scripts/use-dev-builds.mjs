#!/usr/bin/env node
/**
 * @file Pins (or removes) tsurlfilter PR dev builds in a browser-extension
 * checkout, so the extension can be built and QA'd against unmerged
 * tsurlfilter work published by devex-bridge.yml to the internal Artifact
 * Keeper npm registry.
 *
 * Usage:
 *   node scripts/use-dev-builds.mjs --pr <N> --extension <path> [--registry <url>] [--head <short-sha>]
 *   node scripts/use-dev-builds.mjs --remove --extension <path>
 *
 * Pin mode resolves the six extension-consumed @adguard/* packages' dev
 * versions for this PR and upserts pnpm.overrides entries in the extension's
 * package.json pointing at the AK tarball URLs (dependencies stay untouched),
 * then refreshes pnpm-lock.yaml with a single `pnpm install`.
 *
 * Every push to the tsurlfilter PR republishes the six packages under a
 * HEAD-scoped version `<next-patch>-dev.pr<N>.<shortsha>` (AK versions are
 * immutable, so the short SHA gives every push a fresh, distinct version).
 * This lets the tool pin a COHERENT SET: it resolves builds carrying the exact
 * short SHA of the tsurlfilter checkout it is run from (or the --head
 * override), so all six overrides come from one committed source head. If the
 * set for that head is incomplete on AK (e.g. a publish leg failed), the tool
 * fails loudly instead of silently mixing builds from different heads.
 *
 * The short SHA comes from the tsurlfilter checkout the script lives in
 * (`git rev-parse --short=8 HEAD`); re-run after every push from an up-to-date
 * checkout, or pass --head explicitly. Without git context the tool falls back
 * to the newest `-dev.pr<N>` version per package and warns that the set may
 * span multiple heads.
 *
 * The six packages must be pinned as an indivisible set: if any bridged
 * package already has a non-dev override (a hand-written pin the developer did
 * not set up for dev builds), the pin FAILS with an explicit instruction
 * rather than silently mixing stable and PR-built packages.
 *
 * Requires pnpm on PATH (extension repo pins pnpm >=10.33.4 <11).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, '..');

// The bridged package set is read from scripts/ci/bridged-packages.json — the
// single machine-readable source, checked against the workflow copies by
// scripts/ci/check-package-lists.mjs.
const BRIDGED_PACKAGES = JSON.parse(
    fs.readFileSync(path.join(scriptRoot, 'ci', 'bridged-packages.json'), 'utf8'),
);
const DEFAULT_REGISTRY = 'https://ak.int.agrd.dev/npm/npm-internal';
const DEV_MARK = '-dev.pr';

const fail = (message) => {
    console.error(`error: ${message}`);
    process.exit(1);
};

const args = process.argv.slice(2);

// A typo'd flag (e.g. `--remov` instead of `--remove`) must fail loudly rather
// than silently fall through to a full pin — the opposite of what was asked.
const KNOWN_FLAGS = new Set(['--remove', '--pr', '--extension', '--registry', '--head']);
for (const arg of args) {
    if (arg.startsWith('--') && !KNOWN_FLAGS.has(arg)) {
        fail(`unknown argument '${arg}' — supported: ${[...KNOWN_FLAGS].join(', ')}`);
    }
}

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
if (removeMode && args.includes('--head')) {
    fail('--remove does not take --head');
}
const extensionDir = readArg('--extension');
const pr = removeMode ? null : readArg('--pr');
if (!removeMode && !/^\d+$/.test(pr)) {
    fail(`--pr must be a pull request number, got '${pr}'`);
}
const registry = args.includes('--registry') ? readArg('--registry') : DEFAULT_REGISTRY;
const requestedHead = removeMode ? null : (args.includes('--head') ? readArg('--head') : null);

const packageJsonPath = path.join(extensionDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
    fail(`${packageJsonPath} does not exist — --extension must point at a browser-extension checkout`);
}

const readManifest = () => {
    const source = fs.readFileSync(packageJsonPath, 'utf8');
    // Tolerate CRLF manifests (the shared set-dev-version action uses the same
    // /^{\r?\n(...)/ probe when preserving indentation).
    const indentMatch = source.match(/^{\r?\n([ \t]+)/);
    let manifest;
    try {
        manifest = JSON.parse(source);
    } catch (error) {
        fail(`${packageJsonPath} is not valid JSON: ${error.message}`);
    }
    return {
        manifest,
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
    try {
        execFileSync('pnpm', ['install', '--no-frozen-lockfile', '--ignore-scripts'], {
            cwd: extensionDir,
            stdio: 'inherit',
        });
    } catch (error) {
        // A failing pnpm install (network, lockfile conflict, registry auth)
        // must produce a clear message, not an opaque execFileSync stack.
        fail(`pnpm install failed in ${extensionDir} — see the pnpm output above (${error.message})`);
    }
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
// left several -dev.pr<N>.<sha> versions for the same PR behind.
const compareNumericCore = (a, b) => {
    const core = (version) => version.split('-dev.pr')[0].split('.').map((n) => Number(n));
    const ca = core(a);
    const cb = core(b);
    for (let i = 0; i < 3; i += 1) {
        if (ca[i] !== cb[i]) {
            return ca[i] - cb[i];
        }
    }
    return 0;
};

// headShortSha — the 8-char abbreviated SHA of the source head whose builds we
// pin. Tries the explicit --head override, then the tsurlfilter checkout the
// script lives in; returns null when neither is available (falls back to a
// non-head-scoped resolution). DEV_BUILDS_FORCE_NO_HEAD is a test hook that
// emulates "no git context".
const headShortSha = (requested) => {
    if (process.env.DEV_BUILDS_FORCE_NO_HEAD === '1') {
        return null;
    }
    if (requested) {
        if (!/^[0-9a-f]{4,64}$/i.test(requested)) {
            fail(`--head must be a git SHA (hex), got '${requested}'`);
        }
        return requested.toLowerCase().slice(0, 8);
    }
    try {
        const out = execFileSync('git', ['-C', repoRoot, 'rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
        if (/^[0-9a-f]{4,64}$/i.test(out)) {
            return out.toLowerCase().slice(0, 8);
        }
    } catch {
        /* not a git checkout — fall through to non-head-scoped resolution */
    }
    return null;
};

// isPrVersion — does this version belong to PR N's dev line? Matches the exact
// `-dev.pr<N>` tag as well as all `-dev.pr<N>.<...>` (e.g. head-scoped) builds,
// and never crosses into `-dev.pr<N+…>` (a bare substring match on 'pr' alone
// could not tell -dev.pr1 from -dev.pr12).
const isPrVersion = (version, prNumber) => {
    return typeof version === 'string' && new RegExp(`-dev\\.pr${prNumber}(\\.|$)`).test(version);
};

const pickAndTarball = (name, candidates, exactSuffix) => {
    const pick = candidates.slice().sort(compareNumericCore).pop();
    const url = npmView(`${name}@${pick}`, 'dist.tarball');
    if (!url) {
        fail(`${name}@${pick}: registry returned no dist.tarball URL (run 'npm view ${name}@${pick} dist.tarball --registry=${registry}' to debug)`);
    }
    return { version: pick, url };
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

// Pin mode: resolve each package's dev version for this PR, preferring a set
// of builds stamped from ONE source head so the six overrides stay coherent.
const suffix = `${DEV_MARK}${pr}`;          // '-dev.pr42'
const sha = headShortSha(requestedHead);    // '2f5d9548' or null
const exactSuffix = sha ? `${suffix}.${sha}` : null;
if (sha && requestedHead) {
    console.log(`Pinning the coherent set for head ${sha} (PR #${pr}).`);
} else if (sha) {
    console.log(`Pinning the coherent set for checkout head ${sha} (PR #${pr}).`);
}

const versionsByPackage = {};
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
    versionsByPackage[name] = versions;

    if (sha) {
        // Head-scoped: only versions stamped from THIS head qualify. A
        // partially published / cancelled matrix leaves the set incomplete for
        // the head, so this fails loudly instead of pinning a mixed set.
        const exact = versions.filter((v) => typeof v === 'string' && v.endsWith(exactSuffix));
        if (exact.length === 0) {
            fail(
                `${name}: no version ending '${exactSuffix}' found on ${registry}.`
                + ` The bridge has not published this head yet (or a publish leg failed).`
                + ` Re-run from an up-to-date checkout of the PR branch, or pass --head <short-sha>`
                + ` matching the 'Dev builds published' review on PR #${pr}.`,
            );
        }
        const { version, url } = pickAndTarball(name, exact, exactSuffix);
        urls[name] = url;
        if (version !== exact[exact.length - 1]) {
            console.warn(`${name}: multiple ${exactSuffix} builds exist; pinning newest (${version})`);
        }
    } else {
        // No git context: fall back to the newest -dev.pr<N> version. The set
        // may span several heads — warn rather than pretend otherwise.
        const matches = versions.filter((v) => isPrVersion(v, pr));
        if (matches.length === 0) {
            fail(
                `${name}: no version ending '${suffix}' found — has devex-bridge.yml finished for PR #${pr},`
                + ' or was it cleaned up? Run from the PR checkout or pass --head for the coherent set.',
            );
        }
        console.warn(
            `${name}: no git context (pass --head or run from the PR checkout) — pinned the newest ${suffix} version;`
            + ' the set may span multiple heads.',
        );
        const { url } = pickAndTarball(name, matches, null);
        urls[name] = url;
    }
}

// Indivisible-set preflight: the six bridged packages must be pinned as a
// whole. If any of them already carries a non-dev override, fail BEFORE
// touching the manifest so the developer is not left with a mixed stable/PR
// combination that the final summary would then misreport as "all pinned".
const { manifest, indentation, crlf } = readManifest();
const overrides = manifest.pnpm?.overrides ?? {};
const conflicts = BRIDGED_PACKAGES
    .map((dir) => `@adguard/${dir}`)
    .filter((name) => overrides[name] !== undefined && !(typeof overrides[name] === 'string' && overrides[name].includes(DEV_MARK)))
    .map((name) => `${name}=${JSON.stringify(overrides[name])}`);
if (conflicts.length > 0) {
    fail(
        `cannot pin: ${conflicts.length} bridged override(s) are not dev pins — the set must be pinned as a whole:\n`
        + `  ${conflicts.join('\n  ')}\n`
        + 'Move these aside (or delete them) in the extension package.json, then re-run.'
        + " (--remove only strips dev pins, so it won't drop a manual override.)",
    );
}

manifest.pnpm = manifest.pnpm ?? {};
manifest.pnpm.overrides = manifest.pnpm.overrides ?? {};
for (const [name, url] of Object.entries(urls)) {
    manifest.pnpm.overrides[name] = url;
}
writeManifest(manifest, indentation, crlf);
// A single install is enough: every push carries a fresh head-scoped tarball
// URL, so refreshing the overrides (rather than strip-then-reinstall) is
// sufficient to record the new integrity in pnpm-lock.yaml.
pnpmInstall();

console.log(`\nPinned ${Object.keys(urls).length} dev builds for PR #${pr}${sha ? ` (head ${sha})` : ''}:`);
for (const [name, url] of Object.entries(urls)) {
    console.log(`  ${name} -> ${url.split('/').pop()}`);
}
console.log('\nCommit package.json and pnpm-lock.yaml. Re-run this command after every push to the tsurlfilter PR.');
