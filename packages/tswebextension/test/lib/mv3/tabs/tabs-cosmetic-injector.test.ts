import browser from 'sinon-chrome';
import type { CosmeticResult, MatchingResult } from '@adguard/tsurlfilter';
import { engineApi } from '@lib/mv3/background/engine-api';
import { TabsCosmeticInjector } from '@lib/mv3/tabs/tabs-cosmetic-injector';
import { CosmeticJsApi } from '@lib/mv3/background/cosmetic-js-api';

jest.mock('@lib/mv3/background/engine-api');

describe('TabsCosmeticInjector', () => {
    beforeEach(() => {
        jest.spyOn(CosmeticJsApi, 'getAndExecuteScripts');
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

            const cosmeticResult = {} as CosmeticResult;

            jest.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
            jest.spyOn(engineApi, 'getCosmeticResult').mockReturnValue(cosmeticResult);
            jest.spyOn(engineApi, 'getScriptletsDataForUrl').mockReturnValue([]);
            jest.spyOn(Date, 'now').mockReturnValue(timestamp);

            // const expectedLogParams = {
            //     url,
            //     tabId,
            //     cosmeticResult,
            //     timestamp,
            //     contentType: ContentType.Document,
            // };

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticJsApi.getAndExecuteScripts).toBeCalledWith(tabId, url);
            // TODO: Uncomment tests when injection cosmetic rules will be moved to tabs api.
            // expect(CosmeticApi.applyFrameCssRules).toBeCalledWith(frameId, tabId);
            // expect(CosmeticApi.applyFrameJsRules).toBeCalledWith(frameId, tabId);
            // expect(CosmeticApi.logScriptRules).toBeCalledWith(expectedLogParams);
        });

        it('should not apply cosmetic rules for non-browser tabs', async () => {
            const tabId = -1;

            browser.tabs.query.resolves([{ id: tabId }]);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticJsApi.getAndExecuteScripts).not.toBeCalled();
            // TODO: Uncomment tests when injection cosmetic rules will be moved to tabs api.
            // expect(CosmeticApi.applyFrameCssRules).not.toBeCalled();
            // expect(CosmeticApi.applyFrameJsRules).not.toBeCalled();
            // expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });

        it('should not apply cosmetic rules for frames without src', async () => {
            const tabId = 1;
            const frameId = 1;
            const frameUrl = 'about:blank';

            browser.tabs.query.resolves([{ id: tabId }]);
            browser.webNavigation.getAllFrames.resolves([{ frameId, url: frameUrl }]);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticJsApi.getAndExecuteScripts).not.toBeCalled();

            // TODO: Uncomment tests when injection cosmetic rules will be moved to tabs api.
            // expect(CosmeticApi.applyFrameCssRules).not.toBeCalled();
            // expect(CosmeticApi.applyFrameJsRules).not.toBeCalled();
            // expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });
    });
});
