import { describe, expect, test } from 'vitest';

import { CanvasProtectionCode } from '../../../src/lib/common/canvas-protection/code';
import { CanvasConditionFlags, CanvasConditionType } from '../../../src/lib/common/canvas-protection/constants';
import { type ProtectionPolicyArtifact } from '../../../src/lib/common/canvas-protection/contracts';
import { deriveSiteSeed } from '../../../src/lib/common/canvas-protection/noise';

import {
    createFilled,
    readoutKind,
    snapshot,
    withRealm,
} from './generated-realm';

describe('canvas protection inserted as a page script', () => {
    test('carries the site key and not the session root', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const installed = {
                read: realm.CanvasRenderingContext2D.prototype.getImageData,
                toDataURL: realm.HTMLCanvasElement.prototype.toDataURL,
                toBlob: realm.HTMLCanvasElement.prototype.toBlob,
                seed: deriveSiteSeed(state.session, realm.location.hostname),
            };
            // A content script evaluates the expression; the page can read the text it produces.
            const text: string = realm.eval(CanvasProtectionCode.createPageScriptExpression(state));
            expect(text).not.toContain(state.session.root);
            expect(text).not.toContain(state.session.generation);
            realm.eval(text);
            const context = createFilled(realm);
            context.fillRect(0, 0, 0, 0);
            expect(readoutKind(context, installed)).toBe('noised');
        });
    });

    test('produces no script for an excluded document', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const policy: ProtectionPolicyArtifact = {
                ...state.policy,
                documentExclusions: [{
                    type: CanvasConditionType.UrlRegexp,
                    pattern: '.',
                    flags: CanvasConditionFlags.None,
                }],
            };
            expect(realm.eval(CanvasProtectionCode.createPageScriptExpression({ ...state, policy }))).toBeUndefined();
        });
    });
});
