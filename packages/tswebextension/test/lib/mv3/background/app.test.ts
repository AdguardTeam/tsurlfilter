import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CanvasProtectionRegistration } from '../../../../src/lib/common/canvas-protection/registration';
import { TsWebExtension } from '../../../../src/lib/mv3/background/app';
import { appContext } from '../../../../src/lib/mv3/background/app-context';
import { type ConfigurationMV3 } from '../../../../src/lib/mv3/background/configuration';

vi.mock('../../../../src/lib/mv3/background/dynamic-rules-api');
vi.mock('../../../../src/lib/mv3/background/session-rules-api');
vi.mock('../../../../src/lib/mv3/background/web-request-api');
vi.mock('../../../../src/lib/mv3/background/declarative-filtering-log');
vi.mock('../../../../src/lib/mv3/background/engine-api');
vi.mock('../../../../src/lib/mv3/tabs/tabs-api');

describe('TsWebExtension MV3 canvas protection lifecycle', () => {
    let instance: TsWebExtension;
    let apply: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        apply = vi.spyOn(CanvasProtectionRegistration.prototype, 'apply').mockResolvedValue({} as never);
        appContext.isStorageInitialized = false;
        instance = new TsWebExtension();
    });

    it('rejects setters before the storage is initialized', async () => {
        await expect(instance.setCanvasProtectionEnabled(true)).rejects.toThrow('Configuration not set!');
        expect(apply).not.toHaveBeenCalled();
    });

    it('keeps the script removed after a failed start', async () => {
        vi.spyOn(instance, 'configure').mockRejectedValue(new Error('configure failed'));
        await instance.initStorage();
        appContext.configuration = {
            settings: { filteringEnabled: true, stealthModeEnabled: true, stealth: { protectCanvas: true } },
        } as never;
        await expect(instance.start({} as ConfigurationMV3)).rejects.toThrow('Cannot be started');
        await instance.setCanvasProtectionEnabled(true);
        expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({
            gates: { filteringEnabled: false, stealthModeEnabled: true, protectCanvas: true },
        }));
    });
});
