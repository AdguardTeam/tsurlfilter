import { webcrypto } from 'node:crypto';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { TsWebExtension } from '../../../../src/lib/mv3/background/app';
import { appContext } from '../../../../src/lib/mv3/background/app-context';
import { type ConfigurationMV3 } from '../../../../src/lib/mv3/background/configuration';
import DynamicRulesApi from '../../../../src/lib/mv3/background/dynamic-rules-api';
import FiltersApi from '../../../../src/lib/mv3/background/filters-api';
import { SessionRulesApi } from '../../../../src/lib/mv3/background/session-rules-api';
import { createProtectAllPolicy } from '../../common/canvas-protection/fixtures/prepared-policies';
import { getConfigurationMv2Fixture } from '../../mv2/background/fixtures/configuration';

vi.mock('../../../../src/lib/mv3/background/ext-session-storage');
vi.mock('../../../../src/lib/mv3/background/app-context', () => ({ appContext: {} }));
vi.mock('../../../../src/lib/mv3/background/engine-api');
vi.mock('../../../../src/lib/mv3/background/filters-api');
vi.mock('../../../../src/lib/mv3/background/dynamic-rules-api');
vi.mock('../../../../src/lib/mv3/background/session-rules-api');
vi.mock('../../../../src/lib/mv3/background/services/stealth-service');
vi.mock('../../../../src/lib/mv3/background/services/csp-service');
vi.mock('../../../../src/lib/mv3/background/declarative-filtering-log');
vi.mock('../../../../src/lib/mv3/background/web-request-api');
vi.mock('../../../../src/lib/mv3/background/assistant');
vi.mock('../../../../src/lib/mv3/tabs/tabs-api');
vi.mock('../../../../src/lib/mv3/tabs/tabs-cosmetic-injector');
vi.mock('../../../../src/lib/mv3/background/request/events/request-events');
vi.mock('../../../../src/lib/mv3/background/services/remove-param-injection-service');
vi.mock('../../../../src/lib/mv3/background/services/document-blocking-service');

const REQUEST_KEY = 'tswebextension.canvasProtectionRequested';

