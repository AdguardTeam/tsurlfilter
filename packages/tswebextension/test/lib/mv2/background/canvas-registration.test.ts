import {
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { extSessionStorage } from '../../../../src/lib';
import { CanvasProtectionCode } from '../../../../src/lib/common/canvas-protection/code';
import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasRegistrationOperation,
} from '../../../../src/lib/common/canvas-protection/constants';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { FirefoxCanvasRegistration } from '../../../../src/lib/mv2/background/canvas-registration';
import { browserDetectorMV2 } from '../../../../src/lib/mv2/background/utils/browser-detector';
import { createProtectAllPolicy } from '../../common/canvas-protection/fixtures/prepared-policies';

describe('Firefox canvas registration', () => {
    let adapter: FirefoxCanvasRegistration;
    const session = { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' };

    beforeAll(() => {
        extSessionStorage.init();
        appContext.startTimeMs = 1;
    });

    beforeEach(() => {
        Object.defineProperty(browser, 'contentScripts', { configurable: true, value: { register: vi.fn() } });
        Object.defineProperty(browser.runtime, 'getBrowserInfo', {
            configurable: true,
            value: vi.fn().mockResolvedValue({ version: '128.0' }),
        });
        adapter = new FirefoxCanvasRegistration();
    });

    it('distinguishes API absence from the absence of an owned registration', async () => {
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: false });
        Object.defineProperty(browser, 'contentScripts', { configurable: true, value: undefined });
        expect(await adapter.checkAvailability()).toMatchObject({ status: CanvasAvailabilityStatus.Unavailable });
    });

    it('registers the engine in the page world since Firefox 128', async () => {
        const snapshot = { session, policy: createProtectAllPolicy('policy-a') };
        await adapter.checkAvailability();
        expect(adapter.createCode(snapshot)).toBe(CanvasProtectionCode.create(snapshot));
        expect(adapter.createCode(snapshot)).not.toContain('sourceURL');
    });

    // TODO: remove when Firefox before 128 is no longer supported.
    it('registers a page script inserter before Firefox 128', async () => {
        vi.spyOn(browserDetectorMV2, 'isFirefox').mockReturnValue(true);
        vi.mocked(browser.runtime.getBrowserInfo).mockResolvedValueOnce({
            name: 'Firefox', vendor: 'Mozilla', version: '115.0', buildID: '',
        });
        vi.mocked(browser.contentScripts.register).mockResolvedValueOnce({ unregister: vi.fn() });
        const policy = createProtectAllPolicy('policy-a');
        await adapter.checkAvailability();
        const code = adapter.createCode({ session, policy });
        expect(code).toContain('window.canvasProtectionExecuted1');
        expect(code).toContain('window.wrappedJSObject');
        expect(code).toContain(CanvasProtectionCode.createPageScriptExpression({ session, policy }));
        await adapter.install(code, policy);
        const [options] = vi.mocked(browser.contentScripts.register).mock.calls[0];
        expect(options).not.toHaveProperty('world');
        expect(options.js).toEqual([{ code }]);
    });

    it('creates a replacement before retiring the previous handle', async () => {
        const events: string[] = [];
        const old = { unregister: vi.fn(async () => { events.push('retire-old'); }) };
        const current = { unregister: vi.fn().mockResolvedValue(undefined) };
        vi.mocked(browser.contentScripts.register).mockResolvedValueOnce(old).mockImplementationOnce(async () => {
            events.push('register-current');
            return current;
        });
        const policy = createProtectAllPolicy('policy-a');
        expect(await adapter.install('old code', policy)).toEqual([{
            operation: CanvasRegistrationOperation.Register,
            status: CanvasOperationStatus.Succeeded,
        }]);
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: true });
        expect(await adapter.install('current code', policy)).toEqual([
            { operation: CanvasRegistrationOperation.Register, status: CanvasOperationStatus.Succeeded },
            { operation: CanvasRegistrationOperation.Unregister, status: CanvasOperationStatus.Succeeded },
        ]);
        expect(events).toEqual(['register-current', 'retire-old']);
        expect(browser.contentScripts.register).toHaveBeenLastCalledWith({
            js: [{ code: 'current code' }],
            world: 'MAIN',
            runAt: 'document_start',
            allFrames: true,
            matches: ['<all_urls>'],
        });
        expect(current.unregister).not.toHaveBeenCalled();
    });

    it('retains the previous handle when new registration is rejected', async () => {
        const old = { unregister: vi.fn().mockResolvedValue(undefined) };
        vi.mocked(browser.contentScripts.register).mockResolvedValueOnce(old)
            .mockRejectedValueOnce(new Error('registration rejected'));
        const policy = createProtectAllPolicy('policy-a');
        await adapter.install('old code', policy);
        await expect(adapter.install('new code', policy)).rejects.toMatchObject({
            operations: [
                {
                    operation: CanvasRegistrationOperation.Register,
                    status: CanvasOperationStatus.Failed,
                    reason: expect.stringContaining('registration rejected'),
                },
            ],
        });
        expect(old.unregister).not.toHaveBeenCalled();
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: true });
        await adapter.remove();
        expect(old.unregister).toHaveBeenCalledOnce();
    });

    it('reports partial replacement and retries every still-owned handle during removal', async () => {
        const old = {
            unregister: vi.fn().mockRejectedValueOnce(new Error('old retirement rejected'))
                .mockResolvedValue(undefined),
        };
        const current = { unregister: vi.fn().mockResolvedValue(undefined) };
        vi.mocked(browser.contentScripts.register).mockResolvedValueOnce(old).mockResolvedValueOnce(current);
        const policy = createProtectAllPolicy('policy-a');
        await adapter.install('old code', policy);
        await expect(adapter.install('new code', policy)).rejects.toMatchObject({
            operations: [
                { operation: CanvasRegistrationOperation.Register, status: CanvasOperationStatus.Succeeded },
                {
                    operation: CanvasRegistrationOperation.Unregister,
                    status: CanvasOperationStatus.Failed,
                    reason: expect.stringContaining('old retirement rejected'),
                },
            ],
        });
        expect(await adapter.remove()).toEqual([
            { operation: CanvasRegistrationOperation.Unregister, status: CanvasOperationStatus.Succeeded },
            { operation: CanvasRegistrationOperation.Unregister, status: CanvasOperationStatus.Succeeded },
        ]);
        expect(old.unregister).toHaveBeenCalledTimes(2);
        expect(current.unregister).toHaveBeenCalledOnce();
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: false });
    });

    it('reports partial removal and retains rejected handles for retry', async () => {
        const current = {
            unregister: vi.fn().mockRejectedValueOnce(new Error('removal rejected'))
                .mockResolvedValue(undefined),
        };
        vi.mocked(browser.contentScripts.register).mockResolvedValueOnce(current);
        await adapter.install('code', createProtectAllPolicy('policy-a'));
        await expect(adapter.remove()).rejects.toMatchObject({
            operations: [
                {
                    operation: CanvasRegistrationOperation.Unregister,
                    status: CanvasOperationStatus.Failed,
                    reason: expect.stringContaining('removal rejected'),
                },
            ],
        });
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: true });
        expect(await adapter.remove()).toEqual([{
            operation: CanvasRegistrationOperation.Unregister,
            status: CanvasOperationStatus.Succeeded,
        }]);
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: false });
    });
});
