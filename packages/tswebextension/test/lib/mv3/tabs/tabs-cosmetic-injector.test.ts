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
import { UserScriptsApi } from '../../../../src/lib/mv3/background/user-scripts-api';
import { type LocalScriptFunctionData } from '../../../../src/lib/mv3/background';
import { localScriptRulesService } from '../../../../src/lib/mv3/background/services/local-script-rules-service';
import { CosmeticFrameProcessor } from '../../../../src/lib/mv3/background/cosmetic-frame-processor';
import { CUSTOM_FILTERS_START_ID, USER_FILTER_ID } from '../../../../src/lib/common/constants';

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
    vi.spyOn(CosmeticApi, 'logScriptRules');
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
        ['when user scripts permission IS NOT granted', false],
        ['when user scripts permission IS granted', true],
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
            const userFilterId = USER_FILTER_ID;

            chrome.tabs.query.resolves([{
                id: tabId,
                url,
            }]);

            chrome.webNavigation.getAllFrames.resolves([{ frameId, url }]);

            const matchingResult = {} as MatchingResult;
            matchingResult.getCosmeticOption = vi.fn();

            const cosmeticResult = new CosmeticResult();

            const builtInCosmeticRules = [
                createCosmeticRule("#%#console.log('script test from locale source');", localFilterId),
                createCosmeticRule("#%#//scriptlet('log', 'scriptlet test from locale source')", localFilterId),
            ];
            const customFiltersCosmeticRules = [
                createCosmeticRule("#%#console.log('script test from custom filter');", customFilterId),
                createCosmeticRule("#%#//scriptlet('log', 'scriptlet test from custom filter')", customFilterId),
            ];
            const userDefinedCosmeticRules = [
                // This rule should be applied in any case, since it is a rule from built-in filter.
                createCosmeticRule("#%#console.log('script test from locale source');", userFilterId),
                // This rule should be applied only if userScriptsAvailable is true.
                createCosmeticRule("#%#console.log('script test from user rules');", userFilterId),
                // This rule should be applied in any case, since it is a rule from built-in filter.
                createCosmeticRule("#%#//scriptlet('log', 'scriptlet test from locale source')", userFilterId),
                // This rule should be applied only if userScriptsAvailable is true.
                createCosmeticRule("#%#//scriptlet('log', 'scriptlet test from user rules')", userFilterId),
            ];

            // Combine all rules to simulate the result from engine API.
            builtInCosmeticRules
                .concat(customFiltersCosmeticRules, userDefinedCosmeticRules)
                .forEach((rule) => cosmeticResult.JS.append(rule));

            cosmeticResult.CSS.append(createCosmeticRule('##h1', localFilterId));
            cosmeticResult.CSS.append(createCosmeticRule('##h2', customFilterId));
            cosmeticResult.CSS.append(createCosmeticRule('##h3', userFilterId));

            // Mark our filter as local to correctly handle injecting local rules.
            // IMPORTANT: Mock functions must be set BEFORE calling splitLocalRemoteScriptRules
            vi.spyOn(engineApi, 'isLocalFilter').mockImplementation((filterId: number) => {
                return filterId === localFilterId;
            });
            vi.spyOn(engineApi, 'isUserRulesFilter').mockImplementation((filterId: number) => {
                return filterId === userFilterId;
            });

            const {
                localRules,
                remoteRules,
                // @ts-expect-error Expected private method error.
            } = CosmeticFrameProcessor.splitLocalRemoteScriptRules(cosmeticResult.getScriptRules());

            vi.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
            vi.spyOn(engineApi, 'getCosmeticResult').mockReturnValue(cosmeticResult);
            vi.spyOn(Date, 'now').mockReturnValue(timestamp);

            await TabsCosmeticInjector.processOpenTabs();

            const shouldApplyCss = true;

            expect(CosmeticApi.applyCosmeticRules).toHaveBeenCalledWith(tabId, frameId, shouldApplyCss);

            // Just for readability
            if (shouldApplyCss) {
                expect(ScriptingApi.insertCSS).toHaveBeenNthCalledWith(
                    // Because all CSS rules should be combined into one call.
                    1,
                    { tabId, frameId, cssText: CosmeticApi.getCssText(cosmeticResult, false) },
                );
            }

            // Using ScriptingApi for rules from built in filters should be
            // applied in any cases.
            expect(ScriptingApi.executeScriptFunc).toHaveBeenNthCalledWith(
                // Because we have only one local script rule.
                1,
                {
                    tabId,
                    frameId,
                    scriptFunction: testScriptFn,
                },
            );

            expect(ScriptingApi.executeScriptlet).toHaveBeenNthCalledWith(
                // Because we have only one local scriptlet rule.
                1,
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
                expect(UserScriptsApi.executeScripts).toHaveBeenCalledTimes(1);

                // Get the actual call arguments
                const callArgs = (UserScriptsApi.executeScripts as any).mock.calls[0][0];

                expect(callArgs).toEqual(
                    expect.objectContaining({
                        tabId,
                        frameId,
                        scriptText: expect.any(String),
                    }),
                );

                // Check that scriptText contains all expected strings, because
                // script text is combined from multiple rules.
                const { scriptText } = callArgs;
                const expectedStrings = [
                    'script test from locale source',
                    'scriptlet test from locale source',
                    'script test from custom filter',
                    'scriptlet test from custom filter',
                    'script test from user rules',
                    'scriptlet test from user rules',
                ];

                expectedStrings.forEach((expectedString) => {
                    expect(scriptText).toContain(expectedString);
                });
            } else {
                expect(UserScriptsApi.executeScripts).not.toBeCalled();
            }

            // expect.arrayContaining since the order of rules might be different
            // depending on the way how they are stored in the engine.
            const preparedCosmeticResult = {
                cssText: CosmeticApi.getCssText(cosmeticResult, false),
                // Local script rules should be processed separately
                // because they will be injected with two different calls
                // to scripting API.
                localRules: {
                    ...CosmeticApi.getScriptsAndScriptletsData(localRules),
                    rawRules: localRules,
                },
                // Remote script rules should be combined into one script text
                // for the user scripts API.
                remoteRules: {
                    scriptText: CosmeticApi.getScriptText(remoteRules),
                    rawRules: remoteRules,
                },
            };

            const expectedLogParams = {
                url,
                tabId,
                preparedCosmeticResult,
                timestamp,
                contentType: ContentType.Document,
            };
            expect(CosmeticApi.logScriptRules).toBeCalledWith(expectedLogParams);
        });

        it(`should not apply cosmetic rules for non-browser tabs ${description}`, async () => {
            const tabId = -1;

            chrome.tabs.query.resolves([{ id: tabId }]);

            await TabsCosmeticInjector.processOpenTabs();

            expect(ScriptingApi.insertCSS).not.toBeCalled();
            expect(ScriptingApi.executeScriptFunc).not.toBeCalled();
            expect(ScriptingApi.executeScriptlet).not.toBeCalled();
            expect(UserScriptsApi.executeScripts).not.toBeCalled();

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

            expect(ScriptingApi.insertCSS).not.toHaveBeenCalledWith({ tabId, frameId, cssText: 'h1' });

            expect(UserScriptsApi.executeScripts).not.toBeCalled();
            expect(ScriptingApi.executeScriptFunc).not.toBeCalled();
            expect(ScriptingApi.executeScriptlet).not.toBeCalled();

            expect(ScriptingApi.insertCSS).not.toBeCalled();
            expect(ScriptingApi.executeScriptFunc).not.toBeCalled();
            expect(ScriptingApi.executeScriptlet).not.toBeCalled();

            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });
    });
});
