// eslint-disable-next-line import/no-extraneous-dependencies
import assert from 'node:assert';

import { type ConfigurationMV2 } from '@adguard/tswebextension';

// TODO add more exports

// Using only part of the configuration to avoid the need to implement the entire ConfigurationMV2
type PartialConfigWithAllowlist = Pick<ConfigurationMV2, 'allowlist'>;
const config: PartialConfigWithAllowlist = { allowlist: ['google.com'] };
assert.ok(config);

// eslint-disable-next-line no-console
console.log('Smoke test for @adguard/tswebextension passed in root-exports.ts');
