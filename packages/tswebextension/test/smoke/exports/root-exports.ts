import assert from 'node:assert';

// eslint-disable-next-line import/no-extraneous-dependencies
import { type ConfigurationMV2 } from '@adguard/tswebextension';

// TODO: add more exports

// Using only part of the configuration to avoid the need to implement the entire ConfigurationMV2
type PartialConfigWithAllowlist = Pick<ConfigurationMV2, 'allowlist'>;
const config: PartialConfigWithAllowlist = { allowlist: ['google.com'] };
assert.ok(config);

// eslint-disable-next-line no-console
console.log('Smoke test for @adguard/tswebextension passed in root-exports.ts');

// Existing consumers may omit the canvas opt-in.
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
assert.equal(legacyStealth.protectCanvas, undefined);


// @ts-expect-error Prepared policy configuration is internal.
type RemovedPolicyConfiguration = ConfigurationMV2['canvasProtectionPolicy'];
// @ts-expect-error Prepared policy types are internal.
import { type CanvasPolicyBrowser, type ProtectionPolicyArtifact } from '@adguard/tswebextension';
