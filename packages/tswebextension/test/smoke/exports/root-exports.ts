import assert from 'node:assert';

// eslint-disable-next-line import/no-extraneous-dependencies
import { type ConfigurationMV2, type ProtectionPolicyArtifact } from '@adguard/tswebextension';

// TODO: add more exports

// Using only part of the configuration to avoid the need to implement the entire ConfigurationMV2
type PartialConfigWithAllowlist = Pick<ConfigurationMV2, 'allowlist'>;
const config: PartialConfigWithAllowlist = { allowlist: ['google.com'] };
assert.ok(config);

// eslint-disable-next-line no-console
console.log('Smoke test for @adguard/tswebextension passed in root-exports.ts');

// Existing consumers may omit both the opt-in and prepared policy.
const legacyStealth: ConfigurationMV2['settings']['stealth'] = {
    selfDestructFirstPartyCookies: false,
    selfDestructFirstPartyCookiesTime: 0,
    selfDestructThirdPartyCookies: false,
    selfDestructThirdPartyCookiesTime: 0,
    hideReferrer: false,
    hideSearchQueries: false,
    blockChromeClientData: false,
    sendDoNotTrack: false,
    blockWebRTC: false,
};
const canvasConfiguration: Pick<ConfigurationMV2, 'canvasProtectionPolicy'> = {};
const policy: ProtectionPolicyArtifact | undefined = canvasConfiguration.canvasProtectionPolicy;
assert.equal(legacyStealth.protectCanvas, undefined);
assert.equal(policy, undefined);
