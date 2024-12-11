// eslint-disable-next-line import/no-extraneous-dependencies
import { type ConfigurationMV2 } from '@adguard/tswebextension';
import assert from 'node:assert';

// TODO add more exports

// Using only part of the configuration to avoid the need to implement the entire ConfigurationMV2
type PartialConfigWithAllowlist = Pick<ConfigurationMV2, 'allowlist'>;
const config: PartialConfigWithAllowlist = { allowlist: ['google.com'] };
assert.ok(config);

console.log('Smoke test for @adguard/tswebextension passed in root-exports.ts');
