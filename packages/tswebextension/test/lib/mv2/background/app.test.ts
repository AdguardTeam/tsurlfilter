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
import {
    CanvasAvailabilityStatus,
    CanvasPolicyBrowser,
    CanvasRegistrationStatus,
} from '../../../../src/lib/common/canvas-protection/constants';
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
            expect(result.conversionErrors).toEqual(mockErrors);
        });

        it('should be updated correctly and return conversion errors', async () => {
            const mockErrors: never[] = [];
            vi.spyOn(engineApi, 'startEngine').mockResolvedValue({ conversionErrors: mockErrors });

            config.settings.filteringEnabled = false;

            const result = await instance.configure(config);

            expect(instance.configuration.settings.filteringEnabled).toBe(false);
            expect(result.conversionErrors).toEqual(mockErrors);
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
        let unregister: ReturnType<typeof vi.fn>;

        beforeEach(async () => {
            appContext.canvasProtectionSession = undefined;
            appContext.canvasProtectionRegistration = undefined;
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
            expect(instance.getCanvasProtectionState().status).toBe(CanvasRegistrationStatus.Disabled);
        });

        it('requires prepared policy rather than assuming empty exceptions', async () => {
            await instance.initStorage();
            await instance.start(config);
            const result = await instance.setCanvasProtectionEnabled(true);
            expect(result).toMatchObject({
                status: CanvasRegistrationStatus.Unavailable,
                requiredUserAction: expect.stringContaining('prepared canvas protection policy'),
            });
            expect(browser.contentScripts.register).not.toHaveBeenCalled();
        });

        it('applies every gate and prepared replacement to new documents', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'policy-a'),
            );
            const initial = await instance.setCanvasProtectionEnabled(true);
            expect(initial.status).toBe(CanvasRegistrationStatus.Installed);
            const captured = vi.mocked(browser.contentScripts.register).mock.calls.at(-1)![0];
            await instance.setFilteringEnabled(false);
            expect(instance.getCanvasProtectionState().status).toBe(CanvasRegistrationStatus.Disabled);
            await instance.setFilteringEnabled(true);
            await instance.setStealthModeEnabled(false);
            expect(instance.getCanvasProtectionState().status).toBe(CanvasRegistrationStatus.Disabled);
            await instance.setStealthModeEnabled(true);
            const replacement = await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'policy-b'),
            );
            expect(replacement).toMatchObject({
                status: CanvasRegistrationStatus.Installed,
                installed: {
                    status: CanvasAvailabilityStatus.Available,
                    value: {
                        revision: 'policy-b',
                        generation: initial.installed.status === CanvasAvailabilityStatus.Available
                            ? initial.installed.value.generation : undefined,
                    },
                },
            });
            expect(captured.js).not.toEqual(vi.mocked(browser.contentScripts.register).mock.calls.at(-1)![0].js);
            await instance.stop();
            expect(instance.getCanvasProtectionState().status).toBe(CanvasRegistrationStatus.Disabled);
        });

        it('reports failed removal and retries it on the next request', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'policy-a'),
            );
            const initial = await instance.setCanvasProtectionEnabled(true);
            unregister.mockRejectedValueOnce(new Error('removal rejected'));
            expect(await instance.setCanvasProtectionEnabled(false)).toMatchObject({
                status: CanvasRegistrationStatus.Failed, installed: initial.installed,
            });
            expect(instance.getCanvasProtectionState().status).toBe(CanvasRegistrationStatus.Failed);
            expect(
                await instance.setCanvasProtectionEnabled(false),
            ).toMatchObject({ status: CanvasRegistrationStatus.Disabled });
        });

        it('reports missing registration access and removes the script once access returns', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'policy-a'),
            );
            const initial = await instance.setCanvasProtectionEnabled(true);
            const { register } = browser.contentScripts;
            Object.defineProperty(browser, 'contentScripts', { configurable: true, value: undefined });
            const pending = await instance.setCanvasProtectionEnabled(false);
            expect(pending).toMatchObject({
                status: CanvasRegistrationStatus.Unavailable,
                installed: initial.installed,
                requiredUserAction: expect.any(String),
            });
            Object.defineProperty(browser, 'contentScripts', { configurable: true, value: { register } });
            expect((await instance.setCanvasProtectionEnabled(false)).status).toBe(CanvasRegistrationStatus.Disabled);
            expect(unregister).toHaveBeenCalledOnce();
        });

        it('rejects a policy for a different browser and keeps the previous acknowledgment', async () => {
            await instance.initStorage();
            await instance.start(config);
            await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'policy-a'),
            );
            const initial = await instance.setCanvasProtectionEnabled(true);
            vi.mocked(browser.contentScripts.register).mockClear();
            const result = await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy(CanvasPolicyBrowser.ChromiumMv3, 'wrong'),
            );
            expect(result).toMatchObject({ status: CanvasRegistrationStatus.Failed, installed: initial.installed });
            expect(browser.contentScripts.register).not.toHaveBeenCalled();
            expect(unregister).not.toHaveBeenCalled();
        });

        it('installs again after a restart that lost the registration', async () => {
            await instance.initStorage();
            await instance.start(config);
            const policy = createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'policy-a');
            await instance.setCanvasProtectionPolicy(policy);
            const initial = await instance.setCanvasProtectionEnabled(true);
            const restarted = createTsWebExtension('test');
            await restarted.initStorage();
            vi.mocked(browser.contentScripts.register).mockRejectedValueOnce(new Error('reinstallation rejected'));
            const enabled: ConfigurationMV2 = {
                ...config,
                canvasProtectionPolicy: policy,
                settings: { ...config.settings, stealth: { ...config.settings.stealth, protectCanvas: true } },
            };
            expect(await restarted.start(enabled)).toMatchObject({
                canvasProtection: {
                    status: CanvasRegistrationStatus.Failed,
                    installed: { status: CanvasAvailabilityStatus.Unavailable },
                },
            });
            expect(await restarted.setCanvasProtectionEnabled(true)).toMatchObject({
                status: CanvasRegistrationStatus.Installed, installed: initial.installed,
            });
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
            await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'before-stop'),
            );
            await instance.setCanvasProtectionEnabled(true);
            await instance.stop();
            vi.mocked(browser.contentScripts.register).mockClear();
            await instance.setFilteringEnabled(true);
            await instance.setStealthModeEnabled(true);
            await instance.setCanvasProtectionEnabled(true);
            await instance.setCanvasProtectionPolicy(
                createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'after-stop'),
            );
            expect(browser.contentScripts.register).not.toHaveBeenCalled();
            expect(instance.getCanvasProtectionState().status).toBe(CanvasRegistrationStatus.Disabled);
        });
    });
});
