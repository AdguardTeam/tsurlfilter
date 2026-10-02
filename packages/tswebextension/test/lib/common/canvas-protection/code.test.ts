import { TextEncoder } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createCanvasProtectionCode } from '../../../../src/lib/common/canvas-protection/code';
import { type CanvasBootstrapSnapshot } from '../../../../src/lib/common/canvas-protection/contracts';

import { createProtectAllPolicy } from './fixtures/prepared-policies';

/**
 * Runs generated delivery code in a new document, without extension privileges.
 *
 * @param snapshot Trusted serialized bootstrap state.
 *
 * @returns The immutable installation outcome.
 */
const execute = (snapshot: CanvasBootstrapSnapshot): unknown => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    try {
        const realm = frame.contentWindow as Window & typeof globalThis;
        Object.defineProperty(realm, 'TextEncoder', { value: TextEncoder });
        Object.defineProperty(realm, 'CanvasRenderingContext2D', {
            value: {
                prototype: { getImageData: (): void => {} },
            },
        });
        realm.eval(createCanvasProtectionCode(snapshot));
        expect(Reflect.get(realm, 'injected')).toBeUndefined();
        return Reflect.get(realm, Symbol.for('adguard.canvas.installation'));
    } finally {
        frame.remove();
    }
};

describe('generated canvas delivery code', () => {
    it('executes generated bundle with serialized hostile strings', () => {
        const text = '"\');globalThis.injected=true;//</script>\u2028\u2029';
        const policy = createProtectAllPolicy('chromium-mv3', text);
        const outcome = execute({
            session: { root: '0123456789abcdef0123456789abcdef', generation: text },
            gates: { filteringEnabled: false, stealthModeEnabled: true, protectCanvas: true },
            policy: { ...policy, unavailableConditions: [text] },
        });
        expect(outcome).toMatchObject({ outcome: 'disabled' });
    });
});
