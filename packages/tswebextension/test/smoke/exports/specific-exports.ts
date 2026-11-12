import assert from 'node:assert';

import { type Configuration as ConfigurationMV3 } from '@adguard/tswebextension/mv3';

import { getFilterName } from '@adguard/tswebextension/mv3/utils';

// TODO: Add tests for more imports

const filterName = getFilterName(1);
assert.ok(filterName === 'filter_1.txt');

// eslint-disable-next-line no-console
console.log('Smoke test for @adguard/tswebextension passed in specific-exports.ts');



const legacyStealth: ConfigurationMV3['settings']['stealth'] = {
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
type RemovedPolicyConfiguration = ConfigurationMV3['canvasProtectionPolicy'];
// @ts-expect-error Prepared policy types are internal.
import { type CanvasPolicyBrowser, type ProtectionPolicyArtifact } from '@adguard/tswebextension/mv3';
