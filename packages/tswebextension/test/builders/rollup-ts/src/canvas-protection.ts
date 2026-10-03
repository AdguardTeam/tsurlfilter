import assert from 'node:assert/strict';

import {
    protectionPolicyArtifactValidator as mv2PolicyValidator,
    stealthConfigValidator,
    type ProtectionPolicyArtifact,
} from '@adguard/tswebextension';
import {
    protectionPolicyArtifactValidator as mv3PolicyValidator,
} from '@adguard/tswebextension/mv3';

const legacyStealth = {
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
assert.equal(stealthConfigValidator.parse(legacyStealth).protectCanvas, undefined);

(['firefox-mv2', 'chromium-mv3'] as const).forEach((browser) => {
    const policy: ProtectionPolicyArtifact = {
        schemaVersion: 1,
        revision: '";globalThis.injected = true;//</script>\u2028\u2029',
        browser,
        selectors: { matches: ['https://canvas.test/*'], excludeMatches: [] },
        ownFrameExclusions: [{
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^https://canvas\\.test/', flags: '',
            },
        }],
        documentExclusions: [],
        unavailableConditions: [],
    };
    const validator = browser === 'firefox-mv2' ? mv2PolicyValidator : mv3PolicyValidator;
    assert.deepEqual(validator.parse(policy), policy);
    assert.equal(validator.safeParse({ ...policy, schemaVersion: 2 }).success, false);
});
console.info('Packed MV2/MV3 canvas policy validators passed');
