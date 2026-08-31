#!/usr/bin/env node
/**
 * @file Drift guard for the many places the publishable package list is
 * duplicated. The source of truth is the filesystem: a directory under
 * packages/ with a CHANGELOG.md is a publishable package. Every other place
 * that lists packages (Dockerfile COPY stanzas, CI targets, dispatch choice
 * options) must agree, or adding/removing a package currently loses coverage
 * silently.
 *
 * Not a parser — targeted regexes tied to the current formatting. Cheap and
 * good enough to catch an added package before it ships untested.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const fail = (message) => {
    console.error(`::error::${message}`);
    process.exit(1);
};

// Source of truth: packages/*/CHANGELOG.md.
const publishable = fs.readdirSync(path.join(repoRoot, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(repoRoot, 'packages', name, 'CHANGELOG.md')))
    .sort();

const assertSameSet = (label, actual) => {
    const sorted = [...new Set(actual)].sort();
    if (JSON.stringify(sorted) !== JSON.stringify(publishable)) {
        fail(`${label} list drifted from packages/*/CHANGELOG.md.\n  filesystem: ${publishable.join(', ')}\n  ${label}: ${sorted.join(', ')}`);
    }
    console.log(`${label}: OK (${sorted.length} packages)`);
};

// 1. Dockerfile must COPY every publishable package's package.json into the
//    workspace install (deps stage).
const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
const dockerfilePackages = [...dockerfile.matchAll(/^COPY packages\/([^/]+)\/package\.json \.\/packages\/\1\//gm)]
    .map((m) => m[1]);
assertSameSet('Dockerfile package.json COPY', dockerfilePackages);

// 2. compute-affected-packages.mjs targets must cover every publishable
//    package. Compare the `target` field (the package directory name); the
//    `examples` target has npm: null and is skipped here.
const affectedScript = fs.readFileSync(path.join(repoRoot, 'scripts/ci/compute-affected-packages.mjs'), 'utf8');
const affectedTargets = [...affectedScript.matchAll(/\{\s*target:\s*'([a-z0-9-]+)',\s*npm:\s*'@adguard\/[a-z0-9-]+'\s*\}/g)]
    .map((m) => m[1]);
assertSameSet('compute-affected-packages targets', affectedTargets);

// 3. prepare-release.yml / publish-release.yml workflow_dispatch `choice`
//    options must match. Both files are formatted identically with 10-space
//    option indentation.
for (const file of ['.github/workflows/prepare-release.yml', '.github/workflows/publish-release.yml']) {
    const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    const options = [...text.matchAll(/^ {10}- ([a-z0-9-]+)$/gm)].map((m) => m[1]);
    if (options.length === 0) {
        fail(`${file}: could not find any dispatch choice options (format changed?)`);
    }
    assertSameSet(`${file} choice options`, options);
}

// 4. The release Allowlist in the guarded allowlists of the prepare/publish
//    engines must match too. The dispatch `choice` checks above do NOT cover
//    them — those allowlist copies (resolve-release-inputs.sh and
//    _prepare-release-monorepo.yml) are the ones that actually reject unknown
//    packages at prepare/publish time. Without this check, adding a package
//    would pass the guard green and then be rejected at release time.
//    Both files assign the allowlist as ALLOWLIST="a b c ..." on one line.
const allowlistRegex = /ALLOWLIST="([a-z0-9- ]+)"/g;
for (const file of ['scripts/ci/resolve-release-inputs.sh', '.github/workflows/_prepare-release-monorepo.yml']) {
    const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    const matches = [...text.matchAll(allowlistRegex)];
    if (matches.length !== 1) {
        fail(`${file}: expected exactly one ALLOWLIST="..." assignment (format changed?)`);
    }
    assertSameSet(`${file} ALLOWLIST`, matches[0][1].split(' ').filter(Boolean));
}

// 4a. The DevEx bridge package list has two deliberate copies — the
//    BRIDGED_PACKAGES env in devex-bridge.yml and the BRIDGED_PACKAGES
//    constant in scripts/use-dev-builds.mjs. They must agree, and both must be
//    a SUBSET of the publishable packages (the six the browser extension
//    consumes), so this checks membership, not equality with `publishable`.
const bridgeWorkflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/devex-bridge.yml'), 'utf8');
const bridgeMatch = bridgeWorkflow.match(/BRIDGED_PACKAGES:\s*'([a-z0-9- ]+)'/);
if (!bridgeMatch) {
    fail('devex-bridge.yml: could not find the BRIDGED_PACKAGES: \'...\' env assignment (format changed?)');
}
const devBuildsScript = fs.readFileSync(path.join(repoRoot, 'scripts/use-dev-builds.mjs'), 'utf8');
const devBuildsMatch = devBuildsScript.match(/BRIDGED_PACKAGES = '([a-z0-9- ]+)'\.split\(' '\)/);
if (!devBuildsMatch) {
    fail('scripts/use-dev-builds.mjs: could not find the BRIDGED_PACKAGES constant (format changed?)');
}
const bridgeWorkflowPackages = bridgeMatch[1].split(' ').filter(Boolean).sort();
const devBuildsPackages = devBuildsMatch[1].split(' ').filter(Boolean).sort();
if (JSON.stringify(bridgeWorkflowPackages) !== JSON.stringify(devBuildsPackages)) {
    fail(`Bridge package lists disagree.\n  devex-bridge.yml: ${bridgeWorkflowPackages.join(', ')}\n  use-dev-builds.mjs: ${devBuildsPackages.join(', ')}`);
}
const unknown = bridgeWorkflowPackages.filter((name) => !publishable.includes(name));
if (unknown.length > 0) {
    fail(`Bridge package lists contain non-publishable packages: ${unknown.join(', ')}`);
}
console.log(`bridge package lists: OK (${bridgeWorkflowPackages.length} packages, workflow/tool agree, subset of publishable)`);

console.log('package list drift check passed');

// 5. The supported stable DNR ruleset lines have a single source of truth — the
//    ALL_LINES="..." assignment in publish-stable-dnr-rulesets.yml — and every
//    other place that enumerates them must agree (the workflow's own header
//    comment, DEPLOYMENT.md, AGENTS.md). Without this, adding/dropping a line
//    (e.g. a new 5.1 branch) silently leaves a stale second copy and the new
//    line is either skipped forever or the docs lie about what's published.
const stableWorkflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/publish-stable-dnr-rulesets.yml'), 'utf8');
const lineVarMatch = stableWorkflow.match(/ALL_LINES="([0-9. ]+)"/);
if (!lineVarMatch || lineVarMatch[1].trim() === '') {
    fail('publish-stable-dnr-rulesets.yml: could not find the ALL_LINES="..." assignment (format changed?)');
}
const stableLines = lineVarMatch[1].split(' ').filter(Boolean);

const assertStableLines = (label, actual) => {
    const sortedActual = [...new Set(actual)].sort();
    const sortedExpected = [...stableLines].sort();
    if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
        fail(`${label} stable-lines list drifted from publish-stable-dnr-rulesets.yml ALL_LINES.\n  workflow: ${stableLines.join(', ')}\n  ${label}: ${sortedActual.join(', ')}`);
    }
    console.log(`${label}: OK (${sortedActual.length} lines)`);
};

// 5a. The workflow's header comment enumerates the lines as "(3.3, 4.0, ...)".
const headerMatch = stableWorkflow.match(/^# supported stable\/dnr-rulesets-\* branches \(([0-9., ]+)\)/m);
if (headerMatch) {
    assertStableLines('publish-stable-dnr-rulesets.yml header comment', headerMatch[1].split(',').map((s) => s.trim()).filter(Boolean));
}

// 5b. DEPLOYMENT.md enumerates the same lines in its publish-stable bullet.
const deployment = fs.readFileSync(path.join(repoRoot, 'DEPLOYMENT.md'), 'utf8');
const deploymentLines = [...deployment.matchAll(/stable\/dnr-rulesets-([0-9]+\.[0-9]+)/g)].map((m) => m[1]);
if (deploymentLines.length > 0) {
    assertStableLines('DEPLOYMENT.md', deploymentLines);
}

// 5c. AGENTS.md enumerates the same lines in the workflow inventory.
const agents = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
const agentsLines = [...agents.matchAll(/stable\/dnr-rulesets-([0-9]+\.[0-9]+)/g)].map((m) => m[1]);
if (agentsLines.length > 0) {
    assertStableLines('AGENTS.md', agentsLines);
}

console.log('stable-lines drift check passed');
