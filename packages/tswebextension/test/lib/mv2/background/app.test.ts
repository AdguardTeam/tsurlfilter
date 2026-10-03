import { webcrypto } from 'node:crypto';

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';
import { type Runtime } from 'webextension-polyfill';

import {
    type ConfigurationMV2,
    createTsWebExtension,
    engineApi,
    messagesApi,
    TsWebExtension,
} from '../../../../src/lib';
import { type Message } from '../../../../src/lib/common/message';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { assistant, Assistant } from '../../../../src/lib/mv2/background/assistant';
import { configurationMV2Validator } from '../../../../src/lib/mv2/background/configuration';
import { createProtectAllPolicy } from '../../common/canvas-protection/fixtures/prepared-policies';

import { getConfigurationMv2Fixture } from './fixtures/configuration';
import { MockAppContext } from './mocks/mock-app-context';

vi.mock('../../../../src/lib/mv2/background/ext-session-storage');
vi.mock('../../../../src/lib/mv2/background/app-context', () => ({
    appContext: vi.fn(() => new MockAppContext()),
}));
vi.mock('../../../../src/lib/mv2/background/web-request-api');
vi.mock('../../../../src/lib/mv2/background/engine-api');
vi.mock('../../../../src/lib/mv2/background/tabs/tabs-api');
vi.mock('../../../../src/lib/mv2/background/stealth-api');
vi.mock('../../../../src/lib/mv2/background/services/resources-service');
vi.mock('../../../../src/lib/mv2/background/services/redirects/redirects-service');
vi.mock('../../../../src/lib/mv2/background/messages-api', () => ({
    MessagesApi: class {
        handleMessage = vi.fn();
    },
}));
vi.mock('../../../../src/lib/mv2/background/configuration');
vi.mock('../../../../src/lib/mv2/background/assistant');
vi.mock('../../../../src/lib/mv2/background/services/local-script-rules-service');
vi.mock('../../../../src/lib/mv2/background/request');
vi.mock('../../../../src/lib/mv2/background/tabs/tabs-cosmetic-injector');

