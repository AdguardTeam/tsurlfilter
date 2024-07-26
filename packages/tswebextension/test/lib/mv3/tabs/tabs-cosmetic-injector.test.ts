import browser from 'sinon-chrome';
import { CosmeticResult, type MatchingResult } from '@adguard/tsurlfilter';

import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { TabsCosmeticInjector } from '../../../../src/lib/mv3/tabs/tabs-cosmetic-injector';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';
import { createCosmeticRule } from '../../../helpers/rule-creator';
import { extSessionStorage } from '../../../../src/lib';
import { appContext } from '../../../../src/lib/mv3/background/app-context';

jest.mock('@lib/mv3/background/engine-api');

describe('TabsCosmeticInjector', () => {
    beforeAll(async () => {
        await extSessionStorage.init();
        appContext.isAppStarted = true;
    });

    beforeEach(() => {
        jest.spyOn(CosmeticApi, 'applyCosmeticResult');
        jest.spyOn(ScriptingApi, 'executeScript');
        jest.spyOn(ScriptingApi, 'insertCSS');
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('processOpenTabs method', () => {
        it('should apply cosmetic rules for each tab', async () => {
            const tabId = 1;
            const frameId = 0;
            const url = 'https://example.com';
            const timestamp = 123;

            browser.tabs.query.resolves([{
                id: tabId,
                url,
            }]);

            browser.webNavigation.getAllFrames.resolves([{ frameId, url }]);

            const matchingResult = {} as MatchingResult;
            matchingResult.getCosmeticOption = jest.fn();

            const cosmeticResult = new CosmeticResult();
            cosmeticResult.JS.append((
                createCosmeticRule("#%#console.log('test');", 1)
            ));
            cosmeticResult.CSS.append((
                createCosmeticRule('##h1', 1)
            ));

            jest.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
            jest.spyOn(engineApi, 'getCosmeticResult').mockReturnValue(cosmeticResult);
            jest.spyOn(Date, 'now').mockReturnValue(timestamp);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCosmeticResult).toBeCalledWith({
                tabId,
                frameId,
                cosmeticResult,
                frameUrl: url,
            });

            expect(ScriptingApi.executeScript).toBeCalledWith(frameId, tabId);
            expect(ScriptingApi.insertCSS).toBeCalledWith(frameId, tabId);

            // FIXME: Uncomment tests when logging will be returned
            // const expectedLogParams = {
            //     url,
            //     tabId,
            //     cosmeticResult,
            //     timestamp,
            //     contentType: ContentType.Document,
            // };
            // expect(CosmeticApi.logScriptRules).toBeCalledWith(expectedLogParams);
        });

        // it('should not apply cosmetic rules for non-browser tabs', async () => {
        //     const tabId = -1;
        //
        //     browser.tabs.query.resolves([{ id: tabId }]);
        //
        //     await TabsCosmeticInjector.processOpenTabs();
        //
        //     expect(CosmeticApi.applyCosmeticResult).not.toBeCalled();
        //     // TODO: Uncomment tests when injection cosmetic rules will be moved to tabs api.
        //     // expect(CosmeticApi.applyFrameCssRules).not.toBeCalled();
        //     // expect(CosmeticApi.applyFrameJsRules).not.toBeCalled();
        //     // expect(CosmeticApi.logScriptRules).not.toBeCalled();
        // });
        //
        // it('should not apply cosmetic rules for frames without src', async () => {
        //     const tabId = 1;
        //     const frameId = 1;
        //     const frameUrl = 'about:blank';
        //
        //     browser.tabs.query.resolves([{ id: tabId }]);
        //     browser.webNavigation.getAllFrames.resolves([{ frameId, url: frameUrl }]);
        //
        //     await TabsCosmeticInjector.processOpenTabs();
        //
        //     expect(CosmeticApi.applyCosmeticResult).not.toBeCalled();
        //
        //     // TODO: Uncomment tests when injection cosmetic rules will be moved to tabs api.
        //     // expect(CosmeticApi.applyFrameCssRules).not.toBeCalled();
        //     // expect(CosmeticApi.applyFrameJsRules).not.toBeCalled();
        //     // expect(CosmeticApi.logScriptRules).not.toBeCalled();
        // });
    });
});
