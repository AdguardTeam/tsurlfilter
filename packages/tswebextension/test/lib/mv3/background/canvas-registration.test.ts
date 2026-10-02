import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CanvasRegistrationOperationError } from '../../../../src/lib/common/canvas-protection/registration';
import { ChromiumCanvasRegistration } from '../../../../src/lib/mv3/background/canvas-registration';
import { createProtectAllPolicy } from '../../common/canvas-protection/fixtures/prepared-policies';

const ID = 'adguard-canvas-protection';

describe('Chromium canvas registration', () => {
    let adapter: ChromiumCanvasRegistration;
    let getScripts: ReturnType<typeof vi.fn<() => Promise<chrome.userScripts.RegisteredUserScript[]>>>;

    beforeEach(() => {
        getScripts = vi.fn().mockResolvedValue([]);
        chrome.userScripts = {
            getScripts,
            register: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined),
            unregister: vi.fn().mockResolvedValue(undefined),
        } as unknown as typeof chrome.userScripts;
        adapter = new ChromiumCanvasRegistration();
    });

    it('checks actual access and own registration presence', async () => {
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: false });
        getScripts.mockResolvedValueOnce([{ id: ID, js: [{ code: 'existing code' }] }]);
        expect(await adapter.checkAvailability()).toEqual({ status: 'available', value: true });
        expect(chrome.userScripts.getScripts).toHaveBeenCalledWith({ ids: [ID] });
        vi.mocked(chrome.userScripts.getScripts).mockRejectedValueOnce(new Error('access revoked'));
        expect(await adapter.checkAvailability()).toMatchObject({ status: 'unavailable', reason: expect.any(String) });
    });

    it('registers only its own early MAIN-world script and returns actual operations', async () => {
        const policy = createProtectAllPolicy('chromium-mv3', 'policy-a');
        expect(await adapter.install('generated code', policy)).toEqual([
            { operation: 'check', status: 'succeeded' },
            { operation: 'register', status: 'succeeded' },
        ]);
        expect(chrome.userScripts.register).toHaveBeenCalledWith([{
            id: ID,
            js: [{ code: 'generated code' }],
            world: 'MAIN',
            runAt: 'document_start',
            allFrames: true,
            matches: ['<all_urls>'],
            excludeMatches: [],
        }]);
        expect(chrome.userScripts.update).not.toHaveBeenCalled();
        expect(chrome.userScripts.unregister).not.toHaveBeenCalled();
    });

    it('updates an existing own registration and preserves it on rejection', async () => {
        getScripts.mockResolvedValue([{ id: ID, js: [{ code: 'existing code' }] }]);
        const policy = createProtectAllPolicy('chromium-mv3', 'policy-a');
        expect(await adapter.install('new code', policy)).toEqual([
            { operation: 'check', status: 'succeeded' }, { operation: 'update', status: 'succeeded' },
        ]);
        vi.mocked(chrome.userScripts.update).mockRejectedValueOnce(new Error('update rejected'));
        await expect(adapter.install('failed code', policy)).rejects.toMatchObject({
            operations: [
                { operation: 'check', status: 'succeeded' },
                { operation: 'update', status: 'failed', reason: expect.stringContaining('update rejected') },
            ],
        });
        expect(chrome.userScripts.register).not.toHaveBeenCalled();
        expect(chrome.userScripts.unregister).not.toHaveBeenCalled();
    });

    it('reports a rejected registration check without claiming register success', async () => {
        vi.mocked(chrome.userScripts.getScripts).mockRejectedValueOnce(new Error('read rejected'));
        await expect(adapter.install('code', createProtectAllPolicy('chromium-mv3', 'policy-a')))
            .rejects.toBeInstanceOf(CanvasRegistrationOperationError);
        expect(chrome.userScripts.register).not.toHaveBeenCalled();
    });

    it('removes only its own ID and reports rejection truthfully', async () => {
        expect(await adapter.remove()).toEqual([{ operation: 'unregister', status: 'succeeded' }]);
        expect(chrome.userScripts.unregister).toHaveBeenCalledWith({ ids: [ID] });
        vi.mocked(chrome.userScripts.unregister).mockRejectedValueOnce(new Error('removal rejected'));
        await expect(adapter.remove()).rejects.toMatchObject({
            operations: [
                { operation: 'unregister', status: 'failed', reason: expect.stringContaining('removal rejected') },
            ],
        });
    });
    it('rejects a policy for a different browser before registration writes', async () => {
        getScripts.mockResolvedValue([{ id: ID, js: [{ code: 'previous' }] }]);
        await expect(adapter.install('wrong', createProtectAllPolicy('firefox-mv2', 'wrong')))
            .rejects.toMatchObject({ name: 'CanvasRegistrationOperationError', operations: [] });
        expect(getScripts).not.toHaveBeenCalled();
        expect(chrome.userScripts.register).not.toHaveBeenCalled();
        expect(chrome.userScripts.update).not.toHaveBeenCalled();
        expect(chrome.userScripts.unregister).not.toHaveBeenCalled();
    });
});