describe('TsWebExtension', () => {
    let instance: TsWebExtension;

    let config: ConfigurationMV2;

    beforeEach(async () => {
        vi.stubGlobal('crypto', webcrypto);
        instance = createTsWebExtension('test');
        config = getConfigurationMv2Fixture();
        vi.mocked(configurationMV2Validator.parse).mockImplementation((value) => value as ConfigurationMV2);
        vi.spyOn(engineApi, 'startEngine').mockResolvedValue({ conversionErrors: [] });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should be created correctly', () => {
        expect(instance).toBeInstanceOf(TsWebExtension);
    });

    describe('start, configure and update methods', () => {
        it('should throw error, if app was updated before start', async () => {
            await expect(() => instance.configure(config)).rejects.toThrowError('App is not started!');
        });

        it('should be started correctly and return conversion errors', async () => {
            const mockErrors = [
                {
                    rule: '##^:bad-rule()',
                    offset: 0,
                    message: 'bad rule',
                    filterId: 1,
                },
            ];
            vi.spyOn(engineApi, 'startEngine').mockResolvedValue({ conversionErrors: mockErrors });

            await instance.initStorage();
            const result = await instance.start(config);

            expect(instance.isStarted).toBe(true);
            expect(result).toEqual({ conversionErrors: mockErrors });
        });

        it('should be updated correctly and return conversion errors', async () => {
            const mockErrors: never[] = [];
            vi.spyOn(engineApi, 'startEngine').mockResolvedValue({ conversionErrors: mockErrors });

            config.settings.filteringEnabled = false;

            const result = await instance.configure(config);

            expect(instance.configuration.settings.filteringEnabled).toBe(false);
            expect(result).toEqual({ conversionErrors: mockErrors });
        });

        it('Should be stopped correctly', async () => {
            await instance.stop();

            expect(instance.isStarted).toBe(false);
        });
    });

    it('should open assistant via assistant module', async () => {
        const spy = vi.spyOn(assistant, 'openAssistant');

        instance.openAssistant(0);

        expect(spy).toBeCalledTimes(1);
        expect(spy).toBeCalledWith(0);
    });

    it('should close assistant via assistant module', async () => {
        const spy = vi.spyOn(Assistant, 'closeAssistant');

        instance.closeAssistant(0);

        expect(spy).toBeCalledTimes(1);
        expect(spy).toBeCalledWith(0);
    });

    it('should return rules count from engine api', () => {
        const expectedRulesCount = 1000;

        vi.spyOn(engineApi, 'getRulesCount').mockImplementation(() => expectedRulesCount);

        expect(instance.getRulesCount()).toBe(expectedRulesCount);
    });

    it('should return message handler from messages api', async () => {
        const expectedResponse = Date.now();

        vi.spyOn(messagesApi, 'handleMessage').mockReturnValue(Promise.resolve(expectedResponse));

        const handler = instance.getMessageHandler();

        expect(await handler({} as Message, {} as Runtime.MessageSender)).toBe(expectedResponse);
    });

    describe('configuration option setters', () => {
        beforeEach(async () => {
            await instance.start(config);
        });

        it('should update filteringEnabled correctly', async () => {
            const expected = false;

            instance.setFilteringEnabled(expected);

            expect(instance.configuration.settings.filteringEnabled).toBe(expected);
        });

        it('should update collectStats correctly', async () => {
            const expected = true;

            instance.setCollectHitStats(expected);

            expect(instance.configuration.settings.collectStats).toBe(expected);
        });

        it('should update stealthModeEnabled correctly', async () => {
            const expected = true;

            instance.setStealthModeEnabled(expected);

            expect(instance.configuration.settings.stealthModeEnabled).toBe(expected);
        });

        it('should update selfDestructFirstPartyCookies correctly', async () => {
            const expected = true;

            instance.setSelfDestructFirstPartyCookies(expected);

            expect(instance.configuration.settings.stealth.selfDestructFirstPartyCookies).toBe(expected);
        });

        it('should update selfDestructThirdPartyCookies correctly', async () => {
            const expected = true;

            instance.setSelfDestructThirdPartyCookies(expected);

            expect(instance.configuration.settings.stealth.selfDestructThirdPartyCookies).toBe(expected);
        });

        it('should update selfDestructThirdPartyCookiesTime correctly', async () => {
            const expected = 1000;

            instance.setSelfDestructThirdPartyCookiesTime(expected);

            expect(instance.configuration.settings.stealth.selfDestructThirdPartyCookiesTime).toBe(expected);
        });

        it('should update selfDestructFirstPartyCookiesTime correctly', async () => {
            const expected = 1000;

            instance.setSelfDestructFirstPartyCookiesTime(expected);

            expect(instance.configuration.settings.stealth.selfDestructFirstPartyCookiesTime).toBe(expected);
        });

        it('should update hideReferrer correctly', async () => {
            const expected = true;

            instance.setHideReferrer(expected);

            expect(instance.configuration.settings.stealth.hideReferrer).toBe(expected);
        });

        it('should update hideSearchQueries correctly', async () => {
            const expected = true;

            instance.setHideSearchQueries(expected);

            expect(instance.configuration.settings.stealth.hideSearchQueries).toBe(expected);
        });

        it('should update blockChromeClientData correctly', async () => {
            const expected = true;

            instance.setBlockChromeClientData(expected);

            expect(instance.configuration.settings.stealth.blockChromeClientData).toBe(expected);
        });

        it('should update sendDoNotTrack correctly', async () => {
            const expected = true;

            instance.setSendDoNotTrack(expected);

            expect(instance.configuration.settings.stealth.sendDoNotTrack).toBe(expected);
        });

        it('should update blockWebRTC correctly', async () => {
            const expected = true;

            instance.setBlockWebRTC(expected);

            expect(instance.configuration.settings.stealth.blockWebRTC).toBe(expected);
        });
    });
    describe('canvas protection consumer integration', () => {
        let values: Record<string, unknown>;
        let unregister: ReturnType<typeof vi.fn>;

        beforeEach(async () => {
            vi.stubGlobal('VideoFrame', vi.fn());
            vi.stubGlobal('VideoColorSpace', vi.fn());
            await browser.storage.local.clear();
            values = {};
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
            unregister = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(browser, 'contentScripts', {
                configurable: true,
                value: { register: vi.fn().mockResolvedValue({ unregister }) },
            });
        });

        it('keeps old consumer configuration native', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.configure(config);
            await instance.stop();
            expect(browser.contentScripts.register).not.toHaveBeenCalled();
            expect(unregister).not.toHaveBeenCalled();
            expect(instance.getCanvasProtectionState().status).toBe('disabled');
        });

        it('requires prepared policy rather than assuming empty exceptions', async () => {
            await instance.initStorage();
            await instance.start(config);
            const result = await instance.setCanvasProtectionEnabled(true);
            expect(result).toMatchObject({
                status: 'unavailable',
                requiredUserAction: expect.stringContaining('prepared canvas protection policy'),
            });
            expect(browser.contentScripts.register).not.toHaveBeenCalled();
        });

        it('applies every gate and prepared replacement to new documents', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(createProtectAllPolicy('firefox-mv2', 'policy-a'));
            const initial = await instance.setCanvasProtectionEnabled(true);
            expect(initial.status).toBe('installed');
            const captured = vi.mocked(browser.contentScripts.register).mock.calls.at(-1)![0];
            await instance.setFilteringEnabled(false);
            expect(instance.getCanvasProtectionState().status).toBe('disabled');
            await instance.setFilteringEnabled(true);
            await instance.setStealthModeEnabled(false);
            expect(instance.getCanvasProtectionState().status).toBe('disabled');
            await instance.setStealthModeEnabled(true);
            const replacement = await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy('firefox-mv2', 'policy-b'),
            );
            expect(replacement).toMatchObject({
                status: 'installed',
                installed: {
                    status: 'available',
                    value: {
                        revision: 'policy-b',
                        generation: initial.installed.status === 'available'
                            ? initial.installed.value.generation : undefined,
                    },
                },
            });
            expect(captured.js).not.toEqual(vi.mocked(browser.contentScripts.register).mock.calls.at(-1)![0].js);
            await instance.stop();
            expect(instance.getCanvasProtectionState().status).toBe('disabled');
        });

        it('reports failed removal and retries the persisted request through lifecycle calls', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(createProtectAllPolicy('firefox-mv2', 'policy-a'));
            const initial = await instance.setCanvasProtectionEnabled(true);
            unregister.mockRejectedValueOnce(new Error('removal rejected'));
            expect(await instance.setCanvasProtectionEnabled(false)).toMatchObject({
                status: 'failed', installed: initial.installed,
            });
            expect(instance.getCanvasProtectionState().status).toBe('failed');
            await instance.initStorage();
            expect(instance.getCanvasProtectionState().status).toBe('disabled');
            expect(await instance.reconcileCanvasProtection()).toMatchObject({ status: 'disabled' });
        });

        it('reports missing registration access and preserves the pending request', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(createProtectAllPolicy('firefox-mv2', 'policy-a'));
            const initial = await instance.setCanvasProtectionEnabled(true);
            const { register } = browser.contentScripts;
            Object.defineProperty(browser, 'contentScripts', { configurable: true, value: undefined });
            const pending = await instance.setCanvasProtectionEnabled(false);
            expect(pending).toMatchObject({
                status: 'unavailable', installed: initial.installed, requiredUserAction: expect.any(String),
            });
            const requested = await browser.storage.local.get('tswebextension.canvasProtectionRequested');
            expect(requested['tswebextension.canvasProtectionRequested']).toMatchObject({
                gates: { protectCanvas: false },
            });
            Object.defineProperty(browser, 'contentScripts', { configurable: true, value: { register } });
            expect((await instance.reconcileCanvasProtection()).status).toBe('disabled');
        });

        it('rejects a policy for a different browser and keeps the previous acknowledgment', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(createProtectAllPolicy('firefox-mv2', 'policy-a'));
            const initial = await instance.setCanvasProtectionEnabled(true);
            vi.mocked(browser.contentScripts.register).mockClear();
            const result = await instance.setCanvasProtectionPolicy(createProtectAllPolicy('chromium-mv3', 'wrong'));
            expect(result).toMatchObject({ status: 'failed', installed: initial.installed });
            expect(browser.contentScripts.register).not.toHaveBeenCalled();
            expect(unregister).not.toHaveBeenCalled();
        });

        it('does not report a lost registration as a currently installed historical summary', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(createProtectAllPolicy('firefox-mv2', 'policy-a'));
            await instance.setCanvasProtectionEnabled(true);
            const restarted = createTsWebExtension('test');
            vi.mocked(browser.contentScripts.register).mockRejectedValueOnce(new Error('reinstallation rejected'));
            await restarted.initStorage();
            expect(restarted.getCanvasProtectionState()).toMatchObject({
                status: 'failed', installed: { status: 'unavailable' },
            });
            expect((await restarted.reconcileCanvasProtection()).status).toBe('installed');
        });

        it('preserves the prepared policy when stopping a rehydrated application without configuration', async () => {
            await instance.initStorage();
            await instance.start(config);
            const policy = createProtectAllPolicy('firefox-mv2', 'policy-a');
            await instance.setCanvasProtectionPolicy(policy);
            await instance.setCanvasProtectionEnabled(true);
            values = {};
            appContext.configuration = undefined;
            const restarted = createTsWebExtension('test');
            await restarted.initStorage();
            expect(restarted.getCanvasProtectionState().status).toBe('installed');
            await restarted.stop();
            const requested = await browser.storage.local.get('tswebextension.canvasProtectionRequested');
            expect(requested['tswebextension.canvasProtectionRequested']).toMatchObject({
                policy, gates: { filteringEnabled: false },
            });
            expect(restarted.getCanvasProtectionState().status).toBe('disabled');
        });

        it('uses the transformed validated configuration', async () => {
            const parsed = { ...config, settings: { ...config.settings, debugScriptlets: true } };
            vi.mocked(configurationMV2Validator.parse).mockReturnValueOnce(parsed);
            await instance.start(config);
            expect(instance.configuration.settings.debugScriptlets).toBe(true);
        });
        it('does not restart canvas registration through setters after stop', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(createProtectAllPolicy('firefox-mv2', 'before-stop'));
            await instance.setCanvasProtectionEnabled(true);
            await instance.stop();
            vi.mocked(browser.contentScripts.register).mockClear();
            await instance.setFilteringEnabled(true);
            await instance.setStealthModeEnabled(true);
            await instance.setCanvasProtectionEnabled(true);
            await instance.setCanvasProtectionPolicy(createProtectAllPolicy('firefox-mv2', 'after-stop'));
            await instance.reconcileCanvasProtection();
            expect(browser.contentScripts.register).not.toHaveBeenCalled();
            expect(instance.getCanvasProtectionState().status).toBe('disabled');
        });
    });
});