describe('Chromium canvas protection consumer integration', () => {
    let app: TsWebExtension;
    let config: ConfigurationMV3;
    let values: Record<string, unknown>;
    let scripts: chrome.userScripts.RegisteredUserScript[];

    beforeEach(async () => {
        vi.stubGlobal('crypto', webcrypto);
        vi.clearAllMocks();
        await browser.storage.local.clear();
        values = {};
        scripts = [];
        Object.defineProperty(browser.storage, 'session', {
            configurable: true,
            value: {
                get: vi.fn(async (key: string) => ({ [key]: values[key] })),
                set: vi.fn(async (entries: Record<string, unknown>) => Object.assign(values, entries)),
                remove: vi.fn(async (keys: string | string[]) => {
                    (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete values[key]; });
                }),
            },
        });
        chrome.userScripts = {
            getScripts: vi.fn(async () => scripts),
            register: vi.fn(async (next) => { scripts = next; }),
            update: vi.fn(async (next) => { scripts = next; }),
            unregister: vi.fn(async () => { scripts = []; }),
        } as unknown as typeof chrome.userScripts;
        vi.mocked(FiltersApi.createStaticFilters).mockReturnValue([]);
        vi.mocked(FiltersApi.createCustomFilters).mockReturnValue([]);
        vi.mocked(FiltersApi.getEnabledRulesets).mockResolvedValue([]);
        vi.mocked(FiltersApi.updateFiltering).mockResolvedValue({ errors: [] });
        vi.mocked(SessionRulesApi.removeAllRules).mockResolvedValue([]);
        vi.mocked(DynamicRulesApi.updateDynamicFiltering).mockResolvedValue({
            ruleset: { unloadContent: vi.fn() }, declarativeRulesToCancel: [],
        } as unknown as Awaited<ReturnType<typeof DynamicRulesApi.updateDynamicFiltering>>);
        vi.spyOn(browser.runtime, 'getManifest').mockReturnValue({
            manifest_version: 3,
            version: '1',
            name: 'test',
            declarative_net_request: { rule_resources: [] },
        });
        Object.defineProperty(browser, 'declarativeNetRequest', {
            configurable: true,
            value: { getEnabledRulesets: vi.fn().mockResolvedValue([]) },
        });
        const { filters, ...common } = getConfigurationMv2Fixture();
        config = {
            ...common,
            staticFiltersIds: [],
            customFilters: [],
            filtersPath: '/',
            rulesetsPath: '/',
            declarativeLogEnabled: false,
            settings: {
                ...common.settings, gpcScriptUrl: '/gpc.js', hideDocumentReferrerScriptUrl: '/referrer.js',
            },
        };
        app = new TsWebExtension();
    });

    it('keeps old consumer configuration native', async () => {
        await app.initStorage();
        await app.start(config);
        await app.configure(config);
        await app.stop();
        expect(chrome.userScripts.getScripts).not.toHaveBeenCalled();
        expect(chrome.userScripts.register).not.toHaveBeenCalled();
        expect(chrome.userScripts.unregister).not.toHaveBeenCalled();
        expect(app.getCanvasProtectionState().status).toBe('disabled');
    });

    it('requires prepared policy rather than assuming empty exceptions', async () => {
        await app.configure(config);
        const result = await app.setCanvasProtectionEnabled(true);
        expect(result).toMatchObject({
            status: 'unavailable',
            requiredUserAction: expect.stringContaining('prepared canvas protection policy'),
        });
        expect(chrome.userScripts.register).not.toHaveBeenCalled();
        expect((await browser.storage.local.get(REQUEST_KEY))[REQUEST_KEY]).toMatchObject({
            gates: { protectCanvas: true },
        });
    });

    it('applies every gate and prepared replacement to new documents', async () => {
        const enabled = {
            ...config,
            canvasProtectionPolicy: createProtectAllPolicy('chromium-mv3', 'policy-a'),
            settings: { ...config.settings, stealth: { ...config.settings.stealth, protectCanvas: true } },
        };
        const initial = await app.configure(enabled);
        expect(initial.canvasProtection?.status).toBe('installed');
        const captured = structuredClone(scripts[0]);
        const first = app.getCanvasProtectionState();
        const disabled = { ...enabled, settings: { ...enabled.settings, filteringEnabled: false } };
        expect((await app.configure(disabled)).canvasProtection?.status).toBe('disabled');
        const off = { ...enabled, settings: { ...enabled.settings, stealthModeEnabled: false } };
        expect((await app.configure(off)).canvasProtection?.status).toBe('disabled');
        await app.configure(enabled);
        const replaced = await app.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'policy-b'));
        expect(replaced).toMatchObject({
            status: 'installed',
            installed: {
                status: 'available',
                value: {
                    revision: 'policy-b',
                    generation: first.installed.status === 'available' ? first.installed.value.generation : undefined,
                },
            },
        });
        expect(captured.js?.[0].code).not.toBe(scripts[0].js?.[0].code);
        await app.stop();
        expect(app.getCanvasProtectionState().status).toBe('disabled');
    });

    it('keeps registration disabled when settings and policy are changed after stop', async () => {
        await app.configure(config);
        await app.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'before-stop'));
        await app.setCanvasProtectionEnabled(true);
        await app.stop();
        vi.mocked(chrome.userScripts.register).mockClear();
        vi.mocked(chrome.userScripts.update).mockClear();
        await app.setCanvasProtectionEnabled(true);
        await app.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'after-stop'));
        await app.reconcileCanvasProtection();
        expect(chrome.userScripts.register).not.toHaveBeenCalled();
        expect(chrome.userScripts.update).not.toHaveBeenCalled();
        expect(app.getCanvasProtectionState().status).toBe('disabled');
    });

    it('reports actionable unavailable state and reconciles requested disable', async () => {
        await app.configure(config);
        await app.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'policy-a'));
        const initial = await app.setCanvasProtectionEnabled(true);
        vi.mocked(chrome.userScripts.getScripts).mockRejectedValueOnce(new Error('access revoked'));
        const pending = await app.setCanvasProtectionEnabled(false);
        expect(pending).toMatchObject({
            status: 'unavailable',
            installed: initial.installed,
            requiredUserAction: expect.stringContaining('Allow User Scripts'),
        });
        expect(app.getCanvasProtectionState().status).toBe('unavailable');
        expect((await browser.storage.local.get(REQUEST_KEY))[REQUEST_KEY])
            .toMatchObject({ gates: { protectCanvas: false } });
        expect(chrome.userScripts.unregister).not.toHaveBeenCalled();
        let acknowledge!: () => void;
        vi.mocked(chrome.userScripts.unregister).mockImplementationOnce(async () => {
            await new Promise<void>((resolve) => { acknowledge = resolve; });
            scripts = [];
        });
        const retry = app.reconcileCanvasProtection();
        await vi.waitFor(() => expect(chrome.userScripts.unregister).toHaveBeenCalledOnce());
        expect(app.getCanvasProtectionState().status).toBe('unavailable');
        acknowledge();
        expect((await retry).status).toBe('disabled');
    });

    it('reports failed updates and preserves the previous acknowledgment', async () => {
        await app.configure(config);
        await app.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'policy-a'));
        const initial = await app.setCanvasProtectionEnabled(true);
        vi.mocked(chrome.userScripts.update).mockRejectedValueOnce(new Error('update rejected'));
        expect(await app.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'policy-b')))
            .toMatchObject({ status: 'failed', installed: initial.installed });
        await app.initStorage();
        expect(app.getCanvasProtectionState()).toMatchObject({
            status: 'installed',
            installed: { status: 'available', value: { revision: 'policy-b' } },
        });
    });

    it('rehydrates persisted requests with the current root after session clearing', async () => {
        await app.configure(config);
        await app.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'policy-a'));
        const initial = await app.setCanvasProtectionEnabled(true);
        values = {};
        scripts = [];
        const restarted = new TsWebExtension();
        await restarted.initStorage();
        const current = restarted.getCanvasProtectionState();
        expect(current.status).toBe('installed');
        expect(current.installed).not.toEqual(initial.installed);
        expect((await browser.storage.local.get(REQUEST_KEY))[REQUEST_KEY]).not.toHaveProperty('session');
    });

    it('rejects a policy for a different browser before registration writes', async () => {
        await app.configure(config);
        await app.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'policy-a'));
        const initial = await app.setCanvasProtectionEnabled(true);
        vi.mocked(chrome.userScripts.update).mockClear();
        const result = await app.setCanvasProtectionPolicy(createProtectAllPolicy('firefox-mv2', 'wrong'));
        expect(result).toMatchObject({ status: 'failed', installed: initial.installed });
        expect(chrome.userScripts.update).not.toHaveBeenCalled();
        expect(chrome.userScripts.unregister).not.toHaveBeenCalled();
    });
    it('preserves the prepared policy when stopping a rehydrated application without configuration', async () => {
        await app.configure(config);
        const policy = createProtectAllPolicy('chromium-mv3', 'policy-a');
        await app.setCanvasProtectionPolicy(policy);
        await app.setCanvasProtectionEnabled(true);
        values = {};
        scripts = [];
        appContext.configuration = undefined;
        const restarted = new TsWebExtension();
        await restarted.initStorage();
        expect(restarted.getCanvasProtectionState().status).toBe('installed');
        await restarted.stop();
        expect((await browser.storage.local.get(REQUEST_KEY))[REQUEST_KEY]).toMatchObject({
            policy, gates: { filteringEnabled: false },
        });
        expect(restarted.getCanvasProtectionState().status).toBe('disabled');
    });
});
