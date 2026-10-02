import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

import {
    createCanvasProtectionCode as createMV2Code,
    protectionPolicyArtifactValidator as mv2PolicyValidator,
    stealthConfigValidator,
    type CanvasBootstrapSnapshot,
    type ProtectionPolicyArtifact,
} from '@adguard/tswebextension';
import {
    createCanvasProtectionCode as createMV3Code,
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

for (const browser of ['firefox-mv2', 'chromium-mv3'] as const) {
    const policy: ProtectionPolicyArtifact = {
        schemaVersion: 1,
        revision: '\";globalThis.injected = true;//</script>\u2028\u2029',
        browser,
        selectors: { matches: ['https://canvas.test/*'], excludeMatches: [] },
        ownFrameExclusions: [{
            requestTypes: ['document'],
            condition: { type: 'url-regexp', input: 'frame-url', pattern: '^https://canvas\\.test/', flags: '' },
        }],
        documentExclusions: [],
        unavailableConditions: [],
    };
    const validator = browser === 'firefox-mv2' ? mv2PolicyValidator : mv3PolicyValidator;
    assert.deepEqual(validator.parse(policy), policy);
    assert.equal(validator.safeParse({ ...policy, schemaVersion: 2 }).success, false);
    for (const protectCanvas of [false, true]) {
        const snapshot: CanvasBootstrapSnapshot = {
            session: { root: '11111111111111111111111111111111', generation: '22222222222222222222222222222222' },
            gates: { filteringEnabled: true, stealthModeEnabled: true, protectCanvas },
            policy,
        };
        const createCode = browser === 'firefox-mv2' ? createMV2Code : createMV3Code;
        const code = createCode(snapshot);
        // Every evaluation starts with independent globals and callable identities.
        const result = runInNewContext(`
            globalThis.window = globalThis;
            globalThis.top = globalThis;
            globalThis.location = { href: 'https://canvas.test/read' };
            globalThis.HTMLCanvasElement = class {
                toDataURL() { return 'native-url'; }
                toBlob(callback) { callback('native-blob'); }
            };
            globalThis.CanvasRenderingContext2D = class {
                getImageData() { return 'native-pixels'; }
            };
            const original = [HTMLCanvasElement.prototype.toDataURL,
                HTMLCanvasElement.prototype.toBlob,
                CanvasRenderingContext2D.prototype.getImageData, Function.prototype.toString];
            ${code}
            const first = new HTMLCanvasElement().toDataURL();
            let blob;
            new HTMLCanvasElement().toBlob((value) => { blob = value; });
            ${code}
            ({ first, blob, pixels: new CanvasRenderingContext2D().getImageData(),
                unchanged: original[0] === HTMLCanvasElement.prototype.toDataURL
                    && original[1] === HTMLCanvasElement.prototype.toBlob
                    && original[2] === CanvasRenderingContext2D.prototype.getImageData
                    && original[3] === Function.prototype.toString,
                injected: globalThis.injected });
        `, { TextEncoder, URL }, { timeout: 5000 }) as {
            first: string; blob: string; pixels: string; unchanged: boolean; injected: unknown;
        };
        assert.equal(result.first, 'native-url');
        assert.equal(result.blob, 'native-blob');
        assert.equal(result.pixels, 'native-pixels');
        assert.equal(result.unchanged, true);
        assert.equal(result.injected, undefined);
    }
}
console.info('Packed MV2/MV3 canvas consumer passed in fresh runtimes');
