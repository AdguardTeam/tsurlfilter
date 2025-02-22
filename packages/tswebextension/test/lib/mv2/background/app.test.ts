import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';
import { type Runtime } from 'webextension-polyfill';

import {
    type ConfigurationMV2,
    createTsWebExtension,
    engineApi,
    messagesApi,
    TsWebExtension,
} from '../../../../src/lib';
import { assistant, Assistant } from '../../../../src/lib/mv2/background/assistant';
import { type Message } from '../../../../src/lib/common/message';

import { MockAppContext } from './mocks/mock-app-context';
import { getConfigurationMv2Fixture } from './fixtures/configuration';

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
        instance = createTsWebExtension('test');
        config = getConfigurationMv2Fixture();
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

        it('should be started correctly', async () => {
            await instance.initStorage();
            await instance.start(config);

            expect(instance.isStarted).toBe(true);
        });

        it('should be updated correctly', async () => {
            config.settings.filteringEnabled = false;

            await instance.configure(config);

            expect(instance.configuration.settings.filteringEnabled).toBe(false);
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
});
