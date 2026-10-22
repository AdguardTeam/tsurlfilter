import { webcrypto } from 'node:crypto';

import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { CanvasAvailabilityStatus } from '../../../../src/lib/common/canvas-protection/constants';
import { CanvasProtectionRegistration } from '../../../../src/lib/common/canvas-protection/registration';
import { TsWebExtension } from '../../../../src/lib/mv3/background/app';
import { appContext } from '../../../../src/lib/mv3/background/app-context';
import { ChromiumCanvasRegistration } from '../../../../src/lib/mv3/background/canvas-registration';
import { type ConfigurationMV3 } from '../../../../src/lib/mv3/background/configuration';
import DynamicRulesApi from '../../../../src/lib/mv3/background/dynamic-rules-api';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { extSessionStorage } from '../../../../src/lib/mv3/background/ext-session-storage';
import FiltersApi from '../../../../src/lib/mv3/background/filters-api';
import { CspService } from '../../../../src/lib/mv3/background/services/csp-service';
import { StealthService } from '../../../../src/lib/mv3/background/services/stealth-service';
import { getConfigurationMv3Fixture } from '../fixtures/configuration';

const configureBoundaries = TsWebExtension as unknown as {
    syncRulesetsWithIdb: () => Promise<void>;
    getFiltersUpdateInfo: () => Promise<unknown>;
    loadStaticRulesets: () => Promise<unknown>;
    removeAllFilteringRules: () => Promise<void>;
};

vi.mock('../../../../src/lib/mv3/background/dynamic-rules-api');
vi.mock('../../../../src/lib/mv3/background/session-rules-api');
vi.mock('../../../../src/lib/mv3/background/web-request-api');
vi.mock('../../../../src/lib/mv3/background/declarative-filtering-log');
vi.mock('../../../../src/lib/mv3/background/engine-api');
vi.mock('../../../../src/lib/mv3/tabs/tabs-api');

