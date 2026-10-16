import {
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
    CanvasOperationStatus,
    CanvasRegistrationOperation,
} from '../../../../src/lib/common/canvas-protection/constants';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { ChromiumMv2CanvasInjection } from '../../../../src/lib/mv2/background/canvas-injection';
import { TabsApi } from '../../../../src/lib/mv2/background/tabs/tabs-api';
import { createProtectAllPolicy } from '../../common/canvas-protection/fixtures/prepared-policies';

describe('Chromium MV2 canvas injection', () => {
    let adapter: ChromiumMv2CanvasInjection;
    const policy = {
        ...createProtectAllPolicy('policy-a'),
        selectors: { matches: ['https://*.example.org/*'], excludeMatches: ['https://excluded.example.org/*'] },
    };

    beforeAll(() => {
        extSessionStorage.init();
        appContext.startTimeMs = 1;
    });

    beforeEach(() => {
        vi.spyOn(TabsApi, 'injectScript').mockResolvedValue(undefined);
        adapter = new ChromiumMv2CanvasInjection();
    });

    it('generates a content script that inserts the engine', () => {
        const session = { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' };
        const code = adapter.createCode({ session, policy });
        expect(code).toContain('window.canvasProtectionExecuted1');
        expect(code).toContain(CanvasProtectionCode.createPageScriptExpression({ session, policy }));
    });

    it('injects the installed script into documents the selectors match', async () => {
        adapter.inject(1, 0, 'https://example.org/');
        expect(TabsApi.injectScript).not.toHaveBeenCalled();
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
        await adapter.install('engine()', policy);
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
