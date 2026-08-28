#!/usr/bin/env node
/**
 * @file Injects temporary package versions into workspace manifests, in two
 * modes:
 *
 *   Release mode (--package <name> --version <ver>, used by the publish
 *   pipeline): stamps the selected package with the given release version and
 *   every other publishable package with the latest released version from its
 *   own CHANGELOG.md, so `workspace:^` dependencies resolve to real released
 *   semver at pack time.
 *
 * The repository root is resolved from the script's own location (scripts/),
 * not the process CWD, so the script works from any directory and can never
 * scan the wrong/empty packages/ folder.
 *
 * Usage: node scripts/inject-package-versions.mjs --package <name> --version <ver>
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// `[ \t\r]*$` tolerates trailing whitespace / CRLF line endings so a
// changelog heading never silently fails to match.
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?$/;
const RELEASE_HEADING_PATTERN = /^## \[(\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?)\](?:\s+-\s+\d{4}-\d{2}-\d{2})?[ \t\r]*$/m;

const args = process.argv.slice(2);

// Strict flag parsing: only --package/--version are accepted and every flag
// must carry a non-empty, non-flag operand. An unrecognized/typo'd flag or a
// flag with a missing value throws instead of silently switching to "inject
// every package from its changelog" mode — on the irreversible publish path
// that mode would stamp the wrong version.
const parsed = {};
for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (flag !== '--package' && flag !== '--version') {
        throw new Error(`Unknown argument '${flag}'. Supported flags: --package, --version`);
    }
    const value = args[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) {
        throw new Error(`Missing or invalid value for flag '${flag}'`);
    }
    parsed[flag] = value;
}

const releasePackage = parsed['--package'];
const releaseVersion = parsed['--version'];

if (Boolean(releasePackage) !== Boolean(releaseVersion)) {
    throw new Error('--package and --version must be provided together');
}

if (releaseVersion && !SEMVER_PATTERN.test(releaseVersion)) {
    throw new Error(`Invalid release version: ${releaseVersion}`);
}

// Resolve the monorepo root from the script's own location rather than the
// process CWD, so a future invocation from a non-root directory cannot
// silently scan the wrong/empty packages/ folder.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = path.join(repoRoot, 'packages');
if (!fs.existsSync(packagesDir)) {
    // Root comes from the script's own location here, so this failure means the
    // script itself was moved out of scripts/, not that the caller ran it from
    // the wrong directory.
    throw new Error(`Cannot find packages directory at ${packagesDir} - has scripts/inject-package-versions.mjs been moved out of scripts/?`);
}
const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(packagesDir, name, 'CHANGELOG.md')))
    .sort();

if (releasePackage && !packageDirs.includes(releasePackage)) {
    throw new Error(`Unknown publishable package: ${releasePackage}`);
}

for (const packageDir of packageDirs) {
    const packagePath = path.join(packagesDir, packageDir, 'package.json');
    const changelogPath = path.join(packagesDir, packageDir, 'CHANGELOG.md');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    const latestRelease = changelog.match(RELEASE_HEADING_PATTERN)?.[1];

    if (!latestRelease) {
        throw new Error(`No released version found in ${changelogPath}`);
    }

    // Non-release packages keep their changelog-derived version so `workspace:^`
    // dependencies resolve to a real released semver at pack time.
    const version = packageDir === releasePackage ? releaseVersion : latestRelease;

    packageJson.version = version;
    // Preserve the manifest's existing indentation. Naively matching the
    // '{\n  ' prefix also matches 4-space files and rewrites them with
    // 2-space indentation, polluting diffs. Tolerate CRLF line endings and
    // keep single-line/minified manifests single-line.
    const manifestSource = fs.readFileSync(packagePath, 'utf8');
    const indentMatch = manifestSource.match(/^{\r?\n([ \t]+)/);
    const indentation = indentMatch ? indentMatch[1] : manifestSource.includes('\n') ? '    ' : '';
    // Preserve the manifest's original line endings (CRLF vs LF) so a rewrite
    // never normalizes the whole file and pollutes the diff.
    const output = `${JSON.stringify(packageJson, null, indentation)}\n`;
    fs.writeFileSync(packagePath, manifestSource.includes('\r\n') ? output.replace(/\n/g, '\r\n') : output);
    console.log(`${packageJson.name}=${version}`);
}
