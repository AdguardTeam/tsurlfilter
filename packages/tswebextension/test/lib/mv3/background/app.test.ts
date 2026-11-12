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

import {
    getRulesetId,
    type IFilter,
    type IRulesetWithSourceMap,
    type RulesetContentProvider,
} from '@adguard/dnr-converter';

import { CanvasAvailabilityStatus } from '../../../../src/lib/common/canvas-protection/constants';
import { CanvasProtectionRegistration } from '../../../../src/lib/common/canvas-protection/registration';
import { MemoryStorage } from '../../../../src/lib/common/storage/core';
import { logger } from '../../../../src/lib/common/utils/logger';
import { TsWebExtension } from '../../../../src/lib/mv3/background/app';
import { appContext } from '../../../../src/lib/mv3/background/app-context';
import { ChromiumCanvasRegistration } from '../../../../src/lib/mv3/background/canvas-registration';
import { type ConfigurationMV3 } from '../../../../src/lib/mv3/background/configuration';
import { declarativeFilteringLog } from '../../../../src/lib/mv3/background/declarative-filtering-log';
import DynamicRulesApi from '../../../../src/lib/mv3/background/dynamic-rules-api';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { extSessionStorage, type SessionStorageSchema } from '../../../../src/lib/mv3/background/ext-session-storage';
import FiltersApi from '../../../../src/lib/mv3/background/filters-api';
import { CspService } from '../../../../src/lib/mv3/background/services/csp-service';
import { StealthService } from '../../../../src/lib/mv3/background/services/stealth-service';
import { SessionRulesApi } from '../../../../src/lib/mv3/background/session-rules-api';
import { getConfigurationMv3Fixture } from '../fixtures/configuration';

const configureBoundaries = TsWebExtension as unknown as {
    syncRulesetsWithIdb: () => Promise<void>;
    getFiltersUpdateInfo: () => Promise<unknown>;
    loadStaticRulesets: (
        rulesetsPath: ConfigurationMV3['rulesetsPath'],
        staticFilters: IFilter[],
        enabledRulesetsIds: string[],
    ) => Promise<{
        enabled: IRulesetWithSourceMap[];
        loadDisabledFilter: (filterId: number) => Promise<IRulesetWithSourceMap | undefined>;
        loadDisabled: () => Promise<IRulesetWithSourceMap[]>;
    }>;
    removeAllFilteringRules: () => Promise<void>;
};

vi.mock('../../../../src/lib/mv3/background/dynamic-rules-api');
vi.mock('../../../../src/lib/mv3/background/session-rules-api');
vi.mock('../../../../src/lib/mv3/background/web-request-api');
vi.mock('../../../../src/lib/mv3/background/declarative-filtering-log');
vi.mock('../../../../src/lib/mv3/background/engine-api');
vi.mock('../../../../src/lib/mv3/tabs/tabs-api');

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
    // The mocked log must actually run the steps it wraps, otherwise
    // `configure()` stops before applying anything.
    vi.mocked(declarativeFilteringLog.withUpdateLock).mockImplementation(async (operation) => {
        await operation();
    });
    vi.mocked(declarativeFilteringLog.withStoppedListener).mockImplementation(async (operation) => {
        await operation();
    });
    vi.spyOn(configureBoundaries, 'syncRulesetsWithIdb').mockResolvedValue(undefined);
    vi.spyOn(configureBoundaries, 'getFiltersUpdateInfo').mockResolvedValue({
        staticFilters: [], customFilters: [], filtersIdsToEnable: [], filtersIdsToDisable: [],
    });
    vi.spyOn(configureBoundaries, 'loadStaticRulesets').mockResolvedValue({
        enabled: [],
        loadDisabledFilter: vi.fn().mockResolvedValue(undefined),
        loadDisabled: vi.fn().mockResolvedValue([]),
    });
    vi.spyOn(FiltersApi, 'updateFiltering').mockResolvedValue({ errors: [] });
    vi.spyOn(StealthService, 'applySettings').mockResolvedValue({} as never);
    vi.spyOn(CspService, 'addCspReportBlockingRule').mockResolvedValue(undefined);
    Object.defineProperty(browser, 'declarativeNetRequest', {
        configurable: true, value: { getEnabledRulesets: vi.fn().mockResolvedValue([]) },
    });
    vi.spyOn(DynamicRulesApi, 'prepareDynamicFiltering').mockResolvedValue({
        ruleset: { unloadContent: vi.fn() },
        declarativeRulesToCancel: [],
        counts: { total: 0, unsafe: 0, regexp: 0 },
        limitations: [],
        errors: [],
    } as never);
    vi.spyOn(DynamicRulesApi, 'limitRebuiltCspRules').mockResolvedValue({
        rules: [],
        counts: { total: 0, unsafe: 0, regexp: 0 },
        limitations: [],
    } as never);
    vi.spyOn(DynamicRulesApi, 'applyDynamicFiltering').mockResolvedValue({} as never);
    vi.spyOn(SessionRulesApi, 'updateSessionRules').mockResolvedValue([]);
};

