import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CanvasProtectionCode } from '../../../../src/lib/common/canvas-protection/code';
import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasRegistrationOperation,
} from '../../../../src/lib/common/canvas-protection/constants';
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

    it('names the script anonymous in stack traces', () => {
        const snapshot = {
            session: { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' },
            policy: createProtectAllPolicy('policy-a'),
        };
        expect(adapter.createCode(snapshot)).toMatch(/\n\/\/# sourceURL=<anonymous>$/);
        expect(CanvasProtectionCode.create(snapshot)).not.toContain('sourceURL');
    });

    it('checks actual access and own registration presence', async () => {
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: false });
        getScripts.mockResolvedValueOnce([{ id: ID, js: [{ code: 'existing code' }] }]);
        expect(await adapter.checkAvailability()).toEqual({ status: CanvasAvailabilityStatus.Available, value: true });
        expect(chrome.userScripts.getScripts).toHaveBeenCalledWith({ ids: [ID] });
        vi.mocked(chrome.userScripts.getScripts).mockRejectedValueOnce(new Error('access revoked'));
        expect(await adapter.checkAvailability()).toMatchObject({
            status: CanvasAvailabilityStatus.Unavailable,
            reason: expect.any(String),
        });
    });

    it('registers only its own early MAIN-world script and returns actual operations', async () => {
        const policy = createProtectAllPolicy('policy-a');
        expect(await adapter.install('generated code', policy)).toEqual([
            { operation: CanvasRegistrationOperation.Register, status: CanvasOperationStatus.Succeeded },
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
        const policy = createProtectAllPolicy('policy-a');
        expect(await adapter.install('new code', policy)).toEqual([
            { operation: CanvasRegistrationOperation.Update, status: CanvasOperationStatus.Succeeded },
        ]);
        vi.mocked(chrome.userScripts.update).mockRejectedValueOnce(new Error('update rejected'));
        await expect(adapter.install('failed code', policy)).rejects.toMatchObject({
            operations: [
                {
                    operation: CanvasRegistrationOperation.Update,
                    status: CanvasOperationStatus.Failed,
                    reason: expect.stringContaining('update rejected'),
                },
            ],
        });
        expect(chrome.userScripts.register).not.toHaveBeenCalled();
        expect(chrome.userScripts.unregister).not.toHaveBeenCalled();
    });

    it('reports a rejected registration check without claiming register success', async () => {
        vi.mocked(chrome.userScripts.getScripts).mockRejectedValueOnce(new Error('read rejected'));
        await expect(adapter.install('code', createProtectAllPolicy('policy-a')))
            .rejects.toBeInstanceOf(CanvasRegistrationOperationError);
        expect(chrome.userScripts.register).not.toHaveBeenCalled();
    });

    it('removes only its own ID and reports rejection truthfully', async () => {
        expect(await adapter.remove()).toEqual([{
            operation: CanvasRegistrationOperation.Unregister,
            status: CanvasOperationStatus.Succeeded,
        }]);
        expect(chrome.userScripts.unregister).toHaveBeenCalledWith({ ids: [ID] });
        vi.mocked(chrome.userScripts.unregister).mockRejectedValueOnce(new Error('removal rejected'));
        await expect(adapter.remove()).rejects.toMatchObject({
            operations: [
                {
                    operation: CanvasRegistrationOperation.Unregister,
                    status: CanvasOperationStatus.Failed,
                    reason: expect.stringContaining('removal rejected'),
                },
            ],
        });
    });
});
