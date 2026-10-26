import { TextEncoder } from 'node:util';
import { runInNewContext } from 'node:vm';

import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { extSessionStorage } from '../../../../src/lib';
import { CanvasProtectionCode } from '../../../../src/lib/common/canvas-protection/code';
import {
    CanvasAvailabilityStatus,
    CanvasConditionType,
    CanvasOperationStatus,
    CanvasRegistrationOperation,
} from '../../../../src/lib/common/canvas-protection/constants';
import { type CanvasBootstrapSnapshot } from '../../../../src/lib/common/canvas-protection/contracts';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { ChromiumMv2CanvasInjection } from '../../../../src/lib/mv2/background/canvas-injection';
import { TabsApi } from '../../../../src/lib/mv2/background/tabs/tabs-api';
import { CanvasDeliveryGuard } from '../../../../src/lib/mv2/common/canvas-delivery';
import { createProtectAllPolicy, hostCondition } from '../../common/canvas-protection/fixtures/prepared-policies';

/**
 * Evaluates the content script expression in a fresh context, as the content script world does.
 *
 * @param snapshot Trusted bootstrap state.
 * @param prelude Code that sets up `window`, `top` and `location` of the context.
 *
 * @returns The page script text or `undefined`.
 */
const evaluatePageScriptExpression = (snapshot: CanvasBootstrapSnapshot, prelude: string): unknown => {
    return runInNewContext(
        `${prelude}\n${CanvasProtectionCode.createPageScriptExpression(snapshot)}`,
        { TextEncoder, URL },
        { timeout: 5000 },
    );
};

