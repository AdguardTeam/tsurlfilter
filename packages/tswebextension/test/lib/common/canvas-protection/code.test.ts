import { TextEncoder } from 'node:util';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { CanvasProtectionCode } from '../../../../src/lib/common/canvas-protection/code';
import { CanvasConditionType } from '../../../../src/lib/common/canvas-protection/constants';
import { type CanvasBootstrapSnapshot } from '../../../../src/lib/common/canvas-protection/contracts';
import { deriveSiteSeed, formatKey } from '../../../../src/lib/common/canvas-protection/noise';

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
        realm.eval(CanvasProtectionCode.create(snapshot));
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
        const policy = createProtectAllPolicy(text);
        const untouched = execute({
            session: { root: '0123456789abcdef0123456789abcdef', generation: text },
            policy: {
                ...policy,
                // The delivery must stay inert here: jsdom has no canvas bindings to wrap.
                // Every top document with a hostname.
                documentExclusions: [{
                    type: CanvasConditionType.Not,
                    operand: {
                        type: CanvasConditionType.Host, hosts: [], domains: [], parents: [],
                    },
                }],
            },
        });
        expect(untouched).toBe(true);
    });

    it('keeps excluded readouts native across duplicate delivery', () => {
        const policy = createProtectAllPolicy('";globalThis.injected=true;//</script>\u2028\u2029');
        const exclusions = [{
            type: CanvasConditionType.Host,
            hosts: ['canvas.test'],
            domains: [],
            parents: [],
        }] satisfies typeof policy.documentExclusions;
        const code = CanvasProtectionCode.create({
            session: { root: '11111111111111111111111111111111', generation: '22222222222222222222222222222222' },
            policy: { ...policy, documentExclusions: exclusions },
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

    describe('seeded page script', () => {
        const snapshot: CanvasBootstrapSnapshot = {
            session: { root: '0123456789abcdef0123456789abcdef', generation: 'fedcba9876543210fedcba9876543210' },
            policy: createProtectAllPolicy('seeded'),
        };

        it('builds the same seeded page script as the content script expression', () => {
            const expected = runInNewContext(`
                globalThis.window = globalThis;
                globalThis.top = globalThis;
                globalThis.location = { href: 'https://canvas.test/read' };
                ${CanvasProtectionCode.createPageScriptExpression(snapshot)}
            `, { TextEncoder, URL }, { timeout: 5000 });
            const seed = formatKey(deriveSiteSeed(snapshot.session, 'canvas.test'), 16);

            expect(typeof expected).toBe('string');
            expect(CanvasProtectionCode.createSeededPageScript(seed)).toBe(expected);
        });

        it('carries the site key and not the session root', () => {
            const seed = formatKey(deriveSiteSeed(snapshot.session, 'canvas.test'), 16);
            const script = CanvasProtectionCode.createSeededPageScript(seed);

            expect(script).toContain(`"${seed}"`);
            expect(script).not.toContain(snapshot.session.root);
        });
    });
});
