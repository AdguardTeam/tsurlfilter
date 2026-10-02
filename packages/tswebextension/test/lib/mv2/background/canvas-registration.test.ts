import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { FirefoxCanvasRegistration } from '../../../../src/lib/mv2/background/canvas-registration';
import { createProtectAllPolicy } from '../../common/canvas-protection/fixtures/prepared-policies';

describe('Firefox canvas registration', () => {
    let adapter: FirefoxCanvasRegistration;

    beforeEach(() => {
        Object.defineProperty(browser, 'contentScripts', { configurable: true, value: { register: vi.fn() } });
        adapter = new FirefoxCanvasRegistration();
    });

    it('distinguishes API absence from the absence of an owned registration', async () => {
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: false });
        Object.defineProperty(browser, 'contentScripts', { configurable: true, value: undefined });
        expect(await adapter.checkAvailability()).toMatchObject({ status: 'unavailable' });
    });

    it('creates a replacement before retiring the previous handle', async () => {
        const events: string[] = [];
        const old = { unregister: vi.fn(async () => { events.push('retire-old'); }) };
        const current = { unregister: vi.fn().mockResolvedValue(undefined) };
        vi.mocked(browser.contentScripts.register).mockResolvedValueOnce(old).mockImplementationOnce(async () => {
            events.push('register-current');
            return current;
        });
        const policy = createProtectAllPolicy('firefox-mv2', 'policy-a');
        expect(await adapter.install('old code', policy)).toEqual([{ operation: 'register', status: 'succeeded' }]);
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: true });
        expect(await adapter.install('current code', policy)).toEqual([
            { operation: 'register', status: 'succeeded' }, { operation: 'unregister', status: 'succeeded' },
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
        const policy = createProtectAllPolicy('firefox-mv2', 'policy-a');
        await adapter.install('old code', policy);
        await expect(adapter.install('new code', policy)).rejects.toMatchObject({
            operations: [
                { operation: 'register', status: 'failed', reason: expect.stringContaining('registration rejected') },
            ],
        });
        expect(old.unregister).not.toHaveBeenCalled();
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: true });
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
        const policy = createProtectAllPolicy('firefox-mv2', 'policy-a');
        await adapter.install('old code', policy);
        await expect(adapter.install('new code', policy)).rejects.toMatchObject({
            operations: [
                { operation: 'register', status: 'succeeded' },
                {
                    operation: 'unregister',
                    status: 'failed',
                    reason: expect.stringContaining('old retirement rejected'),
                },
            ],
        });
        expect(await adapter.remove()).toEqual([
            { operation: 'unregister', status: 'succeeded' }, { operation: 'unregister', status: 'succeeded' },
        ]);
        expect(old.unregister).toHaveBeenCalledTimes(2);
        expect(current.unregister).toHaveBeenCalledOnce();
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: false });
    });

    it('reports partial removal and retains rejected handles for retry', async () => {
        const current = {
            unregister: vi.fn().mockRejectedValueOnce(new Error('removal rejected'))
                .mockResolvedValue(undefined),
        };
        vi.mocked(browser.contentScripts.register).mockResolvedValueOnce(current);
        await adapter.install('code', createProtectAllPolicy('firefox-mv2', 'policy-a'));
        await expect(adapter.remove()).rejects.toMatchObject({
            operations: [
                { operation: 'unregister', status: 'failed', reason: expect.stringContaining('removal rejected') },
            ],
        });
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: true });
        expect(await adapter.remove()).toEqual([{ operation: 'unregister', status: 'succeeded' }]);
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: false });
    });
    it('rejects a policy for a different browser before registration writes', async () => {
        const previous = { unregister: vi.fn().mockResolvedValue(undefined) };
        vi.mocked(browser.contentScripts.register).mockResolvedValueOnce(previous);
        await adapter.install('previous', createProtectAllPolicy('firefox-mv2', 'previous'));
        vi.mocked(browser.contentScripts.register).mockClear();
        await expect(adapter.install('wrong', createProtectAllPolicy('chromium-mv3', 'wrong')))
            .rejects.toMatchObject({ name: 'CanvasRegistrationOperationError', operations: [] });
        expect(browser.contentScripts.register).not.toHaveBeenCalled();
        expect(previous.unregister).not.toHaveBeenCalled();
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: true });
    });
});