describe('TsWebExtension MV3 canvas protection lifecycle', () => {
    let instance: TsWebExtension;
    let apply: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
        await new TsWebExtension().initStorage();
    });

    beforeEach(() => {
        vi.stubGlobal('crypto', webcrypto);
        apply = vi.spyOn(CanvasProtectionRegistration.prototype, 'apply').mockResolvedValue({} as never);
        appContext.isStorageInitialized = false;
        appContext.configuration = undefined;
        instance = new TsWebExtension();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * Supplies browser boundaries without loading ruleset files.
     */
    const prepareConfigure = (): void => {
        vi.spyOn(configureBoundaries, 'syncRulesetsWithIdb').mockResolvedValue(undefined);
        vi.spyOn(configureBoundaries, 'getFiltersUpdateInfo').mockResolvedValue({
            staticFilters: [], customFilters: [], filtersIdsToEnable: [], filtersIdsToDisable: [],
        });
        vi.spyOn(configureBoundaries, 'loadStaticRulesets').mockResolvedValue([]);
        vi.spyOn(FiltersApi, 'updateFiltering').mockResolvedValue({ errors: [] });
        vi.spyOn(StealthService, 'applySettings').mockResolvedValue({} as never);
        vi.spyOn(CspService, 'addCspReportBlockingRule').mockResolvedValue(undefined);
        Object.defineProperty(browser, 'declarativeNetRequest', {
            configurable: true, value: { getEnabledRulesets: vi.fn().mockResolvedValue([]) },
        });
        vi.spyOn(DynamicRulesApi, 'updateDynamicFiltering').mockResolvedValue({
            ruleset: { unloadContent: vi.fn() }, declarativeRulesToCancel: [],
        } as never);
    };

    it('compiles exceptions after the engine restarts on configure', async () => {
        appContext.isStorageInitialized = true;
        prepareConfigure();
        vi.spyOn(engineApi, 'getDocumentOrStealthExceptionRuleTexts')
            .mockReturnValue(['@@||example.org^$stealth=fingerprinting']);
        const config = getConfigurationMv3Fixture();
        config.settings.filteringEnabled = true;
        config.settings.stealth.protectCanvas = true;
        await instance.configure(config);
        expect(engineApi.startEngine).toHaveBeenCalled();
        expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({
            policy: expect.objectContaining({
                selectors: { matches: ['<all_urls>'], excludeMatches: ['*://*.example.org/*'] },
            }),
        }));
    });

    it('compiles exceptions only once protection is enabled', async () => {
        appContext.isStorageInitialized = true;
        prepareConfigure();
        const rules = vi.spyOn(engineApi, 'getDocumentOrStealthExceptionRuleTexts').mockReturnValue([]);
        rules.mockClear();
        const config = getConfigurationMv3Fixture();
        config.settings.filteringEnabled = true;
        config.settings.stealth.protectCanvas = false;
        await instance.configure(config);
        expect(rules).not.toHaveBeenCalled();
        expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ policy: undefined }));
        await instance.setCanvasProtectionEnabled(true);
        expect(rules).toHaveBeenCalledOnce();
        expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ policy: expect.any(Object) }));
    });

    it('does not compile without filtering', async () => {
        appContext.isStorageInitialized = true;
        prepareConfigure();
        vi.spyOn(configureBoundaries, 'removeAllFilteringRules').mockResolvedValue(undefined);
        const rules = vi.spyOn(engineApi, 'getDocumentOrStealthExceptionRuleTexts').mockReturnValue([]);
        rules.mockClear();
        const config = getConfigurationMv3Fixture();
        config.settings.filteringEnabled = false;
        await instance.configure(config);
        expect(rules).not.toHaveBeenCalled();
    });

    it('rejects setters before the storage is initialized', async () => {
        await expect(instance.setCanvasProtectionEnabled(true)).rejects.toThrow('Configuration not set!');
        expect(apply).not.toHaveBeenCalled();
    });

    it('keeps the script removed after a failed start', async () => {
        appContext.isStorageInitialized = true;
        vi.spyOn(instance, 'configure').mockRejectedValue(new Error('configure failed'));
        appContext.configuration = {
            settings: { filteringEnabled: true, stealthModeEnabled: true, stealth: { protectCanvas: true } },
        } as never;
        await expect(instance.start({} as ConfigurationMV3)).rejects.toThrow('Cannot be started');
        await instance.setCanvasProtectionEnabled(true);
        expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({
            gates: { filteringEnabled: false, stealthModeEnabled: true, protectCanvas: true },
        }));
    });

    it('keeps the script removed after stop', async () => {
        appContext.isStorageInitialized = true;
        vi.spyOn(configureBoundaries, 'removeAllFilteringRules').mockResolvedValue(undefined);
        appContext.configuration = {
            settings: { filteringEnabled: true, stealthModeEnabled: true, stealth: { protectCanvas: true } },
        } as never;
        await instance.stop();
        await instance.setCanvasProtectionEnabled(true);
        expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({
            gates: { filteringEnabled: false, stealthModeEnabled: true, protectCanvas: true },
        }));
    });

    describe('initStorage', () => {
        let remove: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            apply.mockRestore();
            vi.spyOn(extSessionStorage, 'init').mockResolvedValue(undefined);
            vi.spyOn(ChromiumCanvasRegistration.prototype, 'checkAvailability')
                .mockResolvedValue({ status: CanvasAvailabilityStatus.Available, value: true });
            remove = vi.spyOn(ChromiumCanvasRegistration.prototype, 'remove').mockResolvedValue([]);
            appContext.canvasProtectionRegistration = {
                revision: 'revision', generation: 'generation', codeHash: 'hash',
            };
        });

        it('keeps the script when the service worker restarts', async () => {
            appContext.configuration = {
                settings: { filteringEnabled: true, stealthModeEnabled: true, stealth: { protectCanvas: true } },
            } as never;
            await instance.initStorage();
            expect(remove).not.toHaveBeenCalled();
            expect(appContext.canvasProtectionRegistration).toBeDefined();
        });

        it('removes the script of the previous browser session', async () => {
            appContext.canvasProtectionRegistration = undefined;
            await instance.initStorage();
            expect(remove).toHaveBeenCalledOnce();
        });
    });
});
