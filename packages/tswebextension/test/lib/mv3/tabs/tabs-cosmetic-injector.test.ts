import {
    describe,
    expect,
    beforeAll,
    beforeEach,
    afterEach,
    it,
    vi,
    afterAll,
} from 'vitest';
import chrome from 'sinon-chrome';
import { CosmeticResult, type MatchingResult } from '@adguard/tsurlfilter';

import { ContentType } from '../../../../src/lib/common/request-type';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { TabsCosmeticInjector } from '../../../../src/lib/mv3/tabs/tabs-cosmetic-injector';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';
import { createCosmeticRule } from '../../../helpers/rule-creator';
import { appContext } from '../../../../src/lib/mv3/background/app-context';
import { extSessionStorage } from '../../../../src/lib/mv3/background/ext-session-storage';

vi.mock('../../../../src/lib/mv3/background/engine-api');
vi.mock('../../../../src/lib/mv3/background/app-context');

const setupMocks = (userScriptsAvailable: boolean): void => {
    // Mock to pass the check in the code that chrome.userScripts is available.
    if (userScriptsAvailable) {
        global.chrome = {
            ...global.chrome,
            userScripts: {
                register: vi.fn(),
                execute: vi.fn(),
                update: vi.fn(),
                configureWorld: vi.fn(),
                getScripts: vi.fn(),
                getWorldConfigurations: vi.fn(),
                resetWorldConfiguration: vi.fn(),
                unregister: vi.fn(),
            },
        };
    }

    vi.spyOn(CosmeticApi, 'applyCssByTabAndFrame');
    vi.spyOn(CosmeticApi, 'logScriptRules');
    vi.spyOn(ScriptingApi, 'insertCSS');
    // TODO (Slava): add tests for executeScriptText. AG-39122

    // These methods will be used if userScripts available.
    vi.spyOn(CosmeticApi, 'applyJsFuncsAndScriptletsByTabAndFrame');
    vi.spyOn(ScriptingApi, 'executeScriptsViaUserScripts');

    // These methods will be used if userScripts are not available.
    vi.spyOn(CosmeticApi, 'applyJsFuncsByTabAndFrame');
    vi.spyOn(CosmeticApi, 'applyScriptletsByTabAndFrame');
    vi.spyOn(ScriptingApi, 'executeScriptFunc');
    vi.spyOn(ScriptingApi, 'executeScriptlet');
};

describe('TabsCosmeticInjector', () => {
    beforeAll(async () => {
        await extSessionStorage.init();
        appContext.startTimeMs = Date.now();
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe.each([
        ['without mocked userScripts', false],
        ['with mocked userScripts', true],
    ])('processOpenTabs method %s', (description, userScriptsAvailable) => {
        beforeEach(() => {
            setupMocks(userScriptsAvailable);

            // To simulate clean run
            appContext.cosmeticsInjectedOnStartup = false;
        });

        afterEach(() => {
            vi.resetAllMocks();
            vi.resetModules();
        });

        it(`should apply cosmetic rules for each tab ${description}`, async () => {
            const tabId = 1;
            const frameId = 0;
            const url = 'https://example.com';
            const timestamp = 123;

            chrome.tabs.query.resolves([{
                id: tabId,
                url,
            }]);

            chrome.webNavigation.getAllFrames.resolves([{ frameId, url }]);

            const matchingResult = {} as MatchingResult;
            matchingResult.getCosmeticOption = vi.fn();

            const cosmeticResult = new CosmeticResult();
            cosmeticResult.JS.append((
                createCosmeticRule("#%#console.log('test');", 1)
            ));
            cosmeticResult.CSS.append((
                createCosmeticRule('##h1', 1)
            ));

            vi.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
            vi.spyOn(engineApi, 'getCosmeticResult').mockReturnValue(cosmeticResult);
            vi.spyOn(Date, 'now').mockReturnValue(timestamp);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCssByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);

            if (userScriptsAvailable) {
                expect(CosmeticApi.applyJsFuncsAndScriptletsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
                expect(CosmeticApi.applyJsFuncsByTabAndFrame).not.toBeCalled();
                expect(CosmeticApi.applyScriptletsByTabAndFrame).not.toBeCalled();
            } else {
                expect(CosmeticApi.applyJsFuncsAndScriptletsByTabAndFrame).not.toBeCalled();
                expect(CosmeticApi.applyJsFuncsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
                expect(CosmeticApi.applyScriptletsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
            }

            const expectedLogParams = {
                url,
                tabId,
                cosmeticResult,
                timestamp,
                contentType: ContentType.Document,
            };
            expect(CosmeticApi.logScriptRules).toBeCalledWith(expectedLogParams);
        });

        it(`should not apply cosmetic rules for non-browser tabs ${description}`, async () => {
            const tabId = -1;

            chrome.tabs.query.resolves([{ id: tabId }]);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCssByTabAndFrame).not.toBeCalled();
            expect(CosmeticApi.applyJsFuncsByTabAndFrame).not.toBeCalled();
            expect(CosmeticApi.applyScriptletsByTabAndFrame).not.toBeCalled();
            expect(CosmeticApi.applyJsFuncsAndScriptletsByTabAndFrame).not.toBeCalled();

            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });

        it(`should not apply cosmetic rules for main frames with blank urls ${description}`, async () => {
            // setting manually since resetAllMocks does not work
            appContext.cosmeticsInjectedOnStartup = false;
            const tabId = 1;
            const frameId = 1;
            const frameUrl = 'about:blank';

            chrome.tabs.query.resolves([{ id: tabId }]);
            chrome.webNavigation.getAllFrames.resolves([{ frameId, url: frameUrl }]);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCssByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);

            if (userScriptsAvailable) {
                expect(CosmeticApi.applyJsFuncsAndScriptletsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
                expect(CosmeticApi.applyJsFuncsByTabAndFrame).not.toBeCalled();
                expect(CosmeticApi.applyScriptletsByTabAndFrame).not.toBeCalled();
            } else {
                expect(CosmeticApi.applyJsFuncsAndScriptletsByTabAndFrame).not.toBeCalled();
                expect(CosmeticApi.applyJsFuncsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
                expect(CosmeticApi.applyScriptletsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
            }

            expect(ScriptingApi.insertCSS).not.toBeCalled();
            expect(ScriptingApi.executeScriptFunc).not.toBeCalled();
            expect(ScriptingApi.executeScriptlet).not.toBeCalled();

            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });
    });
});