describe('TsWebExtension MV3 canvas protection lifecycle', () => {
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

    it('stops the declarative log listener around configure', async () => {
        appContext.isStorageInitialized = true;
        prepareConfigure();
        const withStoppedListener = vi.mocked(declarativeFilteringLog.withStoppedListener);
        withStoppedListener.mockClear();

        await instance.configure(getConfigurationMv3Fixture());

        // A bare `stop()` here would keep the listener silent after a failure,
        // so `configure()` must run its steps through the wrapper.
        expect(withStoppedListener).toHaveBeenCalledOnce();
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

    it('saves the opt-in to the session storage', async () => {
        const save = vi.spyOn(MemoryStorage.prototype, 'set');
        appContext.isStorageInitialized = true;
        appContext.configuration = {
            settings: { filteringEnabled: true, stealthModeEnabled: true, stealth: { protectCanvas: false } },
        } as never;
        await instance.setCanvasProtectionEnabled(true);
        // The session storage is the memory storage here, and it keeps a copy of each saved value.
        const storage = save.mock.contexts.at(-1) as MemoryStorage<SessionStorageSchema>;
        const stored = await storage.get('tswebextension');
        expect(stored?.configuration?.settings.stealth.protectCanvas).toBe(true);
    });

    describe('configure wiring', () => {
        const USER_FILTER_ID = 0;

        /**
         * Runs `configure()` with a real CSP pass and mocked browser
         * boundaries, so the scope placement, the counts and the rollback
         * wiring of `applyFilteringConfiguration()` are asserted.
         *
         * The regular dynamic conversion is mocked with an empty result: it is
         * covered by the dynamic-rules tests, and the wiring under test is the
         * join of its output with the real `CspRulesManager.build()`.
         *
         * @param staticFilterRules Rules of the built-in filter.
         * @param userRules User rules.
         * @param unreadableStaticFilter Whether the content of the built-in
         * filter cannot be read, so the CSP pass reports it.
         *
         * @returns The mocks the assertions are made against and the result.
         */
        const runConfigure = async (
            staticFilterRules: string[],
            userRules: string[],
            unreadableStaticFilter = false,
        ): Promise<{
            prepareDynamicFiltering: ReturnType<typeof vi.fn>;
            limitRebuiltCspRules: ReturnType<typeof vi.fn>;
            applyDynamicFiltering: ReturnType<typeof vi.fn>;
            updateSessionRules: ReturnType<typeof vi.fn>;
            rollback: ReturnType<typeof vi.fn>;
            configure: () => ReturnType<TsWebExtension['configure']>;
        }> => {
            const { createFilter } = await import('../../common/helpers');
            const staticFilter = createFilter(staticFilterRules, 1);
            if (unreadableStaticFilter) {
                vi.spyOn(staticFilter, 'getContent').mockRejectedValue(new Error('filter source is offline'));
            }

            const userFilter = createFilter(userRules, USER_FILTER_ID);
            const { RulesetWithSourceMap } = await import('@adguard/dnr-converter');
            const staticRuleset = new RulesetWithSourceMap(
                getRulesetId(staticFilter.getId()),
                0,
                0,
                0,
                {
                    loadSourceMap: async (): ReturnType<RulesetContentProvider['loadSourceMap']> => ({
                        getByDeclarativeRuleId: () => [],
                        getBySourceRuleIndex: () => [],
                        serialize: () => '',
                    }),
                    loadFilterList: async (): ReturnType<RulesetContentProvider['loadFilterList']> => [staticFilter],
                    loadDeclarativeRules: async (): ReturnType<RulesetContentProvider['loadDeclarativeRules']> => [],
                },
                [],
                { hasSources: () => false } as never,
                [],
            );

            // Reuse the shared boundary setup and override only what this
            // block asserts, so a new boundary is added in one place.
            prepareConfigure();
            vi.spyOn(configureBoundaries, 'getFiltersUpdateInfo').mockResolvedValue({
                staticFilters: [staticFilter],
                customFilters: [],
                filtersIdsToEnable: [],
                filtersIdsToDisable: [],
            });
            vi.spyOn(configureBoundaries, 'loadStaticRulesets').mockResolvedValue({
                enabled: [staticRuleset],
                loadDisabledFilter: vi.fn().mockResolvedValue(undefined),
                loadDisabled: vi.fn().mockResolvedValue([]),
            });
            Object.defineProperty(browser, 'declarativeNetRequest', {
                configurable: true,
                value: { getEnabledRulesets: vi.fn().mockResolvedValue([getRulesetId(staticFilter.getId())]) },
            });

            // Empty regular conversion: the dynamic scope is exercised by the
            // rebuilt CSP rules only.
            const prepareDynamicFiltering = vi.spyOn(DynamicRulesApi, 'prepareDynamicFiltering')
                .mockResolvedValue({
                    ruleset: { unloadContent: vi.fn() },
                    declarativeRulesToCancel: [],
                    counts: { total: 0, unsafe: 0, regexp: 0 },
                    limitations: [],
                    errors: [],
                } as never);
            const limitRebuiltCspRules = vi.spyOn(DynamicRulesApi, 'limitRebuiltCspRules')
                .mockImplementation(async (conversionResult, rules) => ({
                    rules,
                    counts: { total: rules.length, unsafe: 0, regexp: 0 },
                    limitations: [],
                }) as never);
            const applyDynamicFiltering = vi.spyOn(DynamicRulesApi, 'applyDynamicFiltering')
                .mockResolvedValue({ rules: [], sourceMap: new Map(), disabledStaticRuleIds: new Map() } as never);
            const updateSessionRules = vi.spyOn(SessionRulesApi, 'updateSessionRules').mockResolvedValue([]);
            const rollback = vi.spyOn(DynamicRulesApi, 'rollbackDynamicFiltering')
                .mockResolvedValue(undefined as never);

            // The user rules reach the CSP pass through the real FiltersApi
            // path, not through the configuration text, so the scope split
            // depends on the filter object the wiring hands over.
            vi.spyOn(FiltersApi, 'createUserRulesFilter').mockReturnValue(userFilter);

            const config = getConfigurationMv3Fixture();

            return {
                prepareDynamicFiltering,
                limitRebuiltCspRules,
                applyDynamicFiltering,
                updateSessionRules,
                rollback,
                configure: () => instance.configure(config),
            };
        };

        /**
         * Runs `configure()` with a session-update failure and returns the
         * rollback mock, so the rejection and the rollback are both asserted.
         *
         * @param staticFilterRules Rules of the built-in filter.
         * @param userRules User rules.
         *
         * @returns The rollback mock.
         */
        const runFailingConfigure = async (
            staticFilterRules: string[],
            userRules: string[],
        ): Promise<ReturnType<typeof vi.fn>> => {
            const failure = new Error('quota');

            // Install the failing mock after runConfigure's own setup:
            // `configure()` runs only after the rejection is wired.
            const setup = await runConfigure(staticFilterRules, userRules);
            vi.mocked(SessionRulesApi.updateSessionRules).mockRejectedValue(failure);
            await expect(setup.configure()).rejects.toBe(failure);
            return setup.rollback;
        };

        it('places the static CSP rules into session rules and the dynamic ones into dynamic rules', async () => {
            appContext.isStorageInitialized = true;
            const {
                limitRebuiltCspRules, applyDynamicFiltering, updateSessionRules, configure,
            } = await runConfigure(
                ["$csp=script-src 'none'"],
                ["||example.com^$csp=img-src 'none'"],
            );
            const result = await configure();

            // The dynamic CSP rule is fitted to the dynamic quotas and applied
            // with the regular dynamic rules; the static one goes to the
            // session update, and neither scope receives the other's rule.
            const limitedRules = limitRebuiltCspRules.mock.calls[0][1];
            expect(limitedRules).toHaveLength(1);
            expect(limitedRules[0].action.responseHeaders[0].value).toBe("img-src 'none'");

            const appliedCspRules = applyDynamicFiltering.mock.calls[0][2];
            expect(appliedCspRules).toEqual(limitedRules);

            const sessionArgs = updateSessionRules.mock.calls[0];
            const sessionCspRules = sessionArgs[2];
            expect(sessionCspRules).toHaveLength(1);
            expect(sessionCspRules[0].action.responseHeaders[0].value).toBe("script-src 'none'");

            expect(result.cspRules?.errors).toEqual([]);
            expect(result.dynamicRules?.errors).toEqual([]);
            // The counts are the final ones, rebuilt CSP rules included.
            expect(result.dynamicRules?.counts).toEqual({ total: 1, unsafe: 0, regexp: 0 });
        });

        it('rolls the dynamic rules back when the session update fails', async () => {
            appContext.isStorageInitialized = true;
            const rollback = await runFailingConfigure(["$csp=script-src 'none'"], []);
            expect(rollback).toHaveBeenCalledOnce();
        });

        it('logs the CSP errors of built-in filters at the debug level', async () => {
            // Built-in filters always hold `$csp` exceptions which DNR cannot
            // express, so a warning here would appear on every configure().
            appContext.isStorageInitialized = true;
            const debug = vi.spyOn(logger, 'debug');
            const warn = vi.spyOn(logger, 'warn');
            const { configure } = await runConfigure(["$csp=script-src 'none'"], [], true);

            await configure();

            expect(debug).toHaveBeenCalledWith(
                expect.stringContaining('cannot convert some CSP rules of built-in filters'),
                expect.any(Array),
            );
            expect(warn).not.toHaveBeenCalledWith(
                expect.stringContaining('cannot convert some CSP rules of built-in filters'),
                expect.anything(),
            );
        });
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
            const applyRegistration = vi.spyOn(CanvasProtectionRegistration.prototype, 'apply');
            const warn = vi.spyOn(logger, 'warn');
            appContext.configuration = {
                settings: { filteringEnabled: true, stealthModeEnabled: true, stealth: { protectCanvas: true } },
            } as never;
            await instance.initStorage();
            expect(applyRegistration).not.toHaveBeenCalled();
            expect(warn).not.toHaveBeenCalled();
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

describe('TsWebExtension MV3 static rulesets', () => {
    it('creates only rulesets enabled by the browser during configuration', async () => {
        appContext.isStorageInitialized = true;
        prepareConfigure();
        const loadStaticRulesets = vi.spyOn(configureBoundaries, 'loadStaticRulesets');
        const loadDisabledFilter = vi.fn().mockResolvedValue(undefined);
        const loadDisabled = vi.fn().mockResolvedValue([]);
        loadStaticRulesets.mockResolvedValue({ enabled: [], loadDisabledFilter, loadDisabled });
        const getEnabledRulesets = vi.fn().mockResolvedValue(['ruleset_2']);
        Object.defineProperty(browser, 'declarativeNetRequest', {
            configurable: true, value: { getEnabledRulesets },
        });
        const config = getConfigurationMv3Fixture();
        config.settings.filteringEnabled = true;

        const result = await instance.configure(config);

        // Enabled rulesets are requested after the requested state is applied,
        // because the browser may decline enabling some rulesets, and before
        // the rulesets are created to skip the disabled ones.
        expect(getEnabledRulesets.mock.invocationCallOrder[0])
            .toBeGreaterThan(vi.mocked(FiltersApi.updateFiltering).mock.invocationCallOrder[0]);
        expect(getEnabledRulesets.mock.invocationCallOrder[0])
            .toBeLessThan(loadStaticRulesets.mock.invocationCallOrder[0]);
        expect(loadStaticRulesets).toHaveBeenCalledWith(
            config.rulesetsPath,
            expect.any(Array),
            ['ruleset_2'],
        );
        // Disabled rulesets are created only when the caller asks for them.
        expect(loadDisabled).not.toHaveBeenCalled();
        expect(loadDisabledFilter).not.toHaveBeenCalled();
        expect(result.loadDisabledStaticFilter).toBe(loadDisabledFilter);
        expect(result.loadDisabledStaticFilters).toBe(loadDisabled);
    });

    it('returns no disabled rulesets when filtering is disabled', async () => {
        appContext.isStorageInitialized = true;
        prepareConfigure();
        vi.spyOn(configureBoundaries, 'removeAllFilteringRules').mockResolvedValue(undefined);
        const config = getConfigurationMv3Fixture();
        config.settings.filteringEnabled = false;

        const result = await instance.configure(config);

        expect(result.staticFilters).toEqual([]);
        expect(await result.loadDisabledStaticFilter(2)).toBeUndefined();
        expect(await result.loadDisabledStaticFilters()).toEqual([]);
    });
});