describe('Chromium MV2 canvas injection', () => {
    let adapter: ChromiumMv2CanvasInjection;
    const session = { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' };
    const policy = {
        ...createProtectAllPolicy('policy-a'),
        selectors: { matches: ['https://*.example.org/*'], excludeMatches: ['https://excluded.example.org/*'] },
    };
    const snapshot: CanvasBootstrapSnapshot = { session, policy };
    // Excludes every top document with a hostname, so the engine never runs in jsdom,
    // which has no canvas bindings.
    const inertSnapshot: CanvasBootstrapSnapshot = {
        session,
        policy: {
            ...policy,
            documentExclusions: [{
                type: CanvasConditionType.Not,
                operand: hostCondition({}),
            }],
        },
    };

    beforeAll(() => {
        extSessionStorage.init();
        appContext.startTimeMs = 1;
    });

    beforeEach(() => {
        vi.spyOn(TabsApi, 'injectScript').mockResolvedValue(undefined);
        adapter = new ChromiumMv2CanvasInjection();
    });

    afterEach(() => {
        Reflect.deleteProperty(window, CanvasDeliveryGuard.Delivered);
        Reflect.deleteProperty(window, 'canvasProtectionExecuted1');
    });

    it('generates a content script that inserts the engine', () => {
        const code = adapter.createCode(snapshot);
        expect(code.startsWith(`if(window.${CanvasDeliveryGuard.Delivered}!==true){`)).toBe(true);
        expect(code).toContain('window.canvasProtectionExecuted1');
        expect(code).toContain(CanvasProtectionCode.createPageScriptExpression(snapshot));
    });

    it('skips the commit-time script in a document that already got the page script', () => {
        Reflect.set(window, CanvasDeliveryGuard.Delivered, true);
        window.eval(adapter.createCode(inertSnapshot));
        expect(Reflect.get(window, 'canvasProtectionExecuted1')).toBeUndefined();
    });

    it('runs the commit-time script in a document without the flag and marks it', () => {
        window.eval(adapter.createCode(inertSnapshot));
        expect(Reflect.get(window, 'canvasProtectionExecuted1')).toBe(true);
        expect(Reflect.get(window, CanvasDeliveryGuard.Delivered)).toBe(true);
        expect(document.querySelector('script')).toBeNull();
    });

    it('a page element with the flag\'s id does not skip the commit-time script', () => {
        // `window.eval` runs in Node's global, which does not see jsdom named properties.
        Reflect.set(window, CanvasDeliveryGuard.Delivered, document.createElement('div'));
        window.eval(adapter.createCode(inertSnapshot));
        expect(Reflect.get(window, 'canvasProtectionExecuted1')).toBe(true);
    });

    it('returns no page script before installation and after removal', async () => {
        const input = { url: 'https://a.example.org/p', topUrl: 'https://a.example.org/p' };
        expect(adapter.getPageScript(input)).toBeUndefined();
        await adapter.install(adapter.createCode(snapshot), policy);
        expect(adapter.getPageScript(input)).toBeDefined();
        await adapter.remove();
        expect(adapter.getPageScript(input)).toBeUndefined();
    });

    it('returns the page script the content script builds for a top document', async () => {
        await adapter.install(adapter.createCode(snapshot), policy);
        const expected = evaluatePageScriptExpression(snapshot, `
            globalThis.window = globalThis;
            globalThis.top = globalThis;
            globalThis.location = { href: 'https://a.example.org/p' };
        `);
        expect(typeof expected).toBe('string');
        expect(adapter.getPageScript({ url: 'https://a.example.org/p', topUrl: 'https://a.example.org/p' }))
            .toBe(expected);
    });

    it('returns the page script the content script builds for a cross-origin frame', async () => {
        await adapter.install(adapter.createCode(snapshot), policy);
        const expected = evaluatePageScriptExpression(snapshot, `
            globalThis.window = globalThis;
            globalThis.top = { get location() { throw new Error('cross-origin'); } };
            globalThis.location = {
                href: 'https://frame.example.org/f',
                ancestorOrigins: { length: 1, 0: 'https://top.example.org' },
            };
        `);
        expect(typeof expected).toBe('string');
        expect(adapter.getPageScript({
            url: 'https://frame.example.org/f',
            topUrl: 'https://top.example.org/page?q=1',
        })).toBe(expected);
    });

    it('returns nothing for documents the selectors or exclusions skip', async () => {
        const excludingPolicy = {
            ...policy,
            documentExclusions: [hostCondition({ hosts: ['top.example.org'] })],
        };
        await adapter.install(adapter.createCode({ session, policy: excludingPolicy }), excludingPolicy);
        expect(adapter.getPageScript({
            url: 'https://excluded.example.org/',
            topUrl: 'https://excluded.example.org/',
        })).toBeUndefined();
        expect(adapter.getPageScript({ url: 'https://example.com/', topUrl: 'https://example.com/' }))
            .toBeUndefined();
        expect(adapter.getPageScript({
            url: 'https://frame.example.org/f',
            topUrl: 'https://top.example.org/',
        })).toBeUndefined();
        expect(adapter.getPageScript({ url: 'https://a.example.org/', topUrl: 'https://a.example.org/' }))
            .toBeDefined();
    });

    it('never puts the session root into the page script', async () => {
        await adapter.install(adapter.createCode(snapshot), policy);
        const script = adapter.getPageScript({ url: 'https://a.example.org/p', topUrl: 'https://a.example.org/p' });
        expect(script).toBeDefined();
        expect(script).not.toContain(session.root);
    });

    it('injects the installed script into documents the selectors match', async () => {
        adapter.inject(1, 0, 'https://example.org/');
        expect(TabsApi.injectScript).not.toHaveBeenCalled();
        adapter.createCode(snapshot);
        expect(await adapter.install('engine()', policy)).toEqual([
            { operation: CanvasRegistrationOperation.Register, status: CanvasOperationStatus.Succeeded },
        ]);
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: true });
        adapter.inject(1, 0, 'https://example.org/');
        adapter.inject(1, 2, 'https://excluded.example.org/');
        adapter.inject(1, 3, 'https://example.com/');
        expect(TabsApi.injectScript).toHaveBeenCalledExactlyOnceWith(1, 0, 'engine()');
    });

    it('stops injecting after removal', async () => {
        adapter.createCode(snapshot);
        await adapter.install('engine()', policy);
        expect(await adapter.remove()).toEqual([
            { operation: CanvasRegistrationOperation.Unregister, status: CanvasOperationStatus.Succeeded },
        ]);
        expect(await adapter.remove()).toEqual([]);
        adapter.inject(1, 0, 'https://example.org/');
        expect(TabsApi.injectScript).not.toHaveBeenCalled();
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: false });
    });

    it('keeps the previous script when a policy is rejected', async () => {
        adapter.createCode(snapshot);
        await adapter.install('engine()', policy);
        adapter.createCode(snapshot);
        await expect(adapter.install('other()', {
            ...policy,
            selectors: { matches: ['example.org'], excludeMatches: [] },
        })).rejects.toMatchObject({
            operations: [{
                operation: CanvasRegistrationOperation.Register,
                status: CanvasOperationStatus.Failed,
                reason: expect.stringContaining('Invalid match pattern'),
            }],
        });
        adapter.inject(1, 0, 'https://example.org/');
        expect(TabsApi.injectScript).toHaveBeenCalledWith(1, 0, 'engine()');
    });
});
