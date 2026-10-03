import { TextEncoder } from 'node:util';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { createCanvasProtectionCode } from '../../../../src/lib/common/canvas-protection/code';
import { type CanvasBootstrapSnapshot } from '../../../../src/lib/common/canvas-protection/contracts';

import { createProtectAllPolicy } from './fixtures/prepared-policies';

/**
 * Runs generated delivery code in a new document, without extension privileges.
 *
 * @param snapshot Trusted serialized bootstrap state.
 *
 * @returns Whether the delivery left the document's global keys and readout unchanged.
 */
const execute = (snapshot: CanvasBootstrapSnapshot): boolean => {
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
        const globals = Reflect.ownKeys(realm);
        const { getImageData } = realm.CanvasRenderingContext2D.prototype;
        realm.eval(createCanvasProtectionCode(snapshot));
        expect(Reflect.get(realm, 'injected')).toBeUndefined();
        return realm.CanvasRenderingContext2D.prototype.getImageData === getImageData
            && Reflect.ownKeys(realm).every((key, index) => key === globals[index]);
    } finally {
        frame.remove();
    }
};

describe('generated canvas delivery code', () => {
    it('executes generated bundle with serialized hostile strings', () => {
        const text = '"\');globalThis.injected=true;//</script>\u2028\u2029';
        const policy = createProtectAllPolicy('chromium-mv3', text);
        const untouched = execute({
            session: { root: '0123456789abcdef0123456789abcdef', generation: text },
            gates: { filteringEnabled: false, stealthModeEnabled: true, protectCanvas: true },
            policy: { ...policy, unavailableConditions: [text] },
        });
        expect(untouched).toBe(true);
    });
    it('renames the script in Chromium stack traces only', () => {
        const state = {
            session: { root: '0123456789abcdef0123456789abcdef', generation: 'generation' },
            gates: { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: true },
        };
        expect(createCanvasProtectionCode({ ...state, policy: createProtectAllPolicy('chromium-mv3', 'current') }))
            .toMatch(/\n\/\/# sourceURL=<anonymous>$/);
        expect(createCanvasProtectionCode({ ...state, policy: createProtectAllPolicy('firefox-mv2', 'current') }))
            .not.toContain('sourceURL');
    });

    it.each([false, true])('keeps disabled or excluded readouts native across duplicate delivery (%s)', (enabled) => {
        const policy = createProtectAllPolicy('chromium-mv3', '";globalThis.injected=true;//</script>\u2028\u2029');
        const exclusions = [{
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^https://canvas\\.test/', flags: '',
            },
        }] satisfies typeof policy.ownFrameExclusions;
        const code = createCanvasProtectionCode({
            session: { root: '11111111111111111111111111111111', generation: '22222222222222222222222222222222' },
            gates: { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: enabled },
            policy: { ...policy, ownFrameExclusions: exclusions },
        });
        const result = runInNewContext(`
            globalThis.window = globalThis;
            globalThis.top = globalThis;
            globalThis.location = { href: 'https://canvas.test/read' };
            globalThis.HTMLCanvasElement = class { toDataURL() { return 'native-url'; } };
            globalThis.CanvasRenderingContext2D = class { getImageData() { return 'native-pixels'; } };
            const native = HTMLCanvasElement.prototype.toDataURL;
            const nativeStringification = Function.prototype.toString;
            ${code}
            ${code}
            ({ pixels: new CanvasRenderingContext2D().getImageData(),
                url: new HTMLCanvasElement().toDataURL(),
                unchanged: native === HTMLCanvasElement.prototype.toDataURL
                    && nativeStringification === Function.prototype.toString,
                injected: globalThis.injected });
        `, { TextEncoder, URL }, { timeout: 5000 });
        expect(result).toEqual({
            pixels: 'native-pixels', url: 'native-url', unchanged: true, injected: undefined,
        });
    });
});
