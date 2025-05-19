/**
 * @file
 *
 * Increments the version based on its format:
 * - For regular versions (x.y.z) — increments the patch version
 * - For prerelease versions (x.y.z-alpha.n or x.y.z-beta.n) — increments only the last number.
 *
 * @example
 * `3.0.0-alpha.4` → `3.0.0-alpha.5`
 * `3.0.0` → `3.0.1`
 */

import { execSync } from 'child_process';
import semver from 'semver';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const packageJsonPath = resolve(process.cwd(), 'package.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const { version } = packageJson;

console.log(`Working directory: ${process.cwd()}`);
console.log(`Current version: ${version}`);

const strategy = semver.prerelease(version) ? 'prerelease' : 'patch';

execSync(`pnpm version ${strategy}`, { stdio: 'inherit' });
