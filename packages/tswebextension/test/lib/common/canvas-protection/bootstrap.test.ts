import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    bootstrapCanvasProtection,
    readDocumentPolicyInput,
} from '../../../../src/lib/common/canvas-protection/bootstrap';
import { type CanvasBootstrapSnapshot } from '../../../../src/lib/common/canvas-protection/contracts';
import { deriveInstallationTokens } from '../../../../src/lib/common/canvas-protection/noise';

import { createProtectAllPolicy } from './fixtures/prepared-policies';

/**
 * Creates trusted registration state without a document bridge.
 *
 * @returns An enabled current snapshot.
 */
const snapshot = (): CanvasBootstrapSnapshot => ({
    session: { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' },
    gates: { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: true },
    policy: createProtectAllPolicy('chromium-mv3', 'current'),
});

describe('document canvas bootstrap', () => {
    it('captures own top context or immutable local fallback', () => {
        const input = readDocumentPolicyInput(window);
        expect(input.url).toBe(window.location.href);
        expect(input.requestType).toBe('document');
        expect(input.inheritedTop).toEqual({ status: 'unavailable', reason: 'trusted-top-context-unavailable' });
        expect(input.sourceUrl).toEqual({ status: 'unavailable', reason: 'request-source-unavailable' });
        const child = document.createElement('iframe');
        document.body.appendChild(child);
        try {
            expect(readDocumentPolicyInput(child.contentWindow!).requestType).toBe('subdocument');
            expect(readDocumentPolicyInput(child.contentWindow!).inheritedTop).toEqual(input.inheritedTop);
        } finally {
            child.remove();
        }
    });

    it('ignores forged relayed and replayed parent markers', () => {
        let calls = 0;
        Object.defineProperty(window, 'adguardCanvasContext', {
            configurable: true,
            get: (): never => { calls += 1; throw new Error('page marker must remain unread'); },
        });
        try {
            expect(readDocumentPolicyInput(window).requestType).toBe('document');
            expect(calls).toBe(0);
        } finally {
            Reflect.deleteProperty(window, 'adguardCanvasContext');
        }
    });

    it('leaves a disabled document and its global object untouched', () => {
        vi.stubGlobal('CanvasRenderingContext2D', { prototype: { getImageData: (): void => {} } });
        const before = HTMLCanvasElement.prototype.toDataURL;
        const { toString } = Function.prototype;
        const globals = Reflect.ownKeys(window);
        const disabled = snapshot();
        bootstrapCanvasProtection(
            { ...disabled, gates: { ...disabled.gates, protectCanvas: false } },
            deriveInstallationTokens(disabled.session),
        );
        expect(HTMLCanvasElement.prototype.toDataURL).toBe(before);
        expect(Function.prototype.toString).toBe(toString);
        expect(Reflect.ownKeys(window)).toEqual(globals);
    });
});
