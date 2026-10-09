/**
 * @file AGTree version.
 */

import packageJson from '../package.json';

/**
 * Version of the `@adguard/agtree` package.
 *
 * The committed manifest is versionless: CI injects the release version before
 * building (`scripts/inject-package-versions.mjs`). Local builds that skip the
 * injection fall back to a dev placeholder so `pnpm build` and tests work out
 * of the box; published artifacts always carry the injected version.
 *
 * Annotated as `string` (not inferred from `packageJson.version`) because the
 * versionless manifest makes TypeScript narrow `packageJson.version` to
 * `never`, which would leak an unstable `never` type into the public API.
 */
const AGTREE_VERSION: string = 'version' in packageJson
    && typeof packageJson.version === 'string'
    && packageJson.version.length > 0
    ? packageJson.version
    : '0.0.0-dev';

export { AGTREE_VERSION };
