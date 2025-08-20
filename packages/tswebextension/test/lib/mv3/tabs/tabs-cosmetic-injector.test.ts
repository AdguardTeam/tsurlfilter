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
import { cosmeticApi, CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';
import { createCosmeticRule } from '../../../helpers/rule-creator';
import { appContext } from '../../../../src/lib/mv3/background/app-context';
import { extSessionStorage } from '../../../../src/lib/mv3/background/ext-session-storage';
import { UserScriptsApi } from '../../../../src/lib/mv3/background/user-scripts-api';
import { type LocalScriptFunctionData } from '../../../../src/lib/mv3/background';
import { localScriptRulesService } from '../../../../src/lib/mv3/background/services/local-script-rules-service';
import { CUSTOM_FILTERS_START_ID } from '../../../../src/lib/common/constants';

vi.mock('../../../../src/lib/mv3/background/engine-api');
vi.mock('../../../../src/lib/mv3/background/app-context');

const testScriptFn = (): void => {
    // eslint-disable-next-line no-console
    console.log('script test from locale source');
};

const testScriptletFn = (): void => {
    // eslint-disable-next-line no-console
    console.log('scriptlet test from locale source');
};

const getLocalScriptRulesFixture = (): LocalScriptFunctionData => ({
    'console.log(\'script test from locale source\');': testScriptFn,
    '//scriptlet(\'log\', \'scriptlet test from locale source\')': testScriptletFn,
});

const setupMocks = (
    userScriptsAvailable: boolean,
    // localScriptRules
): void => {
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

    localScriptRulesService.setLocalScriptRules(getLocalScriptRulesFixture());

    vi.spyOn(CosmeticApi, 'applyCosmeticRules');
    vi.spyOn(cosmeticApi, 'logScriptRules');
    vi.spyOn(ScriptingApi, 'insertCSS');
    // TODO (Slava): add tests for executeScriptText. AG-39122

    // This method will be used if userScripts API is enabled.
    vi.spyOn(UserScriptsApi, 'executeScripts');

    // These methods will be used if userScripts API is not enabled.
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
        ['when user scripts permission is NOT granted', false],
        ['when user scripts permission is granted', true],
    ])('processOpenTabs method %s', (description, userScriptsAvailable) => {
        beforeEach(() => {
            setupMocks(userScriptsAvailable);

            // To simulate clean run
            appContext.startTimeMs = Date.now();
            appContext.cosmeticsInjectedOnStartup = false;
        });

        afterEach(() => {
            vi.clearAllMocks();
            vi.resetAllMocks();
            vi.resetModules();
            vi.restoreAllMocks();
        });

        it(`should apply cosmetic rules for each tab ${description}`, async () => {
            const tabId = 1;
            const frameId = 0;
            const url = 'https://example.com';
            const timestamp = 123;
            const localFilterId = 1;
            const customFilterId = CUSTOM_FILTERS_START_ID;

            chrome.tabs.query.resolves([{
                id: tabId,
                url,
            }]);

            chrome.webNavigation.getAllFrames.resolves([{ frameId, url }]);

            const matchingResult = {} as MatchingResult;
            matchingResult.getCosmeticOption = vi.fn();

            const localCosmeticRules = [
                createCosmeticRule("#%#console.log('script test from locale source');", localFilterId),
                createCosmeticRule("#%#//scriptlet('log', 'scriptlet test from locale source')", localFilterId),
            ];
            const remoteCosmeticRules = [
                createCosmeticRule("#%#console.log('script test from remote source');", customFilterId),
                createCosmeticRule("#%#//scriptlet('log', 'scriptlet test  from remote source')", customFilterId),
            ];
            const cosmeticResult = new CosmeticResult();

            cosmeticResult.JS.append(localCosmeticRules[0]);
            cosmeticResult.JS.append(localCosmeticRules[1]);

            cosmeticResult.JS.append(remoteCosmeticRules[0]);
            cosmeticResult.JS.append(remoteCosmeticRules[1]);

            cosmeticResult.CSS.append((
                createCosmeticRule('##h1', localFilterId)
            ));

            // Mark our filter as local to correctly handle injecting local rules.
            engineApi.localRulesFiltersIds = [localFilterId];

            vi.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
            vi.spyOn(engineApi, 'getCosmeticResult').mockReturnValue(cosmeticResult);
            vi.spyOn(Date, 'now').mockReturnValue(timestamp);

            await TabsCosmeticInjector.processOpenTabs();

            const withCss = true;

            expect(CosmeticApi.applyCosmeticRules).toHaveBeenCalledWith(tabId, frameId, withCss);

            if (withCss) {
                expect(ScriptingApi.insertCSS).toHaveBeenCalledWith({
                    tabId,
                    frameId,
                    cssText: 'h1',
                });
            }

            // Using ScriptingApi for rules from local rules should be processed
            // in any cases.
            expect(ScriptingApi.executeScriptFunc).toHaveBeenCalledWith({
                tabId,
                frameId,
                scriptFunction: testScriptFn,
            });
            expect(ScriptingApi.executeScriptlet).toHaveBeenCalledWith(
                expect.objectContaining({
                    tabId,
                    frameId,
                    domainName: 'example.com',
                    scriptletData: expect.objectContaining({
                        func: expect.any(Function),
                        params: expect.objectContaining({
                            args: expect.arrayContaining(['scriptlet test from locale source']),
                            name: 'log',
                            verbose: false,
                            engine: '',
                            version: '',
                            domainName: undefined,
                        }),
                    }),
                }),
            );

            // But UserScriptsApi should be used only if user scripts permission
            // is granted.
            if (userScriptsAvailable) {
                expect(UserScriptsApi.executeScripts).toHaveBeenCalledWith(
                    // Do not test whole object since it is too huge for mocks.
                    expect.objectContaining({
                        tabId,
                        frameId,
                        scriptText: expect.stringContaining('script test from remote source'),
                    }),
                );
            } else {
                expect(UserScriptsApi.executeScripts).not.toBeCalled();
            }

            const preparedCosmeticResult = {
                cssText: CosmeticApi.getCssText(cosmeticResult, false),
                // Local script rules should be processed separately
                // because they will be injected with two different calls
                // to scripting API.
                localRules: {
                    ...CosmeticApi.getScriptsAndScriptletsData(localCosmeticRules),
                    rawRules: localCosmeticRules,
                },
                // Remote script rules should be combined into one script text
                // for the user scripts API.
                remoteRules: {
                    scriptText: CosmeticApi.getScriptText(remoteCosmeticRules),
                    rawRules: remoteCosmeticRules,
                },
            };

            const expectedLogParams = {
                url,
                tabId,
                preparedCosmeticResult,
                timestamp,
                contentType: ContentType.Document,
            };
            expect(cosmeticApi.logScriptRules).toBeCalledWith(expectedLogParams);
        });

        it(`should not apply cosmetic rules for non-browser tabs ${description}`, async () => {
            const tabId = -1;

            chrome.tabs.query.resolves([{ id: tabId }]);

            await TabsCosmeticInjector.processOpenTabs();

            expect(ScriptingApi.insertCSS).not.toBeCalled();
            expect(ScriptingApi.executeScriptFunc).not.toBeCalled();
            expect(ScriptingApi.executeScriptlet).not.toBeCalled();
            expect(UserScriptsApi.executeScripts).not.toBeCalled();

            expect(cosmeticApi.logScriptRules).not.toBeCalled();
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

            expect(ScriptingApi.insertCSS).not.toHaveBeenCalledWith({ tabId, frameId, cssText: 'h1' });

            expect(UserScriptsApi.executeScripts).not.toBeCalled();
            expect(ScriptingApi.executeScriptFunc).not.toBeCalled();
            expect(ScriptingApi.executeScriptlet).not.toBeCalled();

            expect(ScriptingApi.insertCSS).not.toBeCalled();
            expect(ScriptingApi.executeScriptFunc).not.toBeCalled();
            expect(ScriptingApi.executeScriptlet).not.toBeCalled();

            expect(cosmeticApi.logScriptRules).not.toBeCalled();
        });
    });
});
