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
 *
 * Usage
 *
 * From root directory run:
 * `node scripts/increment.mjs <package-name>`
 */

import { execSync } from 'child_process';
import semver from 'semver';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const packageName = process.argv[2];

/**
 * Increments the version of the specified package.
 */
const increment = () => {
    if (!packageName) {
        console.error('Error: Package name is required');
        process.exit(1);
    }

    const packagePath = resolve(process.cwd(), 'packages', packageName);

    if (!existsSync(packagePath)) {
        console.error(`Error: Package directory not found: ${packagePath}`);
        process.exit(1);
    }

    const packageJsonPath = resolve(packagePath, 'package.json');

    if (!existsSync(packageJsonPath)) {
        console.error(`Error: package.json not found at ${packageJsonPath}`);
        process.exit(1);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const { version } = packageJson;

    console.log(`Package directory: ${packagePath}`);
    console.log(`Current version: ${version}`);

    const strategy = semver.prerelease(version) ? 'prerelease' : 'patch';

    execSync(`pnpm version ${strategy}`, { stdio: 'inherit', cwd: packagePath });
}

increment();
